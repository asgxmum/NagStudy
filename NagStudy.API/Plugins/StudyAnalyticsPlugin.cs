using System.ComponentModel;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using NagStudy.API.Data;
using NagStudy.API.Infrastructure;
using NagStudy.API.Models.Domain;
using NagStudy.API.Services;

namespace NagStudy.API.Plugins;

/// <summary>Agent-callable analytics, task query, insight RAG, and report tools.</summary>
public class StudyAnalyticsPlugin
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly int _userId;

    public StudyAnalyticsPlugin(IServiceScopeFactory scopeFactory, int userId)
    {
        _scopeFactory = scopeFactory;
        _userId = userId;
    }

    [KernelFunction("get_tasks")]
    [Description("List tasks planned on MYT date(s) by ScheduledDate (same as Yesterday Review). startDate/endDate: yyyy-MM-dd or today|yesterday|tomorrow. Gantt times shown but do not change the planned day.")]
    public async Task<string> GetTasksAsync(
        [Description("Start date yyyy-MM-dd (MYT), or today/yesterday/tomorrow")] string startDate,
        [Description("End date (same formats); omit for single day")] string? endDate = null,
        [Description("Filter: all (default), done, or pending")] string? status = null)
    {
        if (!TaskTimeHelper.TryParseMytDateInput(startDate, out var start))
            return "Invalid startDate. Use yyyy-MM-dd or today/yesterday/tomorrow.";

        var end = endDate != null && TaskTimeHelper.TryParseMytDateInput(endDate, out var parsedEnd) ? parsedEnd : start;
        if (end < start) (start, end) = (end, start);

        var filter = (status ?? "all").Trim().ToLowerInvariant();

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();

        var tasks = await db.Tasks.Where(t => t.UserId == _userId).ToListAsync();

        var matched = tasks
            .Where(t => TaskTimeHelper.BelongsToPlannedMytRange(t, start, end))
            .Where(t =>
            {
                if (filter == "done") return TaskRagFormatter.IsDone(t);
                if (filter == "pending") return !TaskRagFormatter.IsDone(t);
                return true;
            })
            .OrderBy(t => t.ScheduledDate)
            .ThenBy(t => t.StartTime)
            .ToList();

        if (matched.Count == 0)
            return $"No tasks found between {start:yyyy-MM-dd} and {end:yyyy-MM-dd} (filter={filter}).";

        return string.Join("\n", matched.Select(TaskRagFormatter.FormatForTasks));
    }

    [KernelFunction("get_summary_information")]
    [Description("Aggregate focus minutes and task completion stats for a MYT date range (not a narrative report).")]
    public async Task<string> GetSummaryInformationAsync(
        [Description("Start date yyyy-MM-dd (MYT), or today/yesterday/tomorrow")] string startDate,
        [Description("End date (same formats)")] string endDate)
    {
        if (!TaskTimeHelper.TryParseMytDateInput(startDate, out var start) ||
            !TaskTimeHelper.TryParseMytDateInput(endDate, out var end))
            return "Invalid dates. Use yyyy-MM-dd or today/yesterday/tomorrow.";
        if (end < start) (start, end) = (end, start);

        var rangeStartUtc = start.AddHours(-8);
        var rangeEndUtc = end.AddDays(1).AddHours(-8);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();

        var sessions = await db.StudySessions
            .Where(s => s.UserId == _userId && s.StartedAt >= rangeStartUtc && s.StartedAt < rangeEndUtc)
            .Select(s => s.Duration)
            .ToListAsync();
        var focusMin = sessions.Sum(s => s) / 60;
        var dayCount = Math.Max(1, (end - start).Days + 1);

        var tasks = await db.Tasks.Where(t => t.UserId == _userId).ToListAsync();
        var inRange = tasks.Where(t => TaskTimeHelper.BelongsToPlannedMytRange(t, start, end)).ToList();

        var done = inRange.Count(t => t.Status == "Done");
        var notDone = inRange.Count(t => !string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase));
        var importantDone = inRange.Count(t => t.IsImportant && t.Status == "Done");
        var importantTotal = inRange.Count(t => t.IsImportant);

        return $"""
            Period: {start:yyyy-MM-dd} to {end:yyyy-MM-dd} (MYT)
            Total focus: {focusMin} minutes (avg {focusMin / dayCount} min/day)
            Tasks in period: {inRange.Count}
            Completed: {done} | Not completed: {notDone}
            Important tasks completed: {importantDone}/{importantTotal}
            """;
    }

    [KernelFunction("get_relevant_information")]
    [Description("Semantic search over saved user Insights (demographics, education, career, habits, interests). Not for task lists.")]
    public async Task<string> GetRelevantInformationAsync(
        [Description("Search query — keywords or short question")] string query,
        [Description("Number of results (default 5, max 10)")] int topK = 5)
    {
        if (string.IsNullOrWhiteSpace(query))
            return "Query is required.";

        using var scope = _scopeFactory.CreateScope();
        var rag = scope.ServiceProvider.GetRequiredService<RagService>();
        topK = Math.Clamp(topK, 1, 10);
        var result = await rag.SearchInsightsAsync(_userId, query.Trim(), topK);
        return string.IsNullOrWhiteSpace(result) ? "No relevant insights found." : result;
    }

    [KernelFunction("get_summary_report")]
    [Description("Generate a narrative study performance report for a period. Use when the user asks for a summary, recap, or 复盘.")]
    public async Task<string> GetSummaryReportAsync(
        [Description("Period: week (default), 7days, or 30days")] string period = "week",
        [Description("Report language: English or 中文")] string language = "English")
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();
        var generator = scope.ServiceProvider.GetRequiredService<CoachReportGenerator>();

        var user = await db.Users.Include(u => u.NagProfile).FirstOrDefaultAsync(u => u.Id == _userId);
        var systemPrompt = user?.NagProfile?.SystemPrompt
            ?? await db.AgentProfiles.Where(p => p.Key == "Normal").Select(p => p.SystemPrompt).FirstOrDefaultAsync()
            ?? "You are a study coach.";

        return await generator.GenerateAsync(_userId, period, language, systemPrompt);
    }
}
