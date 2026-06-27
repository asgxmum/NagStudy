namespace NagStudy.API.Models.Domain;

public class AgentProfile
{
    public int Id { get; set; }
    /// <summary>null = system built-in profile (Soft / Normal / Harsh)</summary>
    public int? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>Soft, Normal, Harsh for built-ins; null for custom</summary>
    public string? Key { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SystemPrompt { get; set; } = string.Empty;
    public string Color { get; set; } = "#2C3E63";
    /// <summary>Optional custom avatar URL for non-built-in profiles.</summary>
    public string? AvatarUrl { get; set; }
    public bool IsBuiltIn { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<ChatSession> ChatSessions { get; set; } = new List<ChatSession>();
}
