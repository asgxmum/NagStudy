using System.ComponentModel.DataAnnotations;

namespace NagStudy.API.Models.DTO;

public class TaskRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string? Description { get; set; }

    public bool IsImportant { get; set; }

    public bool RemindBeforeStart { get; set; }

    /// <summary>Planned MYT calendar day (UTC boundary). Null = Backlog without date.</summary>
    public DateTime? ScheduledDate { get; set; }

    /// <summary>Legacy — ignored when ScheduledDate is set.</summary>
    public string? When { get; set; }

    [Required]
    [RegularExpression("^(Inbox|Scheduled|Done)$", ErrorMessage = "Status must be 'Inbox', 'Scheduled' or 'Done'.")]
    public string Status { get; set; } = "Inbox";

    [MaxLength(9)]
    [RegularExpression("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", ErrorMessage = "Color must be a hex code like #E8734A.")]
    public string? Color { get; set; }

    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime? CompletedAt { get; set; }
}
