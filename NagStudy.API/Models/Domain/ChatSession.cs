namespace NagStudy.API.Models.Domain;

public class ChatSession
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int ProfileId { get; set; }
    public AgentProfile Profile { get; set; } = null!;

    public string Title { get; set; } = "New chat";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}
