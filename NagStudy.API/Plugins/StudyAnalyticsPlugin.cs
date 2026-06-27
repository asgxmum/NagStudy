using System.ComponentModel;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using NagStudy.API.Data;
using NagStudy.API.Infrastructure;
using NagStudy.API.Services;

namespace NagStudy.API.Plugins;

/// <summary>Agent-callable analytics and RAG search tools.</summary>
public class StudyAnalyticsPlugin
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly int _userId;

    public StudyAnalyticsPlugin(IServiceScopeFactory scopeFactory, int userId)
    {
        _scopeFactory = scopeFactory;
        _userId = userId;
    }

    [KernelFunction("search_task_history")]
    [Description("List all tasks in a date range (MYT). endDate optional — same as startDate for one day.")]
    public async Task<string> SearchTaskHistoryAsync(
        [Description("Start date yyyy-MM-dd (MYT)")] string startDate,
        [Description("End date yyyy-MM-dd (MYT); omit for single day")] string? endDate = null)
    {
        if (!TryParseMytDate(startDate, out var start))
            return "Invalid startDate. Use yyyy-MM-dd.";

        var end = endDate != null && TryParseMytDate(endDate, out var parsedEnd) ? parsedEnd : start;
        if (end < start) (start, end) = (end, start);

        var rangeStartUtc = start.AddHours(-8);
        var rangeEndUtc = end.AddDays(1).AddHours(-8);

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();

        var tasks = await db.Tasks
            .Where(t => t.UserId == _userId)
            .ToListAsync();

        var matched = tasks
            .Where(t =>
            {
                var d = TaskRagFormatter.ResolveTaskDate(t);
                var utc = d.AddHours(-8);
                return utc >= rangeStartUtc && utc < rangeEndUtc;
            })
            .OrderBy(t => TaskRagFormatter.ResolveTaskDate(t))
            .ThenBy(t => t.StartTime)
            .ToList();

        if (matched.Count == 0)
            return $"No tasks found between {start:yyyy-MM-dd} and {end:yyyy-MM-dd}.";

        return string.Join("\n", matched.Select(TaskRagFormatter.FormatForHistory));
    }

    [KernelFunction("get_summary_information")]
    [Description("Aggregate user performance for a date range (MYT): focus time, task completion, patterns.")]
    public async Task<string> GetSummaryInformationAsync(
        [Description("Start date yyyy-MM-dd (MYT)")] string startDate,
        [Description("End date yyyy-MM-dd (MYT)")] string endDate)
    {
        if (!TryParseMytDate(startDate, out var start) || !TryParseMytDate(endDate, out var end))
            return "Invalid dates. Use yyyy-MM-dd.";
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
        var inRange = tasks.Where(t =>
        {
            var d = TaskRagFormatter.ResolveTaskDate(t);
            var utc = d.AddHours(-8);
            return utc >= rangeStartUtc && utc < rangeEndUtc;
        }).ToList();

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
    [Description("Semantic search over indexed history (tasks, activities, chats, reports). Use when you need past context.")]
    public async Task<string> GetRelevantInformationAsync(
        [Description("Search query — keywords or short question")] string query,
        [Description("Number of results (default 5, max 10)")] int topK = 5)
    {
        if (string.IsNullOrWhiteSpace(query))
            return "Query is required.";

        using var scope = _scopeFactory.CreateScope();
        var rag = scope.ServiceProvider.GetRequiredService<RagService>();
        topK = Math.Clamp(topK, 1, 10);
        var result = await rag.SearchAsync(_userId, query.Trim(), topK);
        return string.IsNullOrWhiteSpace(result) ? "No relevant indexed history found." : result;
    }

    static bool TryParseMytDate(string text, out DateTime date)
    {
        date = default;
        if (!DateTime.TryParseExact(text.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var parsed))
            return false;
        date = parsed.Date;
        return true;
    }
}
