using NagStudy.API.Models.Domain;

namespace NagStudy.API.Data;

public static class DemoSeeder
{
    public static void Seed(NagStudyContext db)
    {
        SeedUsersAndSessions(db); // study sessions feed the ranking/dashboard charts
        SeedTasks(db);            // tasks feed the Tasks · Gantt board + yesterday review
    }

    // ── Users, categories and weekly study sessions (idempotent on the whole set) ──
    private static void SeedUsersAndSessions(NagStudyContext db)
    {
        // Skip if any student already exists (idempotent — prevents duplicate seeding).
        if (db.Users.Any(u => u.Role == "User")) return;

        var now = DateTime.UtcNow;

        // Monday 00:00 MYT of the current week, expressed in UTC — so seeded days line up
        // with the ranking/dashboard "this week" window.
        var nowMyt = now.AddHours(8);
        int daysSinceMonday = ((int)nowMyt.DayOfWeek + 6) % 7;
        var weekStartUtc = nowMyt.Date.AddDays(-daysSinceMonday).AddHours(-8);

        // Colour palette so the category donut looks varied. Each student gets a few of these.
        var palette = new[]
        {
            new { Name = "Math",      Color = "#E8734A" }, // coral
            new { Name = "Coding",    Color = "#1B2150" }, // navy
            new { Name = "Reading",   Color = "#6FA07A" }, // green
            new { Name = "Languages", Color = "#E0A458" }, // gold
            new { Name = "Workout",   Color = "#8E7CC3" }, // purple
        };

        // Each student: which categories (indexes into palette) + minutes for Mon..Sun (0 = no session that day).
        var students = new[]
        {
            new { Nick = "FocusFox",  Email = "focusfox@xmu.edu.my",  Cats = new[] { 0, 1, 2 }, Week = new[] { 50, 40, 60, 45, 55, 30, 70 } },
            new { Nick = "StudyStar", Email = "studystar@xmu.edu.my", Cats = new[] { 1, 3 },    Week = new[] { 30, 45,  0, 60, 25, 50,  0 } },
            new { Nick = "Snoozebun", Email = "snoozebun@xmu.edu.my", Cats = new[] { 0, 2, 4 }, Week = new[] { 25,  0, 35, 20,  0, 40, 15 } },
            new { Nick = "LazyLamb",  Email = "lazylamb@xmu.edu.my",  Cats = new[] { 2 },       Week = new[] { 20,  0,  0, 15,  0,  0, 10 } },
            new { Nick = "NightOwl",  Email = "nightowl@xmu.edu.my",  Cats = new[] { 1, 4 },    Week = new[] { 90,  0, 30,  0, 45,  0, 80 } },
        };

        foreach (var s in students)
        {
            var user = new User
            {
                Email = s.Email,
                Nickname = s.Nick,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Demo@1234"),
                Role = "User",
                AiTone = "Normal",
                Status = "Active",
                CreatedAt = now
            };
            db.Users.Add(user);
            db.SaveChanges(); // gain user.Id

            // This student's categories.
            var cats = new List<Category>();
            foreach (var ci in s.Cats)
            {
                var cat = new Category
                {
                    UserId = user.Id,
                    Name = palette[ci].Name,
                    Color = palette[ci].Color,
                    CreatedAt = now
                };
                db.Categories.Add(cat);
                cats.Add(cat);
            }
            db.SaveChanges(); // gain category Ids

            // One session per active day (Mon..Sun), rotating through the student's categories.
            for (int day = 0; day < 7; day++)
            {
                int mins = s.Week[day];
                if (mins == 0) continue;

                var cat = cats[day % cats.Count];
                db.StudySessions.Add(new StudySession
                {
                    UserId = user.Id,
                    CategoryId = cat.Id,
                    StartedAt = weekStartUtc.AddDays(day).AddHours(10), // ~10:00 MYT that day
                    Duration = mins * 60,
                    CreatedAt = now
                });
            }
            db.SaveChanges();
        }
    }

    // A single seeded task. day: 0 = today, -1 = yesterday (MYT). sh/eh = start/end hour MYT
    // (null = brain-dump only, no time). done = completed.
    private record TaskSpec(string Title, bool Imp, string Status, int Day, double? Sh, double? Eh, bool Done, string When);

