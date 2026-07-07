using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.Google;
using NagStudy.API.Data;
using NagStudy.API.Infrastructure;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;

namespace NagStudy.API.Services;

public class CoachService
{
    private readonly NagStudyContext _db;
    private readonly CoachKernelFactory _kernelFactory;
    private readonly CoachReportGenerator _reportGenerator;
    private readonly RagService _rag;
    private const int MaxContextMessages = 40;
    private const int MaxAgentToolRounds = 8;

    const string AgentToolInstructions = """
        CONVERSATION STYLE:
        - Match the user's intent. Greetings/small talk → reply naturally; do NOT dump task lists unless they ask.
        - You may answer study, career, and general questions — not only study stats.
        - Weave in known user Insights (below) only when relevant. Never recite every fact in one reply.
        - Vary phrasing; avoid templated openings.

        TOOLS (call when needed; you may call multiple tools across rounds until you can answer):
        - Analytics-get_tasks: tasks **planned on** a MYT day (ScheduledDate — same as Yesterday Review). Gantt StartTime is time-of-day only.
        - Analytics-get_summary_information: focus + completion stats for a range (not a narrative report).
        - Analytics-get_summary_report: full narrative report when user wants 总结/复盘/report.
        - Analytics-get_relevant_information: semantic search over saved user Insights (demographics, education, career, habits, etc.).

        DATE RULES (mandatory):
        - 今天/昨天/明天/yesterday/today map to the MYT dates in "Current time" above.
        - Never invent calendar dates. If user says 昨天, call get_tasks with yesterday or its yyyy-MM-dd.

        TASK QUESTIONS (mandatory):
        - Answer from get_tasks or cached tool data — never invent task names, times, or counts.
        - For duration comparisons, use start/end/duration from get_tasks.

        TOOL CACHE:
        - Reuse "Tool data already fetched this session" — do not repeat the same get_tasks date range.

        INSIGHT MEMORY (atomic — multiple tags allowed):
        When the user shares durable personal facts, append one or more hidden blocks at the end of your reply.
        Each block = ONE atomic fact — never combine age + gender + school + major in one tag.
        Pick the correct category:
        • demographic — age OR gender only (e.g. 20岁, 男生) — never "20岁男生"
        • education — school OR major only (e.g. 厦门大学, 软件工程专业) — never "我是厦门大学"
        • job — employment, internship, job title (NOT student status)
        • location — where they live or study
        • habit | interest | preference — routines, hobbies, likes
        • other — only if nothing else fits

        Format (repeat per fact):
        <Insight category="demographic|education|job|location|habit|interest|preference|other">single atomic fact in user's language</Insight>

        Example for "厦大20岁男生软工专业":
        <Insight category="demographic">20岁</Insight>
        <Insight category="demographic">男生</Insight>
        <Insight category="education">厦门大学</Insight>
        <Insight category="education">软件工程专业</Insight>

        NEVER save: questions (…吗/呢/?), coach guesses, legal-age speculation, task status, moods, or get_tasks data.
        Saying "记下来" without these tags does NOT save anything.
        For age/identity/background questions, check Known Insights below or call get_relevant_information first.
        """;

