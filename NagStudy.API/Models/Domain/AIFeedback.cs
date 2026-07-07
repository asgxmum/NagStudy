namespace NagStudy.API.Models.Domain;

public class AIFeedback
{
    public int Id { get; set; } //PK

    public int UserId { get; set; } //FK->User
    public User User { get; set; } = null!;

    public string Sender { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;

    public string? Trigger { get; set; } //TabLeave/DayEnd/TaskPileup/Manual/Chat(If it is user message, is null)
    public string? Tone { get; set; } //Soft/Normal/Harsh(If it is user message, is null)

    public string Content { get; set; } = string.Empty; //Message main text
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}