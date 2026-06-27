using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using NagStudy.API.Data;
using NagStudy.API.Infrastructure;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;

namespace NagStudy.API.Services;

public class TriggerService
{
    private readonly NagStudyContext _db;
    private readonly CoachKernelFactory _kernelFactory;
    private readonly ILogger<TriggerService> _logger;

    private static readonly Dictionary<string, TimeSpan> Cooldowns = new()
    {
        ["Manual"] = TimeSpan.Zero,
        ["DayBrief"] = TimeSpan.Zero,
        ["Nagging"] = TimeSpan.Zero,
        ["TaskStarting"] = TimeSpan.Zero,
        ["TaskEnded"] = TimeSpan.Zero,
    };

    public TriggerService(NagStudyContext db, CoachKernelFactory kernelFactory, ILogger<TriggerService> logger)
    {
        _db = db;
        _kernelFactory = kernelFactory;
        _logger = logger;
    }

    public async Task<TriggerResultResponse> TriggerAsync(int userId, string trigger, bool force = false, int? taskId = null, int? debugNowMinutes = null, NaggingContextDto? naggingContext = null)
    {
        var user = await _db.Users.Include(u => u.NagProfile).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new UnauthorizedAccessException();

        var isTaskTrigger = trigger is "TaskStarting" or "TaskEnded";
        var effectiveNow = debugNowMinutes != null
            ? TaskTimeHelper.CombineMytDateAndMinutes(TaskTimeHelper.TodayMyt(), debugNowMinutes.Value)
            : DateTime.UtcNow;

        if (!user.AiNotificationsEnabled && trigger != "Manual" && !(force && trigger == "DayBrief"))
            return new TriggerResultResponse { ShouldShow = false };

        if (user.NagProfile == null)
            return new TriggerResultResponse { ShouldShow = false };

        if (!force && trigger != "Manual" && !isTaskTrigger && !await ShouldFireAsync(userId, trigger))
            return new TriggerResultResponse { ShouldShow = false, CooldownRemainingSeconds = 0 };

        StudyTask? task = null;
        if (isTaskTrigger)
        {
            if (taskId == null) return new TriggerResultResponse { ShouldShow = false };
            task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == taskId.Value && t.UserId == userId);
            if (task == null) return new TriggerResultResponse { ShouldShow = false };
        }

        var ignoreReminderFlags = debugNowMinutes != null;

        var context = await BuildTriggerContextAsync(userId, trigger, task, effectiveNow, ignoreReminderFlags, naggingContext);
        if (context == null)
            return new TriggerResultResponse { ShouldShow = false };

        var message = await GenerateNagAsync(userId, user.NagProfile, trigger, context);

        var feedback = new AIFeedback
        {
            UserId = userId,
            Sender = "Coach",
            Type = "Nag",
            Trigger = trigger,
            Tone = user.NagProfile.Key ?? user.NagProfile.Name,
            Content = message,
            CreatedAt = DateTime.UtcNow
        };
        _db.AIFeedbacks.Add(feedback);

        if (trigger == "DayBrief")
            user.LastDayBriefDate = TaskTimeHelper.MytDateToUtc(TaskTimeHelper.TodayMyt());

