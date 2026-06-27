using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.SemanticKernel;
using NagStudy.API.Data;
using NagStudy.API.Services;
using NagStudy.API.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddDbContext<NagStudyContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

//Register TokenService
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<CoachKernelFactory>();
builder.Services.AddSingleton<CoachFunctionInvocationFilter>();
builder.Services.AddScoped<GeminiEmbeddingService>();
builder.Services.AddScoped<RagService>();
builder.Services.AddScoped<CoachService>();
builder.Services.AddScoped<TriggerService>();

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

//CORS — Vite may use 5173+ when ports are busy; allow any localhost origin in dev.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyHeader().AllowAnyMethod();
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                return uri.Host is "localhost" or "127.0.0.1";
            });
        }
        else
        {
            policy.WithOrigins("http://localhost:5173");
        }
    });
});

var app = builder.Build();

//--- Database: EnsureCreated from current model + seed data (no EF migrations)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();
    DatabaseInitializer.Initialize(db, app.Configuration, app.Logger);

    if (app.Environment.IsDevelopment())
        DatabaseInitializer.SeedDevelopmentData(db);
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
