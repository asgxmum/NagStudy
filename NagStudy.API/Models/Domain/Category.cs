namespace NagStudy.API.Models.Domain;

public class Category
{
    public int Id { get; set; } //PK
    public int UserId { get; set; } // FK-> User
    public User User { get; set; } = null!; //Navigation (This category's owner)

    public string Name { get; set; } = string.Empty;//E.g. Math, Algorithm analysis, Big Data review
    public string Color { get; set; } = string.Empty; //hex color, alike #E8734A
    public DateTime CreatedAt { get; set; }

    //Pomodoro sessions tracked under this category (1:N)
    public ICollection<StudySession> StudySessions { get; set; } = new List<StudySession>();
}