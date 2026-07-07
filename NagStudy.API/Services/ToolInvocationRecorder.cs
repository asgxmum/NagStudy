namespace NagStudy.API.Services;

/// <summary>Per-request tool call log for coach agent sessions.</summary>
public sealed class ToolInvocationRecorder
{
    readonly List<ToolInvocationRecord> _records = new();
    public IReadOnlyList<ToolInvocationRecord> Records => _records;

    public void Record(string toolName, string? arguments, string result) =>
        _records.Add(new ToolInvocationRecord(toolName, arguments, result));

    public static string FormatRecord(ToolInvocationRecord record)
    {
        var args = string.IsNullOrWhiteSpace(record.Arguments) ? "" : $"\nArgs: {record.Arguments.Trim()}";
        return $"[{record.ToolName}]{args}\n{record.Result.Trim()}";
    }
}

public sealed record ToolInvocationRecord(string ToolName, string? Arguments, string Result);

public static class CoachToolScope
{
    static readonly AsyncLocal<ToolInvocationRecorder?> Current = new();

    public static ToolInvocationRecorder Begin() => Current.Value = new ToolInvocationRecorder();

    public static ToolInvocationRecorder? Active => Current.Value;

    public static void Clear() => Current.Value = null;
}