        if (trigger == "TaskStarting" && task != null && !ignoreReminderFlags)
            task.StartReminderSentAt = DateTime.UtcNow;
        if (trigger == "TaskEnded" && task != null && !ignoreReminderFlags)
            task.EndPromptSentAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return new TriggerResultResponse
        {
            ShouldShow = true,
            Message = message,
            NagId = feedback.Id,
            TaskId = task?.Id,
            TaskTitle = task?.Title,
            ShowTaskActions = trigger == "TaskEnded",
        };
    }

    public async Task<List<NagResponse>> ListNagsAsync(int userId, int limit = 50)
    {
        return await _db.AIFeedbacks
            .Where(a => a.UserId == userId && a.Type == "Nag")
            .OrderByDescending(a => a.CreatedAt)
            .Take(limit)
            .Select(a => new NagResponse
            {
                Id = a.Id,
                Trigger = a.Trigger ?? "Manual",
                Tone = a.Tone,
                Content = a.Content,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();
    }

    private async Task<bool> ShouldFireAsync(int userId, string trigger)
    {
        if (!Cooldowns.TryGetValue(trigger, out var cd) || cd == TimeSpan.Zero)
            return true;

        var since = DateTime.UtcNow - cd;
        return !await _db.AIFeedbacks.AnyAsync(a =>
            a.UserId == userId && a.Trigger == trigger && a.CreatedAt >= since);
    }

    private async Task<string?> BuildTriggerContextAsync(int userId, string trigger, StudyTask? task = null, DateTime? effectiveNowUtc = null, bool ignoreReminderFlags = false, NaggingContextDto? naggingContext = null)
    {
        var todayStart = DateTime.UtcNow.AddHours(8).Date.AddHours(-8);
        var yesterdayStart = todayStart.AddDays(-1);
        var tasks = await _db.Tasks.Where(t => t.UserId == userId).ToListAsync();
        var now = effectiveNowUtc ?? DateTime.UtcNow;
        var todaySec = await _db.StudySessions
            .Where(s => s.UserId == userId && s.StartedAt >= todayStart)
            .SumAsync(s => s.Duration);
        var yesterdaySec = await _db.StudySessions
            .Where(s => s.UserId == userId && s.StartedAt >= yesterdayStart && s.StartedAt < todayStart)
            .SumAsync(s => s.Duration);

        bool OnDay(StudyTask t, DateTime dayStartUtc, DateTime dayEndUtc) =>
            (t.StartTime != null && t.StartTime >= dayStartUtc && t.StartTime < dayEndUtc)
            || (t.StartTime == null && t.CreatedAt >= dayStartUtc && t.CreatedAt < dayEndUtc);

        var yesterdayTasks = tasks.Where(t => OnDay(t, yesterdayStart, todayStart)).ToList();
        var missedYesterday = yesterdayTasks
            .Where(t => t.Status != "Done")
            .Select(t => t.Title).ToList();
        var doneYesterday = yesterdayTasks.Count(t => t.Status == "Done");
        var todayTasks = tasks.Where(t => OnDay(t, todayStart, todayStart.AddDays(1))).ToList();
        var todayTodo = todayTasks.Count(t => t.Status != "Done");
        var todayUnscheduled = todayTasks.Count(t => t.Status != "Done" && t.StartTime == null);

        return trigger switch
        {
            "Manual" => $"Today focus: {todaySec / 60} min. Give a motivational nag.",
            "DayBrief" => $"""
                Yesterday missed/ overdue tasks ({missedYesterday.Count}): {string.Join(", ", missedYesterday.Take(8))}
                Yesterday focus: {yesterdaySec / 60} minutes
                Yesterday completed tasks: {doneYesterday}
                Today total open tasks: {todayTodo} ({todayUnscheduled} not yet on Gantt)
                Today focus so far: {todaySec / 60} minutes
                Summarize wins, misses, and one clear focus for today. Do not invent numbers.
                """,
            "Nagging" => BuildNaggingContext(tasks, now, todaySec, naggingContext),
            "TaskStarting" when task != null
                && task.StartTime != null
                && (ignoreReminderFlags || task.StartReminderSentAt == null)
                && task.Status == "Scheduled"
                && task.StartTime.Value.AddHours(8).Date == TaskTimeHelper.TodayMyt()
                && IsInTaskStartingWindow(task.StartTime.Value, now) =>
                $"Task starting soon: \"{task.Title}\" at {task.StartTime.Value.AddHours(8):HH:mm} MYT. Remind the student to get ready.",
            "TaskEnded" when task != null
                && task.EndTime != null
                && task.EndTime.Value.AddHours(8).Date == TaskTimeHelper.TodayMyt()
                && task.EndTime <= now
                && (ignoreReminderFlags || task.EndPromptSentAt == null)
                && task.Status == "Scheduled" =>
                $"Scheduled block for \"{task.Title}\" just ended. Ask if they completed it — keep it to 1-2 sentences.",
            "TaskStarting" => null,
            "TaskEnded" => null,
            _ => null
        };
    }

    private static string BuildNaggingContext(List<StudyTask> tasks, DateTime nowUtc, int todaySec, NaggingContextDto? client)
    {
        var todayMyt = TaskTimeHelper.TodayMyt();
        var gantt = tasks.FirstOrDefault(t =>
            t.Status == "Scheduled"
            && t.StartTime != null
            && t.EndTime != null
            && t.StartTime.Value.AddHours(8).Date == todayMyt
            && t.StartTime <= nowUtc
            && t.EndTime > nowUtc);

        var lines = new List<string>
        {
            $"focus_session_active: {(client?.IsFocusing == true ? "yes" : "no")}",
            $"today_focus_minutes: {todaySec / 60}",
        };

        if (client?.IsFocusing == true)
        {
            lines.Add($"focus_task: {client.FocusTaskTitle ?? "(none — category only)"}");
            if (!string.IsNullOrWhiteSpace(client.FocusCategory))
                lines.Add($"focus_category: {client.FocusCategory}");
            if (client.FocusElapsedMinutes > 0)
                lines.Add($"focus_elapsed_minutes: {client.FocusElapsedMinutes}");
        }

        if (gantt != null)
        {
            var s = gantt.StartTime!.Value.AddHours(8);
            var e = gantt.EndTime!.Value.AddHours(8);
            lines.Add($"gantt_block_now: \"{gantt.Title}\" {s:HH:mm}–{e:HH:mm} MYT");
        }
        else
        {
            lines.Add("gantt_block_now: none");
        }

        return string.Join("\n", lines);
    }

    private static bool IsInTaskStartingWindow(DateTime startUtc, DateTime nowUtc)
    {
        var until = TaskTimeHelper.MinutesOfDayMyt(startUtc) - TaskTimeHelper.MinutesOfDayMyt(nowUtc);
        return until <= 2 && until >= -2;
    }

    private async Task<string> GenerateNagAsync(int userId, AgentProfile profile, string trigger, string context)
    {
        var kernel = _kernelFactory.CreateKernel(userId);
        var study = await KernelPluginHelper.InvokeAsync(kernel, "Study", "get_study_summary");
        var userPrompt = trigger switch
        {
            "DayBrief" => $"""
                Generate a daily briefing for the student.
                Context: {context}
                Live data: {study}
                Use ── Section ── headers and • bullets. Be concise but cover all sections in the context.
                {PlainTextFormatter.OutputRules}
                """,
            "TaskStarting" => $"""
                Generate a short pre-start reminder (1-2 sentences) for the student.
                Context: {context}
                Live data: {study}
                Be encouraging and direct. No questions.
                {PlainTextFormatter.OutputRules}
                """,
            "TaskEnded" => $"""
                Generate a short end-of-block check-in (1-2 sentences).
                Context: {context}
                Live data: {study}
                Ask whether they completed the task. The UI will show Done / Not yet buttons.
                {PlainTextFormatter.OutputRules}
                """,
            "Nagging" => $"""
                Write a casual check-in message (1–2 sentences) as if you are chatting with the student in a small speech bubble.
                Use the situation notes below ONLY to decide what to say — never quote field names, never list stats, never mention "Pomodoro", "Gantt", "focus_session", or "minutes logged".
                Sound natural and warm (match your persona). No bullet lists, no section headers, no questions unless one gentle rhetorical question fits.
                If they are focusing: acknowledge it briefly. If they have been working a while: suggest a rest. If idle: a gentle nudge. Do not invent tasks or numbers not in the notes.

                [Situation — internal, do not repeat verbatim]
                {context}

                [Study summary — internal]
                {study}
                """,
            _ => $"""
                Generate a SHORT nag message (1-3 sentences) for trigger: {trigger}.
                Context: {context}
                Live data: {study}
                Do not ask questions. Be direct.
                {PlainTextFormatter.OutputRules}
                """
        };

        var text = await CoachLlmHelper.TryCompleteAsync(
            kernel, _kernelFactory, profile.SystemPrompt, userPrompt, _logger, $"Trigger:{trigger}",
            _kernelFactory.ProviderDisplayName);
        if (text != null) return text;

        _logger.LogWarning("Using fallback text for trigger {Trigger} ({Provider} returned nothing or errored)", trigger, _kernelFactory.ProviderDisplayName);
        return FallbackNag(profile.Key, trigger, context);
    }

    private static string FallbackNag(string? key, string trigger, string context)
    {
        if (trigger == "Nagging")
            return NaggingFallback(key, context);

        return key switch
        {
            "Soft" => "It's okay — let's take one small step together. You've got this 🌷",
            "Harsh" => "No excuses. Pick the next thing and move 👑",
            _ => "Keep going — one task at a time."
        };
    }

    private static string Pick(params string[] options) => options[Random.Shared.Next(options.Length)];

    private static string NaggingFallback(string? key, string context)
    {
        var focusing = context.Contains("focus_session_active: yes", StringComparison.OrdinalIgnoreCase);
        var mins = 0;
        var m = System.Text.RegularExpressions.Regex.Match(context, @"today_focus_minutes:\s*(\d+)");
        if (m.Success) int.TryParse(m.Groups[1].Value, out mins);
        var gantt = System.Text.RegularExpressions.Regex.Match(context, @"gantt_block_now:\s*""([^""]+)""");
        var taskMatch = System.Text.RegularExpressions.Regex.Match(context, @"focus_task:\s*(.+)");
        var focusTask = taskMatch.Success ? taskMatch.Groups[1].Value.Trim() : null;
        if (focusTask is "(none — category only)" or "(none)") focusTask = null;

        if (focusing && !string.IsNullOrEmpty(focusTask))
        {
            return key switch
            {
                "Soft" => Pick(
                    $"You're in the flow with \"{focusTask}\" — beautiful work. Remember to breathe 🌷",
                    $"Lovely focus on \"{focusTask}\". Stay gentle with yourself 💗",
                    $"\"{focusTask}\" has your attention — that's wonderful. One step at a time 🌷"),
                "Harsh" => Pick(
                    $"Good — stay on \"{focusTask}\" until the block ends. No drifting 👑",
                    $"\"{focusTask}\" is active. Execute, don't wander 👑"),
                _ => Pick(
                    $"Solid focus on \"{focusTask}\". Keep the momentum going.",
                    $"Locked in on \"{focusTask}\" — stay with it.")
            };
        }

        if (focusing)
        {
            return key switch
            {
                "Soft" => Pick(
                    "I see you're in a focus session — gentle pace, you're doing well 💗",
                    "Your focus timer is running — proud of you for showing up 🌷",
                    "Deep work mode on — be kind to yourself while you push 💗"),
                "Harsh" => Pick(
                    "Focus mode is on. Finish the block before you wander 👑",
                    "Timer's running. No tabs, no excuses 👑"),
                _ => Pick(
                    "Focus session running — stay with it.",
                    "You're in a focus block. Keep going.")
            };
        }

        if (gantt.Success)
        {
            var title = gantt.Groups[1].Value;
            return key switch
            {
                "Soft" => Pick(
                    $"It's time for \"{title}\" — ease in when you're ready 🌷",
                    $"\"{title}\" is on your schedule now — you've got this 💗",
                    $"Your \"{title}\" block is here. Start softly when you feel ready 🌷"),
                "Harsh" => Pick(
                    $"\"{title}\" is on the clock. Get started 👑",
                    $"\"{title}\" — begin now 👑"),
                _ => Pick(
                    $"Your scheduled block \"{title}\" is underway.",
                    $"Time for \"{title}\" on the Gantt.")
            };
        }

        if (mins >= 90)
        {
            return key switch
            {
                "Soft" => Pick(
                    "You've put in a lot of heart today — maybe stretch and sip some water 💗",
                    "What a full day — a short break would be a gift to yourself 🌷",
                    "You've been working hard — rest your eyes and shoulders for a minute 💗"),
                "Harsh" => Pick(
                    $"{mins} minutes logged. Push if you must, but don't burn out 👑",
                    "Long session today. Hydrate, then decide your next move 👑"),
                _ => Pick(
                    $"Strong day so far ({mins} min). Take a short break if you need one.",
                    $"{mins} minutes in — pace yourself for the rest of the day.")
            };
        }

        return key switch
        {
            "Soft" => Pick(
                "Just checking in — however today is going, one small step still counts 🌷",
                "Hi there — you're doing better than you think 💗",
                "A little hello — pick one tiny thing and begin gently 🌷"),
            "Harsh" => Pick(
                "Still here? Pick something small and execute 👑",
                "Clock's ticking. What's the next concrete action? 👑"),
            _ => Pick(
                "Quick check-in — ready for your next block when you are.",
                "Checking in — what's your next move?")
        };
    }
}
