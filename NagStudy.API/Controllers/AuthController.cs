using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;
using NagStudy.API.Services;

namespace NagStudy.API.Controllers;

[ApiController]
[Route("api/[controller]")] // => /api/auth
public class AuthController : ControllerBase
{
    private readonly NagStudyContext _db;
    private readonly TokenService _tokenService;
    private const string XmuDomain = "@xmu.edu.my";

    public AuthController(NagStudyContext db, TokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    //POST /api/auth/register
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLower();

        //Only permit xmum email 
        if (!email.EndsWith(XmuDomain))
            return BadRequest(new { message = "Use your XMU email (@xmu.edu.my)." });

        //No duplicate emails
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest(new { message = "This email is already registered." });

        //No duplicate nickname
        if (await _db.Users.AnyAsync(u => u.Nickname == request.Nickname))
            return BadRequest(new { message = "This nickname is already taken." });

        //Account Creation with hashed passwords
        var user = new User
        {
            Email = email,
            Nickname = request.Nickname,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "User",
            AiTone = "Normal",
            AiNotificationsEnabled = true,
            Status = "Active",
            CreatedAt = DateTime.UtcNow
        };
        _db.Users.Add(user);
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Lost a race against a concurrent signup with the same email/nickname
            // (the pre-checks above passed, but the unique index rejected the insert).
            return BadRequest(new { message = "This email or nickname is already taken." });
        }

        //One default category for new users (compared to Session CategoryId NOT NULL)
        _db.Categories.Add(new Category
        {
            UserId = user.Id,
            Name = "General",
            Color = "#E8734A",
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        var normalProfile = await _db.AgentProfiles.FirstOrDefaultAsync(p => p.IsBuiltIn && p.Key == "Normal");
        if (normalProfile != null)
            user.NagProfileId = normalProfile.Id;

        await _db.SaveChangesAsync();

        return Ok(await BuildAuthResponse(user));
    }

    private async Task<AuthResponse> BuildAuthResponse(User user)
    {
        await _db.Entry(user).Reference(u => u.NagProfile).LoadAsync();
        return new AuthResponse
        {
            Token = _tokenService.GenerateToken(user),
            Email = user.Email,
            Nickname = user.Nickname,
            Role = user.Role,
            AiTone = user.NagProfile?.Key ?? user.AiTone,
            NagProfileId = user.NagProfileId,
            NagProfileName = user.NagProfile?.Name,
            NagProfileKey = user.NagProfile?.Key,
            HasSeenTutorial = user.HasSeenTutorial
        };
    }

    //POST /api/auth/login
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLower();

        //1. To find user by email
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        //2. No user or incorrect password → Same message (does not specify which is incorrect = security)
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        //3. Block banned/deleted accounts
        if (user.Status != "Active")
            return Unauthorized(new { message = "This account is not active" });

        return Ok(await BuildAuthResponse(user));
    }
}