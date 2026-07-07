namespace NagStudy.API.Models.Domain;

/// <summary>LLM-extracted long-term user facts/habits from coach conversations.</summary>
public class UserActivity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string Summary { get; set; } = string.Empty;
    public DateTime RecordedAt { get; set; }
    public int? SourceMessageId { get; set; }
}
