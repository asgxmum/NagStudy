namespace NagStudy.API.Models.Domain;

public class ChatMessage
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public ChatSession Session { get; set; } = null!;

    /// <summary>User | Assistant</summary>
    public string Role { get; set; } = string.Empty;
    /// <summary>Chat | Report</summary>
    public string MessageType { get; set; } = "Chat";
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
