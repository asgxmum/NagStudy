using System.ComponentModel.DataAnnotations;

namespace NagStudy.API.Models.DTO;

// Body for PUT /api/users/me/password. New password must meet the same policy as registration
// (8+ chars with an uppercase letter, a digit and a special character).
public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [RegularExpression(@"^(?=.*[A-Z])(?=.*[\W_])(?=.*\d).{8,}$",
        ErrorMessage = "Password needs 8+ characters with an uppercase letter, a number and a special character.")]
    public string NewPassword { get; set; } = string.Empty;
}
