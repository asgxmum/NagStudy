using Microsoft.EntityFrameworkCore;
using NagStudy.API.Models.Domain;

namespace NagStudy.API.Data;

/// <summary>
/// Creates the database schema from the current EF model on first run.
/// Add new entities/DbSets in <see cref="NagStudyContext"/> — tables appear on a fresh database.
/// </summary>
public static class DatabaseInitializer
{
    public static void Initialize(NagStudyContext db, IConfiguration config, ILogger logger)
    {
        var created = db.Database.EnsureCreated();
        if (created)
            logger.LogInformation("Database schema created from NagStudyContext model.");
        else
            EnsureSchemaUpToDate(db, logger);

        ProfileSeeder.SeedBuiltInProfiles(db);
        ProfileSeeder.SyncUserNagProfiles(db);
        SeedAdminIfMissing(db, config, logger);
    }

    /// <summary>
    /// EnsureCreated skips existing databases — add new tables here when the model grows.
    /// </summary>
    static void EnsureSchemaUpToDate(NagStudyContext db, ILogger logger)
    {
        db.Database.ExecuteSqlRaw("""
            IF OBJECT_ID(N'[UserActivities]', N'U') IS NULL
            BEGIN
                CREATE TABLE [UserActivities] (
                    [Id] int NOT NULL IDENTITY,
                    [UserId] int NOT NULL,
                    [Summary] nvarchar(max) NOT NULL,
                    [RecordedAt] datetime2 NOT NULL,
                    [SourceMessageId] int NULL,
                    CONSTRAINT [PK_UserActivities] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_UserActivities_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([Id]) ON DELETE CASCADE
                );
                CREATE INDEX [IX_UserActivities_UserId] ON [UserActivities] ([UserId]);
            END
            """);
        logger.LogInformation("Schema sync completed (UserActivities).");
    }

    public static void SeedDevelopmentData(NagStudyContext db) => DemoSeeder.Seed(db);

    static void SeedAdminIfMissing(NagStudyContext db, IConfiguration config, ILogger logger)
    {
        if (db.Users.Any(u => u.Role == "Admin")) return;

        var adminCfg = config.GetSection("Admin");
        var adminPw = adminCfg["Password"];
        if (string.IsNullOrWhiteSpace(adminPw))
        {
            logger.LogWarning(
                "Admin:Password not set — skipping admin seed. Set: dotnet user-secrets set \"Admin:Password\" \"...\"");
            return;
        }

        db.Users.Add(new User
        {
            Email = adminCfg["Email"]!.ToLower(),
            Nickname = adminCfg["Nickname"]!,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPw),
            Role = "Admin",
            AiTone = "Normal",
            NagProfileId = db.AgentProfiles.FirstOrDefault(p => p.Key == "Normal")?.Id,
            Status = "Active",
            CreatedAt = DateTime.UtcNow
        });
        db.SaveChanges();
    }
}
