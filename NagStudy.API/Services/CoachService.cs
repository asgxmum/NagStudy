using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using NagStudy.API.Data;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;

namespace NagStudy.API.Services;

public class CoachService
{
    private readonly NagStudyContext _db;
    private readonly CoachKernelFactory _kernelFactory;
    private readonly RagService _rag;
    private const int MaxContextMessages = 40;

    const string AgentToolInstructions = """
        CONVERSATION STYLE:
        - Match the user's intent. Greetings/small talk → reply naturally; do NOT dump today's focus minutes or task lists unless they ask.
        - You may answer study questions, work/career questions, and general knowledge — not only study stats.
        - Weave in known user facts (below) only when relevant. Never recite every fact you know in one reply.
        - Vary phrasing; avoid opening every reply with "today you studied..." or similar templates.

        TOOLS (call when you need data not already in context below):
        - Analytics-search_task_history: tasks in a date range (MYT) — default last 7 days if user gives no dates
        - Analytics-get_summary_information: performance summary for a date range
        - Analytics-get_relevant_information: semantic search over completed tasks, activities, chats, reports
        - Study-get_pending_tasks: current open tasks

        TASK QUESTIONS (mandatory):
        - When the user asks about 任务/耗时/完成情况/做了什么/刚才那些任务 — answer from REAL task data via tools or the pre-fetched / cached task blocks below.
        - Do NOT say "we didn't discuss tasks in this chat". Their tasks live in the app database, not only in chat text.
        - For duration comparisons (e.g. 哪个耗时最长), use start/end/duration fields from task data.

        TOOL CACHE RULES:
        - "Tool data already fetched this session" and "Pre-fetched task history" blocks are authoritative — reuse them.
        - Do NOT call search_task_history again if equivalent data is already cached for the same period.
        - Call get_relevant_information for personal facts or semantic recall not covered by task history cache.

        ACTIVITY MEMORY (optional):
        When you learn something worth remembering long-term (habits, identity, location, job, recurring preferences), append ONE block:
        <ActivitySummery>one concise sentence in the user's language</ActivitySummery>
        Only when genuinely useful. Most replies should NOT include this tag.
        """;

    public CoachService(NagStudyContext db, CoachKernelFactory kernelFactory, RagService rag)
    {
        _db = db;
        _kernelFactory = kernelFactory;
        _rag = rag;
    }

    public async Task<List<ProfileResponse>> ListProfilesAsync()
    {
        var builtIn = await _db.AgentProfiles.Where(p => p.IsBuiltIn).OrderBy(p => p.Id).ToListAsync();
        return builtIn.Select(MapProfile).ToList();
    }

