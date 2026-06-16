namespace NagStudy.API.Models.Domain;

public class StudySession
{
    public int Id { get; set; } //PK
    public int UserId { get; set; } //FK->User
    public User User { get; set; } = null!;

    public int CategoryId { get; set; } //FK -> Category (Session Color/Name)
    public Category Category { get; set; } = null!;

    public int? TaskId { get; set; } //FK-> StudyTask(nullable, optional connection)
    public StudyTask? Task { get; set; } //It is nullable 

    public DateTime StartedAt { get; set; } //Session start time (based on today's/this week's criteria)
    public int Duration { get; set; } //Actual focus time  (down to the second)
    public DateTime CreatedAt { get; set; }
}