using System.ComponentModel.DataAnnotations;


namespace NagStudy.API.Models.DTO;

public class TaskRequest
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public bool IsImportant { get; set; }

    [Required]
    [RegularExpression("^(Now|Later)$", ErrorMessage = "When must be 'Now' or 'Later'.")]
    public string When { get; set; } = "Now"; //Now/Later

    [Required]
    [RegularExpression("^(Inbox|Scheduled|Done)$", ErrorMessage = "Status must be 'Inbox', 'Scheduled' or 'Done'.")]
    public string Status { get; set; } = "Inbox"; //Inbox/Scheduled/Done

    [MaxLength(9)] // #RRGGBB (or #RRGGBBAA)
    [RegularExpression("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$", ErrorMessage = "Color must be a hex code like #E8734A.")]
    public string? Color { get; set; }

    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime? CompletedAt { get; set; }
}