    // ── Per-persona task boards (idempotent per user) ──
    // Each student gets a distinct mix so the Tasks board, gantt and "Yesterday's review"
    // look different on every demo account.
    private static void SeedTasks(NagStudyContext db)
    {
        var now = DateTime.UtcNow;
        var todayMyt = now.AddHours(8).Date; // MYT midnight today, as a wall-clock date

        var boards = new Dictionary<string, TaskSpec[]>
        {
            // Diligent top ranker — lots done, a single slip.
            ["FocusFox"] = new[]
            {
                new TaskSpec("Finish calculus problem set", true,  "Done",      -1, 9,  10,   true,  "Now"),
                new TaskSpec("Read English chapter 4",       false, "Done",      -1, 14, 15,   true,  "Now"),
                new TaskSpec("Evening vocabulary drill",     false, "Scheduled", -1, 20, 21,   false, "Now"),
                new TaskSpec("Review data structures lecture", true, "Scheduled", 0, 16, 17.5, false, "Now"),
                new TaskSpec("Email professor about project", false, "Inbox",     0, null, null, false, "Now"),
            },
            // Star student — everything done, no misses.
            ["StudyStar"] = new[]
            {
                new TaskSpec("Physics lab report",     true,  "Done",      -1, 10, 12, true, "Now"),
                new TaskSpec("Chemistry homework set 3", false, "Done",    -1, 13, 14, true, "Now"),
                new TaskSpec("Memorize biology terms", false, "Done",      -1, 19, 20, true, "Now"),
                new TaskSpec("Group study meeting",    false, "Scheduled",  0, 15, 16, false, "Now"),
                new TaskSpec("Prepare presentation slides", true, "Inbox",  0, null, null, false, "Later"),
            },
            // Sleepy — misses a morning, plenty left in the brain dump.
            ["Snoozebun"] = new[]
            {
                new TaskSpec("Morning revision",        false, "Scheduled", -1, 8,  9,  false, "Now"),
                new TaskSpec("Watch lecture recording", false, "Done",      -1, 22, 23, true,  "Now"),
                new TaskSpec("Statistics assignment",   true,  "Scheduled",  0, 14, 15, false, "Now"),
                new TaskSpec("Buy the new textbook",    false, "Inbox",      0, null, null, false, "Now"),
                new TaskSpec("Tidy desk, then study",   false, "Inbox",      0, null, null, false, "Later"),
            },
            // Lazy — mostly missed or never started.
            ["LazyLamb"] = new[]
            {
                new TaskSpec("History reading ch.2", false, "Scheduled", -1, 11, 12,   false, "Now"),
                new TaskSpec("Practice problems",    true,  "Scheduled", -1, 16, 17,   false, "Now"),
                new TaskSpec("Skim lecture slides",  false, "Done",      -1, 21, 21.5, true,  "Now"),
                new TaskSpec("Start the essay (someday)", false, "Inbox", 0, null, null, false, "Later"),
                new TaskSpec("Organize messy notes", false, "Inbox",      0, null, null, false, "Now"),
            },
            // Night owl — late-night blocks, an early lecture missed.
            ["NightOwl"] = new[]
            {
                new TaskSpec("Debug group project",   true,  "Done",      -1, 22, 23.5, true,  "Now"),
                new TaskSpec("Early morning lecture",  false, "Scheduled", -1, 9,  10,   false, "Now"),
                new TaskSpec("Algorithm practice",     true,  "Scheduled",  0, 21, 22.5, false, "Now"),
                new TaskSpec("Quick coding challenge", false, "Done",       0, 13, 13.5, true,  "Now"),
                new TaskSpec("Refill coffee supplies", false, "Inbox",      0, null, null, false, "Now"),
            },
        };

        foreach (var (nick, specs) in boards)
        {
            var user = db.Users.FirstOrDefault(u => u.Nickname == nick && u.Role == "User");
            if (user == null) continue;
            if (db.Tasks.Any(t => t.UserId == user.Id)) continue; // idempotent per user

            foreach (var p in specs)
            {
                DateTime? start = null, end = null, completed = null;
                if (p.Sh.HasValue)
                {
                    var dayMyt = todayMyt.AddDays(p.Day);
                    start = dayMyt.AddHours(p.Sh.Value).AddHours(-8);             // MYT wall-clock -> UTC
                    end   = dayMyt.AddHours(p.Eh ?? p.Sh.Value + 1).AddHours(-8);
                }
                if (p.Done) completed = end ?? now;

                db.Tasks.Add(new StudyTask
                {
                    UserId = user.Id,
                    Title = p.Title,
                    IsImportant = p.Imp,
                    When = p.When,
                    Status = p.Status,
                    StartTime = start,
                    EndTime = end,
                    CompletedAt = completed,
                    CreatedAt = now.AddDays(p.Day), // brain-dump tasks belong to their day via CreatedAt
                });
            }
            db.SaveChanges();
        }
    }
}
