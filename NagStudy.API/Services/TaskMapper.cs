using NagStudy.API.Infrastructure;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;

namespace NagStudy.API.Services;

public static class TaskMapper
{
    public static void ApplyRequest(StudyTask task, TaskRequest request, bool isCreate)
    {
        task.Title = request.Title.Trim();
        task.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        task.IsImportant = request.IsImportant;
        task.RemindBeforeStart = request.RemindBeforeStart;
        task.Status = request.Status;
        task.Color = request.Color;
        task.StartTime = request.StartTime;
        task.EndTime = request.EndTime;
        task.CompletedAt = request.CompletedAt;
        task.ScheduledDate = request.ScheduledDate;

        if (request.StartTime != null && request.ScheduledDate == null)
            task.ScheduledDate = TaskTimeHelper.MytDateToUtc(TaskTimeHelper.ToMytDate(request.StartTime));

        if (!string.IsNullOrWhiteSpace(request.When))
        {
            task.When = request.When;
            if (string.Equals(request.When, "Later", StringComparison.OrdinalIgnoreCase) && request.ScheduledDate == null)
                task.ScheduledDate = null;
        }
        else
        {
            SyncLegacyWhen(task);
        }

        if (isCreate)
            task.CreatedAt = DateTime.UtcNow;
    }

    static void SyncLegacyWhen(StudyTask task)
    {
        var today = TaskTimeHelper.TodayMyt();
        var planned = TaskTimeHelper.ResolveScheduledMytDate(task);
        task.When = planned == null || planned > today ? "Later" : "Now";
    }

    public static TaskResponse ToResponse(StudyTask t) => new()
    {
        Id = t.Id,
        Title = t.Title,
        Description = t.Description,
        IsImportant = t.IsImportant,
        RemindBeforeStart = t.RemindBeforeStart,
        ScheduledDate = t.ScheduledDate,
        Status = t.Status,
        Color = t.Color,
        StartTime = t.StartTime,
        EndTime = t.EndTime,
        CompletedAt = t.CompletedAt,
        CreatedAt = t.CreatedAt,
        When = t.When,
    };
}
