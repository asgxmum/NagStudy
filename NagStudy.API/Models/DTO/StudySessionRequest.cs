using System.ComponentModel.DataAnnotations;
namespace NagStudy.API.Models.DTO;

public class StudySessionRequest
{
    [Required]
    public int CategoryId { get; set; }
    public int? TaskId { get; set; } // nullable (optional to connect)

    [Required]
    public DateTime StartedAt { get; set; }

    [Required, Range(1, int.MaxValue)]
    public int Duration { get; set; } //in seconds
}