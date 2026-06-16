using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")] // for /api/ranking
[Authorize]
public class RankingController : ControllerBase
{
    private readonly NagStudyContext _db;

    public RankingController(NagStudyContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    //Convert the start of this week (Monday 00:00 MYT) to UTC
    private static DateTime GetWeekStartUtc()
    {
        var nowMyt = DateTime.UtcNow.AddHours(8);              // MYT = UTC+8
        int daysSinceMonday = ((int)nowMyt.DayOfWeek + 6) % 7; // 월=0 … 일=6
        var mondayMyt = nowMyt.Date.AddDays(-daysSinceMonday); // 이번주 월요일 00:00 MYT
        return mondayMyt.AddHours(-8);                         // 다시 UTC
    }

    //GET /api/ranking - student ranking of this week
    [HttpGet]
    public async Task<IActionResult> GetWeekly()
    {
        var weekStart = GetWeekStartUtc();

        //1.  Total duration for active students this week
        var totals = await _db.Users
            .Where(u => u.Status == "Active" && u.Role == "User")
            .Select(u => new
            {
                u.Id,
                u.Nickname,
                TotalSeconds = _db.StudySessions
                         .Where(s => s.UserId == u.Id && s.StartedAt >= weekStart)
                         .Sum(s => (int?)s.Duration) ?? 0
            })
            .ToListAsync();

        //2. Sum in Descending Order + Ranking (In Memory)
        var ranked = totals
                .OrderByDescending(x => x.TotalSeconds)
                .ThenBy(x => x.Nickname)
                .Select((x, i) => new
                {
                    Rank = i + 1,
                    x.Id,
                    x.Nickname,
                    x.TotalSeconds,
                    IsMe = x.Id == CurrentUserId

                })
                .ToList();

        return Ok(ranked);
    }
}