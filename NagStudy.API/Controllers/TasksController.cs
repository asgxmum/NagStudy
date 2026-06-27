using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Extensions;
using NagStudy.API.Infrastructure;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;
using NagStudy.API.Services;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly NagStudyContext _db;
    private readonly RagService _rag;

    public TasksController(NagStudyContext db, RagService rag)
    {
        _db = db;
        _rag = rag;
    }

    private int CurrentUserId => User.GetUserId();

    /// <summary>Today queue + Backlog + today's Gantt tasks in one payload.</summary>
    [HttpGet("board")]
    public async Task<IActionResult> GetBoard()
    {
        var todayMyt = TaskTimeHelper.TodayMyt();
        var all = await _db.Tasks
            .Where(t => t.UserId == CurrentUserId)
            .OrderByDescending(t => t.IsImportant)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync();

        var board = new TaskBoardResponse
        {
            Today = all.Where(t => TaskTimeHelper.IsTodayBoard(t, todayMyt)).Select(TaskMapper.ToResponse).ToList(),
            Backlog = all.Where(t => TaskTimeHelper.IsBacklog(t, todayMyt)).Select(TaskMapper.ToResponse).ToList(),
            Gantt = all.Where(t => TaskTimeHelper.IsOnGanttToday(t, todayMyt)).Select(TaskMapper.ToResponse).ToList(),
        };
        return Ok(board);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? date = null)
    {
        var query = _db.Tasks.Where(t => t.UserId == CurrentUserId);

        if (!string.IsNullOrWhiteSpace(date))
        {
            var todayMyt = TaskTimeHelper.TodayMyt();
            DateTime dayMyt;
            if (date == "today") dayMyt = todayMyt;
            else if (date == "yesterday") dayMyt = todayMyt.AddDays(-1);
            else if (DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                dayMyt = parsed.Date;
            else return BadRequest(new { message = "Invalid date. Use 'today', 'yesterday', or YYYY-MM-DD." });

            var dayStartUtc = TaskTimeHelper.MytDayStartUtc(dayMyt);
            var dayEndUtc = TaskTimeHelper.MytDayEndUtc(dayMyt);

            query = query.Where(t =>
                (t.ScheduledDate != null && t.ScheduledDate >= dayStartUtc && t.ScheduledDate < dayEndUtc) ||
                (t.StartTime != null && t.StartTime >= dayStartUtc && t.StartTime < dayEndUtc) ||
                (t.ScheduledDate == null && t.StartTime == null && t.CreatedAt >= dayStartUtc && t.CreatedAt < dayEndUtc));
        }

        var items = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        return Ok(items.Select(TaskMapper.ToResponse));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetOne(int id)
    {
        var item = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == CurrentUserId);
        if (item == null) return NotFound();
        return Ok(TaskMapper.ToResponse(item));
    }

    [HttpPost]
    public async Task<IActionResult> Create(TaskRequest request)
    {
        var task = new StudyTask { UserId = CurrentUserId };
        TaskMapper.ApplyRequest(task, request, isCreate: true);
        _db.Tasks.Add(task);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = task.Id }, TaskMapper.ToResponse(task));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, TaskRequest request)
    {
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == CurrentUserId);
        if (task == null) return NotFound();

        var prevStart = task.StartTime;
        var prevEnd = task.EndTime;
        TaskMapper.ApplyRequest(task, request, isCreate: false);
        if (task.StartTime != prevStart)
            task.StartReminderSentAt = null;
        if (task.EndTime != prevEnd)
            task.EndPromptSentAt = null;
        await _db.SaveChangesAsync();
        _rag.SyncTaskIndexFireAndForget(CurrentUserId, task);
        return Ok(TaskMapper.ToResponse(task));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == CurrentUserId);
        if (task == null) return NotFound();

        _db.Tasks.Remove(task);
        await _db.SaveChangesAsync();
        _rag.DeleteDocumentFireAndForget(CurrentUserId, "Task", task.Id);
        return NoContent();
    }
}
