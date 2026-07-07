namespace NagStudy.API.Infrastructure;

using System.Globalization;
using NagStudy.API.Models.Domain;

/// <summary>MYT (UTC+8) calendar helpers for task scheduling.</summary>
public static class TaskTimeHelper
{
    public static DateTime TodayMyt() => DateTime.UtcNow.AddHours(8).Date;

    public static DateTime NowMyt() => DateTime.UtcNow.AddHours(8);

    /// <summary>Task belongs to a MYT day by planned ScheduledDate only (matches Yesterday Review / Tasks API).</summary>
    public static bool BelongsToPlannedMytDay(StudyTask t, DateTime dayMyt) =>
        t.ScheduledDate != null && t.ScheduledDate.Value.AddHours(8).Date == dayMyt.Date;

    /// <summary>Inclusive MYT date range filter by ScheduledDate.</summary>
    public static bool BelongsToPlannedMytRange(StudyTask t, DateTime startMyt, DateTime endMyt)
    {
        if (t.ScheduledDate == null) return false;
        var d = t.ScheduledDate.Value.AddHours(8).Date;
        return d >= startMyt.Date && d <= endMyt.Date;
    }

    public static DateTime? GetPlannedMytDate(StudyTask t) =>
        t.ScheduledDate == null ? null : t.ScheduledDate.Value.AddHours(8).Date;

    /// <summary>Parse yyyy-MM-dd or relative keywords today/yesterday/tomorrow (MYT).</summary>
    public static bool TryParseMytDateInput(string text, out DateTime date)
    {
        date = default;
        var t = text.Trim();
        if (t.Length == 0) return false;

        var today = TodayMyt();
        switch (t.ToLowerInvariant())
        {
            case "today":
            case "今天":
                date = today;
                return true;
            case "yesterday":
            case "昨天":
                date = today.AddDays(-1);
                return true;
            case "tomorrow":
            case "明天":
                date = today.AddDays(1);
                return true;
        }

        if (!DateTime.TryParseExact(t, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var parsed))
            return false;
        date = parsed.Date;
        return true;
    }

    /// <summary>Inject into coach system prompt so the model does not guess calendar dates.</summary>
    public static string FormatMytClockContext()
    {
        var nowMyt = NowMyt();
        var today = nowMyt.Date;
        var yesterday = today.AddDays(-1);
        var tomorrow = today.AddDays(1);
        return $"""
            === Current time (MYT, UTC+8) ===
            Now: {today:yyyy-MM-dd} ({nowMyt:dddd}) {nowMyt:HH:mm}
            Use these for get_tasks / get_summary_information — do NOT guess dates:
            • today / 今天 → {today:yyyy-MM-dd}
            • yesterday / 昨天 → {yesterday:yyyy-MM-dd}
            • tomorrow / 明天 → {tomorrow:yyyy-MM-dd}
            ===
            """;
    }

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
