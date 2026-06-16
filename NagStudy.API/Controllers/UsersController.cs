using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Models.DTO;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")] // for /api/users
[Authorize]
public class UsersController : ControllerBase
{
    private readonly NagStudyContext _db;

    public UsersController(NagStudyContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    //GET /api/users/me - my profile (email is the locked login id)
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user == null) return NotFound();
        return Ok(new { user.Email, user.Nickname, user.Role, user.AiTone });
    }

    //PUT /api/users/me - change my nickname (must stay unique)
    [HttpPut("me")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileRequest request)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user == null) return NotFound();

        var dup = await _db.Users
            .AnyAsync(u => u.Nickname == request.Nickname && u.Id != CurrentUserId);
        if (dup) return BadRequest(new { message = "That nickname is already taken." });

        user.Nickname = request.Nickname;
        await _db.SaveChangesAsync();
        return Ok(new { user.Email, user.Nickname, user.Role, user.AiTone });
    }

    //PUT /api/users/me/tone - change my AI coach persona (Soft/Normal/Harsh)
    [HttpPut("me/tone")]
    public async Task<IActionResult> UpdateTone(UpdateToneRequest request)
    {
        var allowed = new[] { "Soft", "Normal", "Harsh" };
        if (!allowed.Contains(request.AiTone))
            return BadRequest(new { message = "Invalid tone. Use Soft, Normal, or Harsh." });

        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user == null) return NotFound();

        user.AiTone = request.AiTone;
        await _db.SaveChangesAsync();
        return Ok(new { user.Email, user.Nickname, user.Role, user.AiTone });
    }

    //PUT /api/users/me/password - change my password (verify current, re-hash new)
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
}
