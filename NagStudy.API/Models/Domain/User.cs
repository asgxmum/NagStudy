namespace NagStudy.API.Models.Domain;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;

    public string Role { get; set; } = "User"; //Admin/User
    /// <summary>Legacy — migrated to NagProfileId on startup</summary>
    public string AiTone { get; set; } = "Normal"; //Soft/Normal/Harsh
    public int? NagProfileId { get; set; }
    public AgentProfile? NagProfile { get; set; }

    public bool AiNotificationsEnabled { get; set; } = true;
    public string Status { get; set; } = "Active"; //Active/Banned/Deleted
    public DateTime CreatedAt { get; set; }

    /// <summary>MYT date (UTC boundary) when DayBrief last fired.</summary>
    public DateTime? LastDayBriefDate { get; set; }

    public ICollection<StudyTask> Tasks { get; set; } = new List<StudyTask>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<StudySession> StudySessions { get; set; } = new List<StudySession>();
    public ICollection<AIFeedback> AIFeedbacks { get; set; } = new List<AIFeedback>();
    public ICollection<AgentProfile> CustomProfiles { get; set; } = new List<AgentProfile>();
    public ICollection<ChatSession> ChatSessions { get; set; } = new List<ChatSession>();
    public ICollection<RagDocument> RagDocuments { get; set; } = new List<RagDocument>();
    public ICollection<UserActivity> UserActivities { get; set; } = new List<UserActivity>();
}
