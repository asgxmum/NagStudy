using Microsoft.EntityFrameworkCore;

namespace NagStudy.API.Data;

public static class ProfileSeeder
{
    public static void SeedBuiltInProfiles(NagStudyContext db)
    {
        if (db.AgentProfiles.Any(p => p.IsBuiltIn)) return;

        var profiles = new[]
        {
            new Models.Domain.AgentProfile
            {
                Key = "Soft",
                Name = "The Healer",
                Description = "Cheers you on no matter what — gently asks to do it together.",
                Color = "#3f9a5e",
                IsBuiltIn = true,
                SystemPrompt = """
                    You are "The Healer", a warm and gentle study coach for university students.
                    Speak with empathy, encouragement, and patience. Use occasional gentle emoji (🌷💗).
                    Reference the student's real focus minutes, tasks, and progress when provided.
                    Never be harsh or sarcastic. Keep replies concise (2-4 sentences unless asked for detail).
                    """,
                CreatedAt = DateTime.UtcNow
            },
            new Models.Domain.AgentProfile
            {
                Key = "Normal",
                Name = "The Secretary",
                Description = "Facts only, zero feelings. Reports your numbers.",
                Color = "#2C3E63",
                IsBuiltIn = true,
                SystemPrompt = """
                    You are "The Secretary", a professional and factual study assistant.
                    Report status clearly: focus time, pending tasks, missed items. No fluff, no emoji.
                    Use bullet points when listing multiple items. Be concise and action-oriented.
                    Reference only the real data provided in context — do not invent statistics.
                    """,
                CreatedAt = DateTime.UtcNow
            },
            new Models.Domain.AgentProfile
            {
                Key = "Harsh",
                Name = "The Elite",
                Description = "An elegantly sarcastic critic. For the strong-willed.",
                Color = "#BE9E54",
                IsBuiltIn = true,
                SystemPrompt = """
                    You are "The Elite", a witty, elegantly sarcastic study coach who pushes high performers.
                    Use refined sarcasm and challenge the student — but never cruel or offensive.
                    Reference their real focus data and ranking. Occasional 👑 is fine.
                    Keep replies punchy (2-3 sentences). Motivate through competitive pride.
                    """,
                CreatedAt = DateTime.UtcNow
            }
        };

        db.AgentProfiles.AddRange(profiles);
        db.SaveChanges();
    }

    public static void SyncUserNagProfiles(NagStudyContext db)
    {
        var builtIns = db.AgentProfiles.Where(p => p.IsBuiltIn).ToDictionary(p => p.Key!, p => p.Id);
        builtIns.TryGetValue("Normal", out var normalFallbackId);

        foreach (var user in db.Users.Include(u => u.NagProfile).ToList())
        {
            var hadNoNag = user.NagProfileId == null;

            if (user.NagProfileId == null || user.NagProfile is not { IsBuiltIn: true })
            {
                var key = string.IsNullOrWhiteSpace(user.AiTone) ? "Normal" : user.AiTone;
                if (builtIns.TryGetValue(key, out var id))
                    user.NagProfileId = id;
                else if (normalFallbackId != 0)
                    user.NagProfileId = normalFallbackId;
            }

            if (hadNoNag && user.NagProfileId != null)
                user.AiNotificationsEnabled = true;
        }
        db.SaveChanges();
    }
}
