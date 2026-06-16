using System.Security.Claims;

namespace NagStudy.API.Extensions;

// Centralizes reading the signed-in user's id from the JWT's NameIdentifier claim.
// Throws UnauthorizedAccessException for a missing/malformed claim so the global
// exception handler turns it into a clean 401 instead of an unhandled 500.
public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(raw, out var id))
            throw new UnauthorizedAccessException("Invalid or missing user identity in token.");
        return id;
    }
}
