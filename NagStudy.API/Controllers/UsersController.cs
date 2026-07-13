using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Models.DTO;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly NagStudyContext _db;

    public UsersController(NagStudyContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _db.Users.Include(u => u.NagProfile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
        if (user == null) return NotFound();
        return Ok(MapUser(user));
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
    {
        var user = await _db.Users.Include(u => u.NagProfile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
        if (user == null) return NotFound();

        var dup = await _db.Users
            .AnyAsync(u => u.Nickname == request.Nickname && u.Id != CurrentUserId);
        if (dup) return BadRequest(new { message = "That nickname is already taken." });

        user.Nickname = request.Nickname;
        await _db.SaveChangesAsync();
        return Ok(MapUser(user));
    }

    [HttpPut("me/nag-profile")]
    public async Task<IActionResult> UpdateNagProfile(UpdateNagProfileRequest request)
    {
        var user = await _db.Users.Include(u => u.NagProfile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
        if (user == null) return NotFound();

        var profile = await _db.AgentProfiles.FirstOrDefaultAsync(p =>
            p.Id == request.ProfileId && p.IsBuiltIn);
        if (profile == null) return BadRequest(new { message = "Profile not found." });

        user.NagProfileId = profile.Id;
        user.AiTone = profile.Key ?? user.AiTone;
        await _db.SaveChangesAsync();
        return Ok(MapUser(user));
    }

    [HttpPut("me/ai-notifications")]
    public async Task<IActionResult> UpdateAiNotifications(UpdateAiNotificationsRequest request)
    {
        var user = await _db.Users.Include(u => u.NagProfile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
        if (user == null) return NotFound();
        user.AiNotificationsEnabled = request.Enabled;
        await _db.SaveChangesAsync();
        return Ok(MapUser(user));
    }

    /// <summary>Legacy endpoint — maps tone key to system profile</summary>
    [HttpPut("me/tone")]
    public async Task<IActionResult> UpdateTone(UpdateToneRequest request)
    {
        var allowed = new[] { "Soft", "Normal", "Harsh" };
        if (!allowed.Contains(request.AiTone))
            return BadRequest(new { message = "Invalid tone. Use Soft, Normal, or Harsh." });

        var profile = await _db.AgentProfiles.FirstOrDefaultAsync(p => p.IsBuiltIn && p.Key == request.AiTone);
        if (profile == null) return BadRequest(new { message = "Profile not found." });

        var user = await _db.Users.Include(u => u.NagProfile).FirstOrDefaultAsync(u => u.Id == CurrentUserId);
        if (user == null) return NotFound();

        user.AiTone = request.AiTone;
        user.NagProfileId = profile.Id;
        await _db.SaveChangesAsync();
        return Ok(MapUser(user));
    }

    [HttpPut("me/password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user == null) return NotFound();

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Your current password is incorrect." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("me/tutorial")]
    public async Task<IActionResult> CompleteTutorial()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user == null) return NotFound();
        user.HasSeenTutorial = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static object MapUser(Models.Domain.User user) => new
    {
        user.Email,
        user.Nickname,
        user.Role,
        aiTone = user.NagProfile?.Key ?? user.AiTone,
        nagProfileId = user.NagProfileId,
        nagProfileName = user.NagProfile?.Name,
        nagProfileKey = user.NagProfile?.Key,
        aiNotificationsEnabled = user.AiNotificationsEnabled,
        hasSeenTutorial = user.HasSeenTutorial
    };
}
