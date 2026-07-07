namespace NagStudy.API.Models.Domain;

public class SummaryReport
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int? SessionId { get; set; }
    public ChatSession? Session { get; set; }
    public int ProfileId { get; set; }
    public AgentProfile Profile { get; set; } = null!;

    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public string Language { get; set; } = "English";
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
