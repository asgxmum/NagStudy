namespace NagStudy.API.Models.Domain;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;

    public string Role { get; set; } = "User"; //Admin/User
    public string AiTone { get; set; } = "Normal"; //Soft/Normal/Harsh
    public string Status { get; set; } = "Active"; //Active/Banned/Deleted
    public DateTime CreatedAt { get; set; }

    //Navigation (user has - 1:N)
    public ICollection<StudyTask> Tasks { get; set; } = new List<StudyTask>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<StudySession> StudySessions { get; set; } = new List<StudySession>();
    public ICollection<AIFeedback> AIFeedbacks { get; set; } = new List<AIFeedback>();
}