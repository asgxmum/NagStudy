using System.ComponentModel.DataAnnotations;

namespace NagStudy.API.Models.DTO;

public class UpdateStatusRequest
{
    [Required]
    [RegularExpression("^(Active|Banned|Deleted)$", ErrorMessage = "Status must be Active, Banned, or Deleted.")]
    public string Status { get; set; } = string.Empty;
}