using System.ComponentModel.DataAnnotations;

namespace NagStudy.API.Models.DTO;

// Body for PUT /api/users/me — only the nickname is editable (email is the locked login ID).
public class UpdateProfileRequest
{
    [Required]
    [MaxLength(20)]
    public string Nickname { get; set; } = string.Empty;
}
