namespace NagStudy.API.Models.DTO;

public class TaskResponse
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsImportant { get; set; }
    public bool RemindBeforeStart { get; set; }
    public DateTime? ScheduledDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Color { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Legacy — derived from ScheduledDate.</summary>
    public string When { get; set; } = "Now";
}

public class TaskBoardResponse
{
    public List<TaskResponse> Today { get; set; } = new();
    public List<TaskResponse> Backlog { get; set; } = new();
    public List<TaskResponse> Gantt { get; set; } = new();
}

public class YesterdayUndoneTaskResponse : TaskResponse
{
    /// <summary>missed = had a Gantt block; open = planned but never scheduled.</summary>
    public string Kind { get; set; } = "open";
}

public class YesterdayReviewResponse
{
    public List<TaskResponse> Done { get; set; } = new();
    public List<YesterdayUndoneTaskResponse> Undone { get; set; } = new();
}
