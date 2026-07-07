using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NagStudy.API.Extensions;
using NagStudy.API.Models.DTO;
using NagStudy.API.Services;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/coach")]
[Authorize]
public class CoachController : ControllerBase
{
    private readonly CoachService _coach;
    private readonly TriggerService _trigger;

    public CoachController(CoachService coach, TriggerService trigger)
    {
        _coach = coach;
        _trigger = trigger;
    }

    private int UserId => User.GetUserId();

    [HttpGet("profiles")]
    public async Task<IActionResult> ListProfiles() =>
        Ok(await _coach.ListProfilesAsync());

    [HttpGet("sessions")]
    public async Task<IActionResult> ListSessions() =>
        Ok(await _coach.ListSessionsAsync(UserId));

    [HttpPost("sessions")]
    public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest req)
    {
        try { return Ok(await _coach.CreateSessionAsync(UserId, req.ProfileId)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("sessions/{id:int}")]
    public async Task<IActionResult> DeleteSession(int id)
    {
        if (!await _coach.DeleteSessionAsync(UserId, id)) return NotFound();
        return NoContent();
    }

    [HttpPatch("sessions/{id:int}")]
    public async Task<IActionResult> UpdateSession(int id, [FromBody] UpdateSessionRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { message = "Title is required." });
        try
        {
            var session = await _coach.UpdateSessionTitleAsync(UserId, id, req.Title);
            if (session == null) return NotFound();
            return Ok(session);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("sessions/{id:int}/messages")]
    public async Task<IActionResult> GetMessages(int id)
    {
        try { return Ok(await _coach.GetMessagesAsync(UserId, id)); }
        catch (UnauthorizedAccessException) { return NotFound(); }
    }

    [HttpPost("sessions/{id:int}/chat")]
    public async Task<IActionResult> Chat(int id, [FromBody] ChatRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Message))
            return BadRequest(new { message = "Message is required." });
        try { return Ok(await _coach.ChatAsync(UserId, id, req.Message)); }
        catch (UnauthorizedAccessException) { return NotFound(); }
        catch (InvalidOperationException ex) { return StatusCode(503, new { message = ex.Message }); }
    }

    [HttpPost("sessions/{id:int}/report")]
    public async Task<IActionResult> Report(int id, [FromBody] ReportRequest req)
    {
        try { return Ok(await _coach.GenerateReportAsync(UserId, id, req)); }
        catch (UnauthorizedAccessException) { return NotFound(); }
        catch (InvalidOperationException ex) { return StatusCode(503, new { message = ex.Message }); }
    }

    [HttpPost("trigger")]
    public async Task<IActionResult> Trigger([FromBody] TriggerRequest req) =>
        Ok(await _trigger.TriggerAsync(UserId, req.Trigger, req.Force, req.TaskId, req.DebugNowMinutes, req.NaggingContext));

    [HttpGet("nags")]
    public async Task<IActionResult> ListNags() =>
        Ok(await _trigger.ListNagsAsync(UserId));
}
