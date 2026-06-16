using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")] //for /api/studysessions
[Authorize]
public class StudySessionsController : ControllerBase
{
    private readonly NagStudyContext _db;
    public StudySessionsController(NagStudyContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    //GET /api/studysessions - whole my session
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await _db.StudySessions
            .Where(s => s.UserId == CurrentUserId)
            .OrderByDescending(s => s.StartedAt)
            .ToListAsync();
        return Ok(items);
    }

    //GET /api/studysessions/5
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(int id)
    {
        var item = await _db.StudySessions
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId);
        if (item == null) return NotFound();
        return Ok(item);
    }

    //POST /api/studysessions
    [HttpPost]
    public async Task<IActionResult> Create(StudySessionRequest request)
    {
        //Check if the category is mine
        var categoryOk = await _db.Categories
            .AnyAsync(c => c.Id == request.CategoryId && c.UserId == CurrentUserId);
        if (!categoryOk) return BadRequest(new { message = "Category not found." });

        //If a task has been assigned, confirm that it's mine
        if (request.TaskId != null)
        {
            var taskOk = await _db.Tasks
                .AnyAsync(t => t.Id == request.TaskId && t.UserId == CurrentUserId);
            if (!taskOk) return BadRequest(new { message = "Task not found." });


        }

        //Reject future-dated sessions (5-min skew tolerance) so the ranking/dashboard can't be gamed.
        //The client sends StartedAt as a UTC 'Z' timestamp, matching how it is stored.
        if (request.StartedAt > DateTime.UtcNow.AddMinutes(5))
            return BadRequest(new { message = "StartedAt cannot be in the future." });

        var session = new StudySession
        {
            UserId = CurrentUserId,
            CategoryId = request.CategoryId,
            TaskId = request.TaskId,
            StartedAt = request.StartedAt,
            Duration = request.Duration,
            CreatedAt = DateTime.UtcNow
        };
        _db.StudySessions.Add(session);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetOne), new { id = session.Id }, session);
    }

    // DELETE /api/studysessions/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var session = await _db.StudySessions
            .FirstOrDefaultAsync(s => s.Id == id && s.UserId == CurrentUserId);
        if (session == null) return NotFound();

        _db.StudySessions.Remove(session);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
