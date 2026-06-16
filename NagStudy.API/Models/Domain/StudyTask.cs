namespace NagStudy.API.Models.Domain;

public class StudyTask
{
    public int Id { get; set; } //PK
    public int UserId { get; set; }  //FK -> User
    public User User { get; set; } = null!; //Navigation (Task's owner)
    public string Title { get; set; } = string.Empty;
    public bool IsImportant { get; set; }//Priority
    public string When { get; set; } = "Now";//Now/Later
    public string Status { get; set; } = "Inbox"; //Inbox/ Scheduled/Done
    public string? Color { get; set; } //hex colour for the Gantt block, e.g. #E8734A (nullable = use a default)

    public DateTime? StartTime { get; set; } //Start Gantt Chart (nullable)
    public DateTime? EndTime { get; set; }//End of Gantt chart(nullable)
    public DateTime? CompletedAt { get; set; }//Completion Time (nullable)
    public DateTime CreatedAt { get; set; }

    //Pomodoro sessions associated with this task (1:N, optional)
    public ICollection<StudySession> StudySessions { get; set; } = new List<StudySession>();

}