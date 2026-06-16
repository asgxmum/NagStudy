using System.ComponentModel.DataAnnotations;
namespace NagStudy.API.Models.DTO;

public class RegisterRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8, ErrorMessage = "password must be at least 8 characters long.")]
    [RegularExpression(@"^(?=.*[A-Z])(?=.*[\W_])(?=.*\d).{8,}$",
        ErrorMessage = "password must include at least one uppercase letter, one number, and one special character."
    )]
    public string Password { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string Nickname { get; set; } = string.Empty;

}