using System.ComponentModel;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using NagStudy.API.Data;

namespace NagStudy.API.Plugins;

/// <summary>Today/week snapshot — invoked manually (Summary report, triggers), not agent auto-tools.</summary>
public class StudySnapshotPlugin
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly int _userId;

    public StudySnapshotPlugin(IServiceScopeFactory scopeFactory, int userId)
    {
        _scopeFactory = scopeFactory;
        _userId = userId;
    }

    private static DateTime TodayStartUtc()
    {
        var nowMyt = DateTime.UtcNow.AddHours(8);
        return nowMyt.Date.AddHours(-8);
    }

    private static DateTime WeekStartUtc()
    {
        var nowMyt = DateTime.UtcNow.AddHours(8);
        int daysSinceMonday = ((int)nowMyt.DayOfWeek + 6) % 7;
        return nowMyt.Date.AddDays(-daysSinceMonday).AddHours(-8);
    }

    [KernelFunction("get_study_summary")]
    [Description("Get today's and this week's focus minutes plus current task counts. Manual snapshot only.")]
    public async Task<string> GetStudySummaryAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();

        var weekStart = WeekStartUtc();
        var todayStart = TodayStartUtc();
        var todayEnd = todayStart.AddDays(1);

        var weekSessions = await db.StudySessions
            .Where(s => s.UserId == _userId && s.StartedAt >= weekStart)
            .Select(s => new { s.StartedAt, s.Duration })
            .ToListAsync();

        var todaySec = weekSessions.Where(s => s.StartedAt >= todayStart && s.StartedAt < todayEnd).Sum(s => s.Duration);
        var weekSec = weekSessions.Sum(s => s.Duration);

        var tasks = await db.Tasks.Where(t => t.UserId == _userId).ToListAsync();
        var now = DateTime.UtcNow;
        var inbox = tasks.Count(t => t.Status == "Inbox" && t.StartTime == null);
        var missed = tasks.Count(t => t.Status == "Scheduled" && t.EndTime != null && t.EndTime < now);
        var doneToday = tasks.Count(t => t.Status == "Done" && t.CompletedAt >= todayStart && t.CompletedAt < todayEnd);

        return $"""
            Today's focus: {todaySec / 60} minutes
            This week's focus: {weekSec / 60} minutes
            Inbox tasks (unscheduled): {inbox}
            Missed scheduled tasks: {missed}
            Tasks completed today: {doneToday}
            """;
    }
}
