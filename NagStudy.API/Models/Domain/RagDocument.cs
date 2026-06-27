namespace NagStudy.API.Models.Domain;

public class RagDocument
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>ChatMessage | Task | StudySession | Report | Activity</summary>
    public string SourceType { get; set; } = string.Empty;
    public int SourceId { get; set; }
    public string Content { get; set; } = string.Empty;
    /// <summary>JSON-serialised float[] embedding (Gemini text-embedding-004)</summary>
    public string? EmbeddingJson { get; set; }
    public DateTime UpdatedAt { get; set; }
}
