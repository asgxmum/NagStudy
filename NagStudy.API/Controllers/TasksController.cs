using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")] // for /api/tasks
[Authorize]
public class TasksController : ControllerBase
{
    private readonly NagStudyContext _db;

    public TasksController(NagStudyContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    //GET /api/tasks                  -> all my tasks (back-compat)
    //GET /api/tasks?date=today       -> only tasks that belong to today (MYT)
    //GET /api/tasks?date=yesterday   -> only yesterday's (MYT) — for the "Yesterday's review" card
    //GET /api/tasks?date=2026-06-15  -> a specific MYT day
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? date = null)
    {
        var query = _db.Tasks.Where(t => t.UserId == CurrentUserId);

        if (!string.IsNullOrWhiteSpace(date))
        {
            // Which MYT calendar day are we asking about?
            var todayMyt = DateTime.UtcNow.AddHours(8).Date;
            DateTime dayMyt;
            if (date == "today") dayMyt = todayMyt;
            else if (date == "yesterday") dayMyt = todayMyt.AddDays(-1);
            else if (DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)) dayMyt = parsed.Date;
            else return BadRequest(new { message = "Invalid date. Use 'today', 'yesterday', or YYYY-MM-DD." });

            // [start, end) of that MYT day, expressed in UTC (how times are stored).
            var dayStartUtc = dayMyt.AddHours(-8);
            var dayEndUtc = dayStartUtc.AddDays(1);

            // A task belongs to a day by its scheduled StartTime if placed on the Gantt,
            // otherwise by the day it was brain-dumped (CreatedAt).
            query = query.Where(t =>
                (t.StartTime != null && t.StartTime >= dayStartUtc && t.StartTime < dayEndUtc) ||
                (t.StartTime == null && t.CreatedAt >= dayStartUtc && t.CreatedAt < dayEndUtc));
        }

        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
        return Ok(items);
    }

    //GET /api/tasks/5
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(int id)
    {
        var item = await _db.Tasks
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == CurrentUserId);
        if (item == null) return NotFound();
        return Ok(item);
    }

    //POST /api/tasks
    [HttpPost]
    public async Task<IActionResult> Create(TaskRequest request)
    {
        var task = new StudyTask
        {
            UserId = CurrentUserId,
            Title = request.Title,
            IsImportant = request.IsImportant,
            When = request.When,
            Status = request.Status,
            Color = request.Color,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            CompletedAt = request.CompletedAt,
            CreatedAt = DateTime.UtcNow
        };
        _db.Tasks.Add(task);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = task.Id }, task);
    }

    //PUT /api/tasks/5 
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, TaskRequest request)
    {
        var task = await _db.Tasks
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == CurrentUserId);
        if (task == null) return NotFound();

        task.Title = request.Title;
        task.IsImportant = request.IsImportant;
        task.When = request.When;
        task.Status = request.Status;
        task.Color = request.Color;
        task.StartTime = request.StartTime;
        task.EndTime = request.EndTime;
        task.CompletedAt = request.CompletedAt;
        await _db.SaveChangesAsync();
        return Ok(task);
    }

    //DELETE /api/tasks/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var task = await _db.Tasks
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == CurrentUserId);
        if (task == null) return NotFound();

        _db.Tasks.Remove(task); //The TaskId of the associated session is automatically set to null by the database 
        await _db.SaveChangesAsync();
        return NoContent();

    }
}