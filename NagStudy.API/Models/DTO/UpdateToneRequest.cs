using System.ComponentModel.DataAnnotations;

namespace NagStudy.API.Models.DTO;

// Body for PUT /api/users/me/tone — the AI coach persona (Soft / Normal / Harsh).
public class UpdateToneRequest
{
    [Required]
    public string AiTone { get; set; } = string.Empty;
}
