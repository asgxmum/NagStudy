namespace NagStudy.API.Models.Domain;

/// <summary>LLM-extracted durable user facts (demographics, education, habits, interests).</summary>
public class UserInsight
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>demographic | education | job | location | habit | interest | preference | other</summary>
    public string Category { get; set; } = "other";
    public string Summary { get; set; } = string.Empty;
    public DateTime RecordedAt { get; set; }
    public int? SourceMessageId { get; set; }
}