    public CoachService(NagStudyContext db, CoachKernelFactory kernelFactory, CoachReportGenerator reportGenerator, RagService rag)
    {
        _db = db;
        _kernelFactory = kernelFactory;
        _reportGenerator = reportGenerator;
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
            .Where(m => m.SessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        return rows
            .Where(m => m.Role != "Tool" || m.MessageType == "ToolResult")
            .Select(m => new ChatMessageResponse
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

        var history = await _db.ChatMessages
            .Where(m => m.SessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var generation = await GenerateAgentReplyAsync(userId, sessionId, session.Profile, history);
        var rawReply = generation.Raw;
        var insights = LlmCompat.CombineInsightsFromExchange(message, rawReply);
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

        if (insights.Count > 0)
            await SaveUserInsightsAsync(userId, insights, assistantMsg.Id);

        return new ChatReplyResponse
        {
            Reply = reply,
            UserMessageId = userMsg.Id,
            AssistantMessageId = assistantMsg.Id,
            AgentSteps = generation.Steps,
            ToolMessages = generation.ToolMessages,
        };
    }

    public async Task<List<InsightResponse>> ListInsightsAsync(int userId)
    {
        var rows = await _db.UserInsights
            .Where(i => i.UserId == userId)
            .OrderByDescending(i => i.RecordedAt)
            .ToListAsync();
        return rows.Select(MapInsight).ToList();
    }

    public async Task<InsightResponse> CreateInsightAsync(int userId, CreateInsightRequest req)
    {
        var summary = req.Summary.Trim();
        if (string.IsNullOrWhiteSpace(summary))
            throw new InvalidOperationException("Summary is required.");

        var insight = new UserInsight
        {
            UserId = userId,
            Category = InsightCategories.Normalize(req.Category),
            Summary = summary,
            RecordedAt = DateTime.UtcNow,
        };
        _db.UserInsights.Add(insight);
        await _db.SaveChangesAsync();
        _rag.IndexInsightFireAndForget(userId, insight.Id, RagService.FormatInsight(insight));
        return MapInsight(insight);
    }

    public async Task<bool> DeleteInsightAsync(int userId, int insightId)
    {
        var insight = await _db.UserInsights.FirstOrDefaultAsync(i => i.Id == insightId && i.UserId == userId);
        if (insight == null) return false;
        _db.UserInsights.Remove(insight);
        await _db.SaveChangesAsync();
        _rag.DeleteInsightFireAndForget(userId, insightId);
        return true;
    }

    static InsightResponse MapInsight(UserInsight i) => new()
    {
        Id = i.Id,
        Category = i.Category,
        Summary = i.Summary,
        RecordedAt = i.RecordedAt,
        SourceMessageId = i.SourceMessageId,
    };

    public async Task<ChatReplyResponse> GenerateReportAsync(int userId, int sessionId, ReportRequest req)
    {
        var session = await _db.ChatSessions
            .Include(s => s.Profile)
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId)
            ?? throw new UnauthorizedAccessException("Session not found.");

        var (start, end) = CoachReportGenerator.ResolvePeriod(req.Period, req.From, req.To);
        var reply = await _reportGenerator.GenerateAsync(
            userId, req.Period, req.Language, session.Profile.SystemPrompt);

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

        return new ChatReplyResponse
        {
            Reply = reply,
            UserMessageId = userMsg.Id,
            AssistantMessageId = assistantMsg.Id
        };
    }

    async Task SaveUserInsightsAsync(int userId, IReadOnlyList<(string Category, string Text)> insights, int sourceMessageId)
    {
        foreach (var (rawCategory, text) in insights)
        {
            var validated = LlmCompat.ValidateInsight(rawCategory, text);
            if (validated == null) continue;
            var (category, summary) = validated.Value;
            if (await _db.UserInsights.AnyAsync(i =>
                    i.UserId == userId && i.Category == category && i.Summary == summary))
                continue;

            var insight = new UserInsight
            {
                UserId = userId,
                Category = category,
                Summary = summary,
                RecordedAt = DateTime.UtcNow,
                SourceMessageId = sourceMessageId
            };
            _db.UserInsights.Add(insight);
            await _db.SaveChangesAsync();
            _rag.IndexInsightFireAndForget(userId, insight.Id, RagService.FormatInsight(insight));
        }
    }

    sealed class AgentGenerationResult
    {
        public string Raw { get; init; } = "";
        public List<AgentStepResponse> Steps { get; init; } = new();
        public List<ChatMessageResponse> ToolMessages { get; init; } = new();
    }

    async Task<AgentGenerationResult> GenerateAgentReplyAsync(int userId, int sessionId, AgentProfile profile, List<ChatMessage> history)
    {
        var kernel = _kernelFactory.CreateAgentKernel(userId);
        var chat = kernel.GetRequiredService<IChatCompletionService>();

        var insightContext = await BuildUserInsightContextAsync(userId);
        var toolCache = BuildToolCacheContext(history);

        var systemPrompt = $"""
            {profile.SystemPrompt}

            {PlainTextFormatter.OutputRules}

            {AgentToolInstructions}

            {TaskTimeHelper.FormatMytClockContext()}

            {insightContext}

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
            var settings = _kernelFactory.CreateChatSettings(enableTools: true, autoInvokeTools: false);
            var recorder = CoachToolScope.Begin();
            try
            {
                var raw = await RunAgentToolLoopAsync(chat, chatHistory, settings, kernel, recorder);
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

                var toolMsgs = await _db.ChatMessages
                    .Where(m => m.SessionId == sessionId && m.Role == "Tool")
                    .OrderByDescending(m => m.CreatedAt)
                    .Take(recorder.Records.Count)
                    .ToListAsync();

                return new AgentGenerationResult
                {
                    Raw = raw,
                    Steps = BuildAgentSteps(recorder, raw),
                    ToolMessages = toolMsgs
                        .OrderBy(m => m.CreatedAt)
                        .Select(m => new ChatMessageResponse
                        {
                            Id = m.Id,
                            Role = m.Role,
                            MessageType = m.MessageType,
                            Content = m.Content,
                            CreatedAt = m.CreatedAt,
                        })
                        .ToList(),
                };
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

    static async Task<string> RunAgentToolLoopAsync(
        IChatCompletionService chat,
        ChatHistory chatHistory,
        PromptExecutionSettings settings,
        Kernel kernel,
        ToolInvocationRecorder _)
    {
        string? lastText = null;
        for (var round = 0; round < MaxAgentToolRounds; round++)
        {
            var result = await chat.GetChatMessageContentAsync(chatHistory, settings, kernel);
            lastText = result.Content;

            var functionCalls = result.Items.OfType<FunctionCallContent>().ToList();
            if (functionCalls.Count == 0)
                return result.Content ?? "";

            chatHistory.Add(result);
            foreach (var call in functionCalls)
            {
                try
                {
                    var fnResult = await call.InvokeAsync(kernel);
                    chatHistory.Add(fnResult.ToChatMessage());
                }
                catch (Exception ex)
                {
                    chatHistory.Add(new FunctionResultContent(call, ex).ToChatMessage());
                }
            }
        }

        return lastText ?? "";
    }

    static string BuildToolCacheContext(List<ChatMessage> history)
    {
        var toolMsgs = history.Where(m => m.Role == "Tool").TakeLast(6).ToList();
        if (toolMsgs.Count == 0) return "";
        return FormatToolCacheBlock(string.Join("\n---\n", toolMsgs.Select(m => m.Content.Trim())));
    }

    static List<AgentStepResponse> BuildAgentSteps(ToolInvocationRecorder recorder, string raw)
    {
        var steps = new List<AgentStepResponse>();
        var thinking = LlmCompat.ExtractReasoningText(raw);
        if (!string.IsNullOrWhiteSpace(thinking))
        {
            steps.Add(new AgentStepResponse
            {
                Type = "thinking",
                Content = thinking.Length > 600 ? thinking[..600] + "…" : thinking,
            });
        }

        foreach (var r in recorder.Records)
        {
            steps.Add(new AgentStepResponse
            {
                Type = "tool",
                ToolName = r.ToolName,
                Arguments = r.Arguments,
                ResultPreview = PreviewToolResult(r.Result),
            });
        }
        return steps;
    }

    static string PreviewToolResult(string result, int max = 320)
    {
        var t = (result ?? "").Trim();
        return t.Length <= max ? t : t[..max] + "…";
    }

    static string FormatToolCacheBlock(string body) =>
        $"""
            === Tool data already fetched this session (reuse; do not repeat the same search) ===
            {body}
            ===
            """;

    async Task<string> BuildUserInsightContextAsync(int userId)
    {
        var insights = await _db.UserInsights
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.RecordedAt)
            .Take(15)
            .ToListAsync();

        if (insights.Count == 0) return "";

        var lines = insights.Select(a =>
            $"• [{a.Category}] [{a.RecordedAt.AddHours(8):yyyy-MM-dd}] {a.Summary.Trim()}");
        return $"""
            === Known Insights about this user (from past conversations — use naturally when relevant) ===
            {string.Join("\n", lines)}
            ===
            """;
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
