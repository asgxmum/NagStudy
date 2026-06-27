namespace NagStudy.API.Models.DTO;

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    /// <summary>Legacy key: Soft/Normal/Harsh — derived from Nag profile</summary>
    public string AiTone { get; set; } = string.Empty;
    public int? NagProfileId { get; set; }
    public string? NagProfileName { get; set; }
    public string? NagProfileKey { get; set; }
}
