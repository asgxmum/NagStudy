using NagStudy.API.Models.Domain;



namespace NagStudy.API.Infrastructure;



/// <summary>Shared task text for RAG indexing and agent history tools.</summary>

public static class TaskRagFormatter

{

    /// <summary>RAG index line — completed tasks only.</summary>

    public static string FormatForIndex(StudyTask t)

    {

        var date = ResolveTaskDate(t);

        var start = t.StartTime?.AddHours(8).ToString("HH:mm") ?? "--:--";

        var end = t.EndTime?.AddHours(8).ToString("HH:mm") ?? "--:--";

        var duration = FormatDuration(t);

        var desc = string.IsNullOrWhiteSpace(t.Description) ? "(no description)" : t.Description.Trim();

        return $"Task: [{date:yyyy-MM-dd} {start} {end} {duration} {t.Title} {desc}]";

    }



    /// <summary>Agent get_tasks line — planned day (ScheduledDate); StartTime/EndTime are Gantt block only.</summary>
    public static string FormatForTasks(StudyTask t)
    {
        var date = TaskTimeHelper.GetPlannedMytDate(t) ?? DateTime.MinValue;
        var start = t.StartTime?.AddHours(8).ToString("HH:mm") ?? "--:--";
        var end = t.EndTime?.AddHours(8).ToString("HH:mm") ?? "--:--";
        var duration = FormatDuration(t);
        var desc = string.IsNullOrWhiteSpace(t.Description) ? "(no description)" : t.Description.Trim();
        var status = IsDone(t) ? "完成" : "未完成";
        return $"Task: [{date:yyyy-MM-dd} {start} {end} {duration} {t.Title} {desc} {status}]";
    }



    public static bool IsDone(StudyTask t) =>

        string.Equals(t.Status, "Done", StringComparison.OrdinalIgnoreCase);



    /// <summary>Legacy fallback chain — do not use for day filters; use TaskTimeHelper.BelongsToPlannedMytDay.</summary>
    public static DateTime ResolveTaskDate(StudyTask t)

    {

        if (t.ScheduledDate != null)

            return t.ScheduledDate.Value.AddHours(8).Date;

        if (t.StartTime != null)

            return t.StartTime.Value.AddHours(8).Date;

        if (t.CompletedAt != null)

            return t.CompletedAt.Value.AddHours(8).Date;

        return t.CreatedAt.AddHours(8).Date;

    }



    static string FormatDuration(StudyTask t)

    {

        if (t.StartTime == null || t.EndTime == null)

            return "unknown";

        var mins = (int)Math.Round((t.EndTime.Value - t.StartTime.Value).TotalMinutes);

        return $"{Math.Max(0, mins)}min";

    }



    public static string FormatInsight(UserInsight i) =>
        $"Insight [{i.Category}]: [{i.RecordedAt.AddHours(8):yyyy-MM-dd}] {i.Summary.Trim()}";

}


