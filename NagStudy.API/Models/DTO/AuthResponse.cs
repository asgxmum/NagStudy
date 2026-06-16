namespace NagStudy.API.Models.DTO;

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string AiTone { get; set; } = string.Empty;
}