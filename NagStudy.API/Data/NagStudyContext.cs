using Microsoft.EntityFrameworkCore;
using NagStudy.API.Models.Domain;

namespace NagStudy.API.Data;

public class NagStudyContext : DbContext
{
    public NagStudyContext(DbContextOptions<NagStudyContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<StudyTask> Tasks => Set<StudyTask>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<StudySession> StudySessions => Set<StudySession>();
    public DbSet<AIFeedback> AIFeedbacks => Set<AIFeedback>();
    public DbSet<AgentProfile> AgentProfiles => Set<AgentProfile>();
    public DbSet<ChatSession> ChatSessions => Set<ChatSession>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<RagDocument> RagDocuments => Set<RagDocument>();
    public DbSet<SummaryReport> SummaryReports => Set<SummaryReport>();
    public DbSet<UserActivity> UserActivities => Set<UserActivity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email).IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Nickname).IsUnique();

        modelBuilder.Entity<Category>()
            .HasIndex(c => new { c.UserId, c.Name }).IsUnique();

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

        modelBuilder.Entity<User>()
            .HasOne(u => u.NagProfile).WithMany()
            .HasForeignKey(u => u.NagProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AgentProfile>()
            .HasOne(p => p.User).WithMany(u => u.CustomProfiles)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ChatSession>()
            .HasOne(s => s.User).WithMany(u => u.ChatSessions)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ChatSession>()
            .HasOne(s => s.Profile).WithMany(p => p.ChatSessions)
            .HasForeignKey(s => s.ProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ChatMessage>()
            .HasOne(m => m.Session).WithMany(s => s.Messages)
            .HasForeignKey(m => m.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RagDocument>()
            .HasIndex(r => new { r.UserId, r.SourceType, r.SourceId }).IsUnique();

        modelBuilder.Entity<RagDocument>()
            .HasOne(r => r.User).WithMany(u => u.RagDocuments)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserActivity>()
            .HasOne(a => a.User).WithMany(u => u.UserActivities)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SummaryReport>()
            .HasOne(r => r.User).WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SummaryReport>()
            .HasOne(r => r.Profile).WithMany()
            .HasForeignKey(r => r.ProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SummaryReport>()
            .HasOne(r => r.Session).WithMany()
            .HasForeignKey(r => r.SessionId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
