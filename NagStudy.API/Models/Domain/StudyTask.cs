namespace NagStudy.API.Models.Domain;

public class StudyTask
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsImportant { get; set; }
    public bool RemindBeforeStart { get; set; }

    /// <summary>Planned MYT day stored as UTC midnight boundary. Null = undated Backlog.</summary>
    public DateTime? ScheduledDate { get; set; }

    /// <summary>Legacy — prefer ScheduledDate. Kept for migration compatibility.</summary>
    public string When { get; set; } = "Now";

    public string Status { get; set; } = "Inbox";
    public string? Color { get; set; }

    /// <summary>Gantt start — single source of truth for timeline blocks.</summary>
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public DateTime? StartReminderSentAt { get; set; }
    public DateTime? EndPromptSentAt { get; set; }

    public ICollection<StudySession> StudySessions { get; set; } = new List<StudySession>();
}
