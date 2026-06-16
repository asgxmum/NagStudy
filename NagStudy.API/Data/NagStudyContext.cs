using Microsoft.EntityFrameworkCore;
using NagStudy.API.Models.Domain;

namespace NagStudy.API.Data;

public class NagStudyContext : DbContext
{
    public NagStudyContext(DbContextOptions<NagStudyContext> options)
        : base(options)
    {
    }

    // Table lists (1 DbSet = 1 table)
    public DbSet<User> Users => Set<User>();
    public DbSet<StudyTask> Tasks => Set<StudyTask>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<AIFeedback> AIFeedbacks => Set<AIFeedback>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Unique limitation
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email).IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Nickname).IsUnique();

        modelBuilder.Entity<Category>()
            .HasIndex(c => new { c.UserId, c.Name }).IsUnique();

        // Relationships + Delete Actions, items owned by the user (All restricted)
        modelBuilder.Entity<StudyTask>()
            .HasOne(t => t.User).WithMany(u => u.Tasks)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Category>()
            .HasOne(c => c.User).WithMany(u => u.Categories)
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AIFeedback>()
            .HasOne(a => a.User).WithMany(u => u.AIFeedbacks)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // StudySession's 3 FKs
        modelBuilder.Entity<StudySession>()
            .HasOne(s => s.User).WithMany(u => u.StudySessions)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StudySession>()
            .HasOne(s => s.Category).WithMany(c => c.StudySessions)
            .HasForeignKey(s => s.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StudySession>()
            .HasOne(s => s.Task).WithMany(t => t.StudySessions)
            .HasForeignKey(s => s.TaskId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
