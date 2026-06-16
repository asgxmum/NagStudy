using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NagStudy.API.Data;
using NagStudy.API.Services;
using NagStudy.API.Models.Domain;
using NagStudy.API.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddDbContext<NagStudyContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

//Register TokenService
builder.Services.AddSingleton<TokenService>();

//Global exception handling → clean ProblemDetails responses (no stack-trace leak)
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

//JWT Verification, verify incoming token
var jwt = builder.Configuration.GetSection("Jwt");
// The signing key is a secret — it lives in user-secrets (dev) / env vars (prod), NOT appsettings.json.
// Fail fast with a clear message instead of a confusing NullReferenceException if it's not set.
var jwtKey = jwt["Key"] ?? throw new InvalidOperationException(
    "JWT signing key is missing. Set it with:  dotnet user-secrets set \"Jwt:Key\" \"<32+ char random string>\"  (see README.md).");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwt["Issuer"],
        ValidAudience = jwt["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

//CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
       policy.WithOrigins("http://localhost:5173")
             .AllowAnyHeader()
             .AllowAnyMethod());
});

var app = builder.Build();

//---Admin Seed(If there is no admin when the app starts, create one)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();

    if (!db.Users.Any(u => u.Role == "Admin"))
    {
        var adminCfg = app.Configuration.GetSection("Admin");
        var adminPw = adminCfg["Password"]; // secret — from user-secrets / env, not appsettings.json
        if (string.IsNullOrWhiteSpace(adminPw))
        {
            app.Logger.LogWarning(
                "Admin:Password not set — skipping admin seed. Set it with: dotnet user-secrets set \"Admin:Password\" \"...\" (see README.md).");
        }
        else
        {
            db.Users.Add(new User
            {
                Email = adminCfg["Email"]!.ToLower(),
                Nickname = adminCfg["Nickname"]!,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPw),
                Role = "Admin",
                AiTone = "Normal",
                Status = "Active",
                CreatedAt = DateTime.UtcNow
            });
            db.SaveChanges();
        }
    }

    //Inject demo data only in the development environment.
    //Runs every startup, but each step is idempotent (skips data that already exists).
    if (app.Environment.IsDevelopment())
        DemoSeeder.Seed(db);
}

// Configure the HTTP request pipeline.
// Exception handler goes first so it wraps every downstream middleware/endpoint.
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication(); //Check totken 

app.UseAuthorization();

app.MapControllers();

app.Run();