    public async Task<SessionResponse> CreateSessionAsync(int userId, int profileId)
    {
        var profile = await ResolveProfileAsync(profileId);
        var session = new ChatSession
        {
            UserId = userId,
            ProfileId = profile.Id,
            Title = "New chat",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.ChatSessions.Add(session);
        await _db.SaveChangesAsync();
        return MapSession(session, profile, null);
    }

    public async Task<List<SessionResponse>> ListSessionsAsync(int userId)
    {
        var sessions = await _db.ChatSessions
            .Include(s => s.Profile)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.UpdatedAt)
            .ToListAsync();

        var result = new List<SessionResponse>();
        foreach (var s in sessions)
        {
            var lastMsg = await _db.ChatMessages
                .Where(m => m.SessionId == s.Id)
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => new { m.Role, m.Content })
                .FirstOrDefaultAsync();
            var last = lastMsg?.Role == "Assistant"
                ? LlmCompat.NormalizeAssistantText(lastMsg.Content)
                : lastMsg?.Content;
            var preview = last != null && last.Length > 80 ? last[..80] + "…" : last;
            result.Add(MapSession(s, s.Profile, preview));
        }
        return result;
    }

    public async Task<bool> DeleteSessionAsync(int userId, int sessionId)
    {
        var session = await _db.ChatSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        if (session == null) return false;
        _db.ChatSessions.Remove(session);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<SessionResponse?> UpdateSessionTitleAsync(int userId, int sessionId, string title)
    {
        var trimmed = title.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
            throw new InvalidOperationException("Title is required.");

        if (trimmed.Length > 80)
            trimmed = trimmed[..80];

        var session = await _db.ChatSessions
            .Include(s => s.Profile)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        if (session == null) return null;

        session.Title = trimmed;
        session.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var lastMsg = await _db.ChatMessages
            .Where(m => m.SessionId == sessionId)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => new { m.Role, m.Content })
            .FirstOrDefaultAsync();
        var last = lastMsg?.Role == "Assistant"
            ? LlmCompat.NormalizeAssistantText(lastMsg.Content)
            : lastMsg?.Content;
        var preview = last != null && last.Length > 80 ? last[..80] + "…" : last;

        return MapSession(session, session.Profile, preview);
    }

    public async Task<List<ChatMessageResponse>> GetMessagesAsync(int userId, int sessionId)
    {
        var session = await _db.ChatSessions.FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);
        if (session == null) throw new UnauthorizedAccessException("Session not found.");

        var rows = await _db.ChatMessages
            .Where(m => m.SessionId == sessionId && m.Role != "Tool")
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        return rows.Select(m => new ChatMessageResponse
        {
            Id = m.Id,
            Role = m.Role,
            MessageType = m.MessageType,
            Content = m.Role == "Assistant"
                ? LlmCompat.NormalizeAssistantText(m.Content)
                : m.Content,
            CreatedAt = m.CreatedAt
        }).ToList();
    }

    public async Task<ChatReplyResponse> ChatAsync(int userId, int sessionId, string message)
    {
        var session = await _db.ChatSessions
            .Include(s => s.Profile)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId)
            ?? throw new UnauthorizedAccessException("Session not found.");

        var userMsg = new ChatMessage
        {
            SessionId = sessionId,
            Role = "User",
            MessageType = "Chat",
            Content = message.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        _db.ChatMessages.Add(userMsg);
        await _db.SaveChangesAsync();

        _rag.IndexDocumentFireAndForget(userId, "ChatMessage", userMsg.Id, RagService.FormatChatMessage(userMsg));

        var history = await _db.ChatMessages
            .Where(m => m.SessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var rawReply = await GenerateAgentReplyAsync(userId, sessionId, session.Profile, history);
        var activitySummary = LlmCompat.ExtractActivitySummary(rawReply);
        var reply = LlmCompat.NormalizeAssistantText(rawReply);

        var assistantMsg = new ChatMessage
        {
            SessionId = sessionId,
            Role = "Assistant",
            MessageType = "Chat",
            Content = reply,
            CreatedAt = DateTime.UtcNow
        };
        _db.ChatMessages.Add(assistantMsg);

        if (session.Title == "New chat")
            session.Title = message.Length > 40 ? message[..40] + "…" : message;
        session.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (activitySummary != null)
            await SaveUserActivityAsync(userId, activitySummary, assistantMsg.Id);

        _rag.IndexDocumentFireAndForget(userId, "ChatMessage", assistantMsg.Id, RagService.FormatChatMessage(assistantMsg));

        return new ChatReplyResponse
        {
            Reply = reply,
            UserMessageId = userMsg.Id,
            AssistantMessageId = assistantMsg.Id
        };
    }

    public async Task<ChatReplyResponse> GenerateReportAsync(int userId, int sessionId, ReportRequest req)
    {
        var session = await _db.ChatSessions
            .Include(s => s.Profile)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId)
            ?? throw new UnauthorizedAccessException("Session not found.");

        var (start, end) = ResolvePeriod(req);
        var startStr = start.AddHours(8).ToString("yyyy-MM-dd");
        var endStr = end.AddHours(8).ToString("yyyy-MM-dd");

        var snapshotKernel = _kernelFactory.CreateKernel(userId);
        var studyData = await KernelPluginHelper.InvokeAsync(snapshotKernel, "Study", "get_study_summary");

        var agentKernel = _kernelFactory.CreateAgentKernel(userId);
        var periodSummary = await KernelPluginHelper.InvokeAsync(agentKernel, "Analytics", "get_summary_information",
            new KernelArguments { ["startDate"] = startStr, ["endDate"] = endStr });
        var taskHistory = await KernelPluginHelper.InvokeAsync(agentKernel, "Analytics", "search_task_history",
            new KernelArguments { ["startDate"] = startStr, ["endDate"] = endStr });

        var prompt = $"""
            Generate a detailed study performance report in {req.Language}.
            Period: {startStr} to {endStr} (MYT)

            {PlainTextFormatter.OutputRules}

            Required sections (each as ── Section ── then • bullets):
            ── Focus overview ──
            ── Task completion ──
            ── Patterns ──
            ── AI observations ──
            ── Next-week suggestions ──

            Use ONLY real data below. Do not invent numbers.

            === Today/week snapshot (manual) ===
            {studyData}

            === Period summary ===
            {periodSummary}

            === Task history in period ===
            {taskHistory}
            """;

        var reply = await InvokeLlmAsync(snapshotKernel, session.Profile.SystemPrompt, prompt);

        var userMsg = new ChatMessage
        {
            SessionId = sessionId,
            Role = "User",
            MessageType = "Report",
            Content = $"[Report request] Period: {req.Period}, Language: {req.Language}",
            CreatedAt = DateTime.UtcNow
        };
        var assistantMsg = new ChatMessage
        {
            SessionId = sessionId,
            Role = "Assistant",
            MessageType = "Report",
            Content = reply,
            CreatedAt = DateTime.UtcNow
        };
        _db.ChatMessages.AddRange(userMsg, assistantMsg);

        _db.SummaryReports.Add(new SummaryReport
        {
            UserId = userId,
            SessionId = sessionId,
            ProfileId = session.ProfileId,
            PeriodStart = start,
            PeriodEnd = end,
            Language = req.Language,
            Content = reply,
            CreatedAt = DateTime.UtcNow
        });

        session.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var reportId = await _db.SummaryReports
            .Where(r => r.SessionId == sessionId)
            .OrderByDescending(r => r.Id)
            .Select(r => r.Id)
            .FirstAsync();
        _rag.IndexDocumentFireAndForget(userId, "Report", reportId, reply);

        return new ChatReplyResponse
        {
            Reply = reply,
            UserMessageId = userMsg.Id,
            AssistantMessageId = assistantMsg.Id
        };
    }

    async Task SaveUserActivityAsync(int userId, string summary, int sourceMessageId)
    {
        var activity = new UserActivity
        {
            UserId = userId,
            Summary = summary.Trim(),
            RecordedAt = DateTime.UtcNow,
            SourceMessageId = sourceMessageId
        };
        _db.UserActivities.Add(activity);
        await _db.SaveChangesAsync();
        _rag.IndexDocumentFireAndForget(userId, "Activity", activity.Id, RagService.FormatActivity(activity));
    }

    async Task<string> GenerateAgentReplyAsync(int userId, int sessionId, AgentProfile profile, List<ChatMessage> history)
    {
        var kernel = _kernelFactory.CreateAgentKernel(userId);
        var chat = kernel.GetRequiredService<IChatCompletionService>();

        var userMemory = await BuildUserMemoryContextAsync(userId);
        var toolCache = BuildToolCacheContext(history);

        var latestUserMsg = history.LastOrDefault(m => m.Role == "User")?.Content ?? "";
        var prefetchedTasks = await PrefetchTaskHistoryIfNeededAsync(
            sessionId, kernel, history, toolCache, latestUserMsg);
        if (prefetchedTasks != null)
            toolCache = AppendToolCacheBlock(toolCache, prefetchedTasks);

        var systemPrompt = $"""
            {profile.SystemPrompt}

            {PlainTextFormatter.OutputRules}

            {AgentToolInstructions}

            {userMemory}

            {toolCache}
            """;

        var chatHistory = new ChatHistory();
        chatHistory.AddSystemMessage(systemPrompt);

        foreach (var msg in history.Where(m => m.Role is "User" or "Assistant").TakeLast(MaxContextMessages))
        {
            var content = msg.Role == "Assistant"
                ? LlmCompat.NormalizeAssistantText(msg.Content)
                : msg.Content;
            if (string.IsNullOrWhiteSpace(content)) continue;

            if (msg.Role == "User")
                chatHistory.AddUserMessage(content);
            else
                chatHistory.AddAssistantMessage(content);
        }

        try
        {
            var settings = _kernelFactory.CreateChatSettings(enableTools: true);
            var recorder = CoachToolScope.Begin();
            try
            {
                var result = await chat.GetChatMessageContentAsync(chatHistory, settings, kernel);
                var raw = result.Content ?? "";
                if (string.IsNullOrWhiteSpace(LlmCompat.StripInternalTags(raw)))
                    throw new InvalidOperationException("LLM returned an empty response.");

                foreach (var tool in recorder.Records)
                {
                    _db.ChatMessages.Add(new ChatMessage
                    {
                        SessionId = sessionId,
                        Role = "Tool",
                        MessageType = "ToolResult",
                        Content = ToolInvocationRecorder.FormatRecord(tool),
                        CreatedAt = DateTime.UtcNow
                    });
                }

                if (recorder.Records.Count > 0)
                    await _db.SaveChangesAsync();

                return raw;
            }
            finally
            {
                CoachToolScope.Clear();
            }
        }
        catch (InvalidOperationException) { throw; }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"{_kernelFactory.ProviderDisplayName} is temporarily unavailable. Please try again.", ex);
        }
    }

    static string BuildToolCacheContext(List<ChatMessage> history)
    {
        var toolMsgs = history.Where(m => m.Role == "Tool").TakeLast(6).ToList();
        if (toolMsgs.Count == 0) return "";
        return FormatToolCacheBlock(string.Join("\n---\n", toolMsgs.Select(m => m.Content.Trim())));
    }

    static string FormatToolCacheBlock(string body) =>
        $"""
            === Tool data already fetched this session (reuse; do not repeat the same search) ===
            {body}
            ===
            """;

    static string AppendToolCacheBlock(string existing, string newBlock) =>
        string.IsNullOrWhiteSpace(existing) ? newBlock : $"{existing}\n{newBlock}";

    async Task<string?> PrefetchTaskHistoryIfNeededAsync(
        int sessionId,
        Kernel kernel,
        List<ChatMessage> history,
        string existingCache,
        string latestUserMessage)
    {
        if (!CoachQueryHelper.NeedsTaskData(latestUserMessage))
            return null;
        if (CoachQueryHelper.HasCachedTaskHistory(history) ||
            existingCache.Contains("search_task_history", StringComparison.OrdinalIgnoreCase))
            return null;

        var endMyt = DateTime.UtcNow.AddHours(8).Date;
        var startMyt = endMyt.AddDays(-7);
        var taskData = await KernelPluginHelper.InvokeAsync(kernel, "Analytics", "search_task_history",
            new KernelArguments
            {
                ["startDate"] = startMyt.ToString("yyyy-MM-dd"),
                ["endDate"] = endMyt.ToString("yyyy-MM-dd")
            });

        var record = ToolInvocationRecorder.FormatRecord(
            new ToolInvocationRecord("Analytics-search_task_history",
                $"startDate={startMyt:yyyy-MM-dd}, endDate={endMyt:yyyy-MM-dd}", taskData));

        _db.ChatMessages.Add(new ChatMessage
        {
            SessionId = sessionId,
            Role = "Tool",
            MessageType = "ToolResult",
            Content = record,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return FormatToolCacheBlock(record);
    }

    async Task<string> BuildUserMemoryContextAsync(int userId)
    {
        var activities = await _db.UserActivities
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.RecordedAt)
            .Take(8)
            .ToListAsync();

        if (activities.Count == 0) return "";

        var lines = activities.Select(a =>
            $"• [{a.RecordedAt.AddHours(8):yyyy-MM-dd}] {a.Summary.Trim()}");
        return $"""
            === Known facts about this user (from past conversations — use naturally when relevant) ===
            {string.Join("\n", lines)}
            ===
            """;
    }

    private async Task<string> InvokeLlmAsync(Kernel kernel, string systemPrompt, string userPrompt)
    {
        try
        {
            var chat = kernel.GetRequiredService<IChatCompletionService>();
            var history = new ChatHistory(systemPrompt);
            history.AddUserMessage(userPrompt);
            var settings = _kernelFactory.CreateChatSettings();
            var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
            var text = LlmCompat.NormalizeAssistantText(result.Content);
            return text.Length > 0 ? text : "I'm having trouble responding right now. Please try again.";
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"{_kernelFactory.ProviderDisplayName} is temporarily unavailable. Please try again.", ex);
        }
    }

    private static (DateTime start, DateTime end) ResolvePeriod(ReportRequest req)
    {
        var nowMyt = DateTime.UtcNow.AddHours(8).Date;
        return req.Period switch
        {
            "7days" => (nowMyt.AddDays(-7).AddHours(-8), DateTime.UtcNow),
            "30days" => (nowMyt.AddDays(-30).AddHours(-8), DateTime.UtcNow),
            "custom" when req.From.HasValue && req.To.HasValue => (req.From.Value, req.To.Value),
            _ => (GetWeekStartUtc(), DateTime.UtcNow)
        };
    }

    private static DateTime GetWeekStartUtc()
    {
        var nowMyt = DateTime.UtcNow.AddHours(8);
        int daysSinceMonday = ((int)nowMyt.DayOfWeek + 6) % 7;
        return nowMyt.Date.AddDays(-daysSinceMonday).AddHours(-8);
    }

    private async Task<AgentProfile> ResolveProfileAsync(int profileId)
    {
        var p = await _db.AgentProfiles.FirstOrDefaultAsync(x => x.Id == profileId && x.IsBuiltIn);
        if (p == null) throw new InvalidOperationException("Profile not found.");
        return p;
    }

    private static ProfileResponse MapProfile(AgentProfile p) => new()
    {
        Id = p.Id,
        Key = p.Key,
        Name = p.Name,
        Description = p.Description,
        SystemPrompt = p.SystemPrompt,
        Color = p.Color,
        IsBuiltIn = p.IsBuiltIn
    };

    private static SessionResponse MapSession(ChatSession s, AgentProfile p, string? preview) => new()
    {
        Id = s.Id,
        Title = s.Title,
        ProfileId = p.Id,
        ProfileName = p.Name,
        ProfileKey = p.Key,
        ProfileColor = p.Color,
        ProfileAvatarUrl = p.AvatarUrl,
        CreatedAt = s.CreatedAt,
        UpdatedAt = s.UpdatedAt,
        LastMessagePreview = preview
    };
}
