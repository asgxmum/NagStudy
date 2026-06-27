namespace NagStudy.API.Models.DTO;

public class ProfileResponse
{
    public int Id { get; set; }
    public string? Key { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string SystemPrompt { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public bool IsBuiltIn { get; set; }
}

public class CreateSessionRequest
{
    public int ProfileId { get; set; }
}

public class UpdateSessionRequest
{
    public string Title { get; set; } = string.Empty;
}

public class SessionResponse
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public string ProfileName { get; set; } = string.Empty;
    public string? ProfileKey { get; set; }
    public string ProfileColor { get; set; } = string.Empty;
    public string? ProfileAvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string? LastMessagePreview { get; set; }
}

public class ChatMessageResponse
{
    public int Id { get; set; }
    public string Role { get; set; } = string.Empty;
    public string MessageType { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
}

public class ChatReplyResponse
{
    public string Reply { get; set; } = string.Empty;
    public int UserMessageId { get; set; }
    public int AssistantMessageId { get; set; }
}

public class ReportRequest
{
    public string Period { get; set; } = "week"; // week | 7days | 30days | custom
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public string Language { get; set; } = "English";
}

public class TriggerRequest
{
    public string Trigger { get; set; } = string.Empty;
    /// <summary>Debug / manual replay — bypass cooldown and once-per-day gates.</summary>
    public bool Force { get; set; }
    /// <summary>Required for TaskStarting / TaskEnded.</summary>
    public int? TaskId { get; set; }
    /// <summary>Tasks-page debug now-line (minutes 0–1439 MYT). Overrides server clock for task triggers only.</summary>
    public int? DebugNowMinutes { get; set; }
    /// <summary>Live Pomodoro/focus snapshot from the client (Nagging).</summary>
    public NaggingContextDto? NaggingContext { get; set; }
}

public class NaggingContextDto
{
    public bool IsFocusing { get; set; }
    public int? FocusTaskId { get; set; }
    public string? FocusTaskTitle { get; set; }
    public string? FocusCategory { get; set; }
    public int FocusElapsedMinutes { get; set; }
}

public class NagResponse
{
    public int Id { get; set; }
    public string Trigger { get; set; } = string.Empty;
    public string? Tone { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class TriggerResultResponse
{
    public bool ShouldShow { get; set; }
    public string? Message { get; set; }
    public int? NagId { get; set; }
    public int CooldownRemainingSeconds { get; set; }
    public int? TaskId { get; set; }
    public string? TaskTitle { get; set; }
    /// <summary>TaskEnded — show Done / Not yet buttons.</summary>
    public bool ShowTaskActions { get; set; }
}

public class UpdateNagProfileRequest
{
    public int ProfileId { get; set; }
}

public class UpdateAiNotificationsRequest
{
    public bool Enabled { get; set; }
}
