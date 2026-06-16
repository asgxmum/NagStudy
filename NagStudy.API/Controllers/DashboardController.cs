using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")] // for /api/dashboard
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly NagStudyContext _db;
    public DashboardController(NagStudyContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    //This Monday at 12:00 a.m. MYT → UTC
    private static DateTime GetWeekStartUtc()
    {
        var nowMyt = DateTime.UtcNow.AddHours(8);
        int daysSinceMonday = ((int)nowMyt.DayOfWeek + 6) % 7;
        return nowMyt.Date.AddDays(-daysSinceMonday).AddHours(-8);
    }

    //Today 00:00 MYT -> UTC
    private static DateTime GetTodayStartUtc()
    {
        var nowMyt = DateTime.UtcNow.AddHours(8);
        return nowMyt.Date.AddHours(-8);
    }

    //GET /api/dashboard -> My study hours and tasks summary 
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var weekStart = GetWeekStartUtc();
        var todayStart = GetTodayStartUtc();

        //Retrieve this week's sessions into memory and aggregate them
        var weekSessions = await _db.StudySessions
            .Where(s => s.UserId == CurrentUserId && s.StartedAt >= weekStart)
            .Select(s => new { s.CategoryId, s.StartedAt, s.Duration })
            .ToListAsync();
        var todaySeconds = weekSessions
            .Where(s => s.StartedAt >= todayStart && s.StartedAt < todayStart.AddDays(1))
            .Sum(s => s.Duration);
        var weekSeconds = weekSessions.Sum(s => s.Duration);

        //Totals by Category (Labeling by Name and Color) — For Donut Charts
        var categories = await _db.Categories
            .Where(c => c.UserId == CurrentUserId)
            .ToListAsync();
        var byCategory = weekSessions
        .GroupBy(s => s.CategoryId)
        .Select(g =>
        {
            var cat = categories.FirstOrDefault(c => c.Id == g.Key);
            return new
            {
                CategoryId = g.Key,
                Name = cat?.Name ?? "?",
                Color = cat?.Color ?? "#999999",
                Seconds = g.Sum(s => s.Duration)
            };
        })
        .OrderByDescending(x => x.Seconds)
        .ToList();

        //Totals by day(MYT) - weekly barchart 
        var byDay = weekSessions
            .GroupBy(s => s.StartedAt.AddHours(8).Date)
            .Select(g => new { Date = g.Key.ToString("yyyy-MM-dd"), Seconds = g.Sum(s => s.Duration) })
            .OrderBy(x => x.Date)
            .ToList();

        return Ok(new { todaySeconds, weekSeconds, byCategory, byDay });
    }
}