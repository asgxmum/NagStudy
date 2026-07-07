using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.SemanticKernel;

namespace NagStudy.API.Infrastructure;

// Catches any unhandled exception, logs it server-side, and returns a clean
// ProblemDetails response so stack traces never leak to the client.
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) => _logger = logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized."),
            HttpOperationException op when (int?)op.StatusCode is 429 =>
                (StatusCodes.Status503ServiceUnavailable,
                    "Gemini rate limit reached. Wait a minute and try again, or enable billing in Google AI Studio."),
            HttpOperationException op when (int?)op.StatusCode is 503 =>
                (StatusCodes.Status503ServiceUnavailable,
                    "Gemini is temporarily unavailable (503). Wait a moment and try again, or check Google AI Studio status."),
            HttpOperationException op when (int?)op.StatusCode is 401 or 403 =>
                (StatusCodes.Status503ServiceUnavailable,
                    "LLM API key rejected. Check Gemini:ApiKey or MiniMax:ApiKey in user-secrets. "
                    + "For MiniMax Token Plan (sk-cp-), set MiniMax:BaseUrl to match your subscription region: "
                    + "https://api.minimaxi.com/v1 (China) or https://api.minimax.io/v1 (Global)."),
            InvalidOperationException inv when inv.Message.Contains("API key", StringComparison.OrdinalIgnoreCase) =>
                (StatusCodes.Status503ServiceUnavailable, inv.Message),
            SqlException sql when sql.Number is 208 =>
                (StatusCodes.Status500InternalServerError,
                    "Database schema is out of date (missing table). Restart the API once — it will auto-sync. If the error persists, recreate NagStudyDb."),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred."),
        };

        if (status >= StatusCodes.Status500InternalServerError)
            _logger.LogError(exception, "Unhandled exception");

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(
            new { message = title, status, title },
            cancellationToken);

        return true;
    }
}
