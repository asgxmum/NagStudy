using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;
using NagStudy.API.Services;

namespace NagStudy.API.Infrastructure;

/// <summary>Unified rules for Yesterday's Review — tasks belong to a MYT day via ScheduledDate only.</summary>
public static class YesterdayReviewHelper
{
    public static bool BelongsToScheduledMytDay(StudyTask t, DateTime dayMyt) =>
        t.ScheduledDate != null && t.ScheduledDate.Value.AddHours(8).Date == dayMyt.Date;

    public static bool IsUndoneMissed(StudyTask t) =>
        !string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase) && t.StartTime != null;

    public static bool IsUndoneOpen(StudyTask t) =>
        !string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase) && t.StartTime == null;

    public static int CountTodayDone(IEnumerable<StudyTask> tasks, DateTime todayMyt) =>
        tasks.Count(t => BelongsToScheduledMytDay(t, todayMyt)
            && string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase));

    public static int CountTodayMissed(IEnumerable<StudyTask> tasks, DateTime todayMyt, DateTime nowUtc) =>
        tasks.Count(t => BelongsToScheduledMytDay(t, todayMyt)
            && string.Equals(t.Status, "Scheduled", StringComparison.OrdinalIgnoreCase)
            && t.StartTime != null
            && t.EndTime != null
            && t.EndTime < nowUtc);

    public static YesterdayReviewResponse Classify(IEnumerable<StudyTask> tasks, DateTime dayMyt)
    {
        var dayTasks = tasks.Where(t => BelongsToScheduledMytDay(t, dayMyt)).ToList();
        var done = dayTasks
            .Where(t => string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase))
            .Select(TaskMapper.ToResponse)
            .ToList();
        var undone = dayTasks
            .Where(t => !string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase))
            .Select(TaskMapper.ToUndoneResponse)
            .ToList();

        return new YesterdayReviewResponse { Done = done, Undone = undone };
    }
}
