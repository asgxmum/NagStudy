using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Models.DTO;
using NagStudy.API.Extensions;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly NagStudyContext _db;

    public AdminController(NagStudyContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers()
    {
        var users = await _db.Users
            .Where(u => u.Id != CurrentUserId)
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new AdminUserResponse
            {
                Id = u.Id,
                Email = u.Email,
                Nickname = u.Nickname,
                Role = u.Role,
                Status = u.Status,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPut("users/{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return NotFound(new { message = "User not found" });

        if (user.Role == "Admin") 
            return BadRequest(new { message = "Cannot modify another admin's status." });

        user.Status = request.Status;
        await _db.SaveChangesAsync();

        return Ok(new AdminUserResponse
        {
            Id = user.Id,
            Email = user.Email,
            Nickname = user.Nickname,
            Role = user.Role,
            Status = user.Status,
            CreatedAt = user.CreatedAt
        });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetAdminStats()
    {
        // 1. Calculate total registered users (excluding permanently deleted ones and admins)
        var totalUsers = await _db.Users
            .CountAsync(u => u.Role == "User" && u.Status != "Deleted");

        // 2. Calculate active users
        var activeUsers = await _db.Users
            .CountAsync(u => u.Role == "User" && u.Status == "Active");

        // 3. Calculate total focus hours across all users
        // StudySession.Duration is stored in seconds, so we divide by 3600
        var totalFocusSeconds = await _db.StudySessions.SumAsync(s => s.Duration);
        var totalFocusHours = Math.Round(totalFocusSeconds / 3600.0, 1);

        // 4. Calculate active percentage safely
        var activePercentage = totalUsers == 0 ? 0 : Math.Round((double)activeUsers / totalUsers * 100);

        // Return as JSON
        return Ok(new
        {
            totalUsers = totalUsers,
            activeUsers = activeUsers,
            activePercentage = activePercentage,
            totalFocusHours = totalFocusHours
        });
    }
}