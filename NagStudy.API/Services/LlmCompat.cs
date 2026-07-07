using System.Text.RegularExpressions;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.Google;
using Microsoft.SemanticKernel.Connectors.OpenAI;

namespace NagStudy.API.Services;

/// <summary>
/// Provider-agnostic LLM request/response normalization (Gemini, MiniMax, etc.).
/// </summary>
public static class LlmCompat
{
    // MiniMax M3: &lt;think&gt;, &lt;redacted_thinking&gt;, &lt;redacted_thinking&gt;, etc.
    private static readonly Regex ReasoningBlock = new(
        @"<(?:redacted_)?think(?:ing)?>[\s\S]*?</(?:redacted_)?think(?:ing)?>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ReasoningTag = new(
        @"</?(?:redacted_)?think(?:ing)?>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ActivitySummaryBlock = new(
        @"<ActivitySummery>[\s\S]*?</ActivitySummery>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ActivitySummaryTag = new(
        @"</?ActivitySummery>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Normalize raw model output for user-facing text (chat, nags, reports).</summary>
    public static string NormalizeAssistantText(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        return PlainTextFormatter.Sanitize(StripInternalTags(raw)).Trim();
    }

    /// <summary>Extract optional activity memory block before stripping from display text.</summary>
    public static string? ExtractActivitySummary(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var m = ActivitySummaryBlock.Match(raw);
        if (!m.Success) return null;
        var inner = ActivitySummaryTag.Replace(m.Value, "").Trim();
        return string.IsNullOrWhiteSpace(inner) ? null : inner;
    }

    /// <summary>Remove provider reasoning and activity memory tags from visible text.</summary>
    public static string StripInternalTags(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text ?? "";
        var s = StripReasoning(text);
        s = ActivitySummaryBlock.Replace(s, "");
        s = ActivitySummaryTag.Replace(s, "");
        return s.Trim();
    }

    /// <summary>Remove provider reasoning wrappers without markdown cleanup (e.g. JSON scheduling).</summary>
    public static string StripReasoning(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text ?? "";
        var s = ReasoningBlock.Replace(text, "");
        s = ReasoningTag.Replace(s, "");
        return s.Trim();
    }

#pragma warning disable SKEXP0070, SKEXP0010
    /// <summary>Provider-specific chat completion settings (tools, MiniMax reasoning_split, etc.).</summary>
    public static PromptExecutionSettings CreateChatSettings(IConfiguration config, bool enableTools = false)
    {
        if (LlmSettings.IsMiniMax(config))
        {
            var settings = new OpenAIPromptExecutionSettings
            {
                // Keep thinking out of content field when the API supports it.
                ExtensionData = new Dictionary<string, object> { ["reasoning_split"] = true }
            };
            if (enableTools)
                settings.FunctionChoiceBehavior = FunctionChoiceBehavior.Auto();
            return settings;
        }

        var gemini = new GeminiPromptExecutionSettings();
        if (enableTools)
            gemini.FunctionChoiceBehavior = FunctionChoiceBehavior.Auto();
        return gemini;
    }
#pragma warning restore SKEXP0070, SKEXP0010
}
