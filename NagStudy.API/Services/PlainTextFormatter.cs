using System.Text.RegularExpressions;

namespace NagStudy.API.Services;

public static class PlainTextFormatter
{
    public const string OutputRules = """
        OUTPUT FORMAT (mandatory):
        - Plain text ONLY. Never use Markdown: no #, ##, **, *, `, ```, or ---.
        - Section titles on their own line: ── Title ──
        - Bullet lines start with • (unicode bullet)
        - Short paragraphs separated by blank lines.
        """;

    /// <summary>Strip common Markdown leftovers from model output.</summary>
    public static string Sanitize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var s = text;
        s = Regex.Replace(s, @"^#{1,6}\s*", "", RegexOptions.Multiline);
        s = Regex.Replace(s, @"\*\*(.+?)\*\*", "$1");
        s = Regex.Replace(s, @"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", "$1");
        s = Regex.Replace(s, @"^[-*]\s+", "• ", RegexOptions.Multiline);
        s = Regex.Replace(s, @"^---+\s*$", "──", RegexOptions.Multiline);
        return s.Trim();
    }
}
