namespace NagStudy.API.Infrastructure;

/// <summary>MYT (UTC+8) calendar helpers for task scheduling.</summary>
public static class TaskTimeHelper
{
    public static DateTime TodayMyt() => DateTime.UtcNow.AddHours(8).Date;

    public static DateTime MytDayStartUtc(DateTime mytDate) => mytDate.Date.AddHours(-8);

    public static DateTime MytDayEndUtc(DateTime mytDate) => MytDayStartUtc(mytDate).AddDays(1);

    public static DateTime? ToMytDate(DateTime? utc) =>
        utc == null ? null : utc.Value.AddHours(8).Date;

    /// <summary>Store as UTC midnight boundary for MYT calendar date.</summary>
    public static DateTime? MytDateToUtc(DateTime? mytDate) =>
        mytDate == null ? null : MytDateStartUtc(mytDate.Value);

    public static DateTime MytDateStartUtc(DateTime mytDate) => mytDate.Date.AddHours(-8);

    public static DateTime CombineMytDateAndMinutes(DateTime mytDate, int minutesOfDay)
    {
        var local = mytDate.Date.AddMinutes(minutesOfDay);
        return local.AddHours(-8);
    }

    public static int MinutesOfDayMyt(DateTime utc) =>
        utc.AddHours(8).Hour * 60 + utc.AddHours(8).Minute;

    /// <summary>Which MYT day a task belongs to for board partitioning.</summary>
    public static DateTime? ResolveScheduledMytDate(Models.Domain.StudyTask t)
    {
        if (t.ScheduledDate != null)
            return t.ScheduledDate.Value.AddHours(8).Date;

        if (t.StartTime != null)
            return t.StartTime.Value.AddHours(8).Date;

        if (string.Equals(t.When, "Later", StringComparison.OrdinalIgnoreCase))
            return null;

        return t.CreatedAt.AddHours(8).Date;
    }

    public static bool IsBacklog(Models.Domain.StudyTask t, DateTime todayMyt)
    {
        var planned = ResolveScheduledMytDate(t);
        return planned == null || planned.Value > todayMyt;
    }

    public static bool IsTodayBoard(Models.Domain.StudyTask t, DateTime todayMyt) =>
        ResolveScheduledMytDate(t) == todayMyt && t.StartTime == null;

    public static bool IsOnGanttToday(Models.Domain.StudyTask t, DateTime todayMyt)
    {
        if (t.StartTime == null) return false;
        return t.StartTime.Value.AddHours(8).Date == todayMyt;
    }
}
