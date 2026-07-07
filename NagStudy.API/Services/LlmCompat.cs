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



    private static readonly Regex InsightBlock = new(

        @"<Insight(?:\s+category=""([^""]*)"")?>[\s\S]*?</Insight>",

        RegexOptions.IgnoreCase | RegexOptions.Compiled);



    private static readonly Regex InsightTag = new(

        @"</?Insight(?:\s+category=""[^""]*"")?>",

        RegexOptions.IgnoreCase | RegexOptions.Compiled);



    private static readonly Regex PersonalFactSignal = new(

        @"\d{1,2}\s*岁|年龄|我是.{2,}|在读|就读于|大学|学院|专业|本科|硕士|博士|工作|职业|住在|位于|习惯|爱好|喜欢.{2,}|男生|女生|major|student|years?\s*old",

        RegexOptions.IgnoreCase | RegexOptions.Compiled);



    private static readonly Regex AgeCn = new(@"(\d{1,2})\s*岁", RegexOptions.Compiled);

    private static readonly Regex AgeEn = new(@"(\d{1,2})\s*years?\s*old", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex UniversityCn = new(@"([\u4e00-\u9fa5A-Za-z]{2,24}大学)", RegexOptions.Compiled);

    private static readonly Regex MajorCn = new(@"([\u4e00-\u9fa5A-Za-z]{2,24}专业)", RegexOptions.Compiled);



    /// <summary>Normalize raw model output for user-facing text (chat, nags, reports).</summary>

    public static string NormalizeAssistantText(string? raw)

    {

        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;

        return PlainTextFormatter.Sanitize(StripInternalTags(raw)).Trim();

    }



    /// <summary>Extract provider reasoning blocks for optional UI display.</summary>

    public static string? ExtractReasoningText(string? raw)

    {

        if (string.IsNullOrWhiteSpace(raw)) return null;

        var parts = new List<string>();

        foreach (Match m in ReasoningBlock.Matches(raw))

        {

            var inner = ReasoningTag.Replace(m.Value, "").Trim();

            if (inner.Length > 0) parts.Add(inner);

        }

        return parts.Count == 0 ? null : string.Join("\n\n", parts);

    }



    /// <summary>Extract all atomic insight blocks before stripping from display text.</summary>
    public static IReadOnlyList<(string Category, string Text)> ExtractInsights(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Array.Empty<(string, string)>();
        var list = new List<(string, string)>();
        foreach (Match m in InsightBlock.Matches(raw))
        {
            var cat = m.Groups[1].Success && !string.IsNullOrWhiteSpace(m.Groups[1].Value)
                ? m.Groups[1].Value.Trim()
                : InsightCategories.Other;
            var inner = InsightTag.Replace(m.Value, "").Trim();
            if (!string.IsNullOrWhiteSpace(inner))
                list.Add((InsightCategories.Normalize(cat), inner));
        }
        return list;
    }

    /// <summary>Merge validated LLM tags with user-message heuristics (fills gaps when LLM tags are missing or bad).</summary>
    public static IReadOnlyList<(string Category, string Text)> CombineInsightsFromExchange(string? userMessage, string? assistantRaw)
    {
        var seen = new HashSet<(string Cat, string Text)>();
        var list = new List<(string, string)>();
        void TryAdd(string category, string text)
        {
            var validated = ValidateInsight(category, text);
            if (validated == null) return;
            var key = (validated.Value.Category, validated.Value.Text);
            if (!seen.Add(key)) return;
            list.Add(key);
        }
        foreach (var (cat, text) in ExtractInsights(assistantRaw))
            TryAdd(cat, text);
        foreach (var (cat, text) in InferInsightsFromUserMessage(userMessage))
            TryAdd(cat, text);
        return list;
    }

    /// <summary>Reject questions, compound blobs, and normalize school/major phrasing.</summary>
    public static (string Category, string Text)? ValidateInsight(string category, string text)
    {
        var cat = InsightCategories.Normalize(category);
        var s = text.Trim();
        if (s.Length < 2 || s.Length > 80) return null;
        if (IsQuestionLike(s)) return null;
        if (Regex.IsMatch(s, @"^(你|您|他|她|我吗|对吗)")) return null;
        if (Regex.IsMatch(s, @"到达.{0,4}法定|法定年龄|成年了吗|几岁|多大年纪|有没有满")) return null;

        // Normalize "我是(一个)厦门大学" → "厦门大学"
        var uniSelf = Regex.Match(s, @"^我是(?:一个)?([\u4e00-\u9fa5A-Za-z]{2,24}大学)$");
        if (uniSelf.Success) s = uniSelf.Groups[1].Value;

        // Normalize bare school without 大学 suffix when category is education
        if (cat == InsightCategories.Education && Regex.IsMatch(s, @"^[\u4e00-\u9fa5]{2,12}大学$"))
            s = s.Trim();

        // Reject malformed / compound blobs
        if (Regex.IsMatch(s, @"^岁")) return null;
        if (Regex.IsMatch(s, @"岁.{0,8}(男生|女生|专业|大学)")) return null;
        if (cat is InsightCategories.Demographic or InsightCategories.Education
            && Regex.IsMatch(s, @"(男生|女生).*(专业|大学)|(专业|大学).*(男生|女生)")) return null;
        if (cat == InsightCategories.Demographic && Regex.IsMatch(s, @"专业|大学")) return null;
        if (cat == InsightCategories.Education && Regex.IsMatch(s, @"^(男生|女生|\d{1,2}岁)")) return null;
        if (s.Contains('岁') && !Regex.IsMatch(s, @"^\d{1,2}\s*岁$") && !Regex.IsMatch(s, @"^\d{1,2}\s*years?\s*old$", RegexOptions.IgnoreCase))
            return null;

        if (cat == InsightCategories.Demographic && s.Length > 16) return null;
        if (cat == InsightCategories.Other && (IsQuestionLike(s) || PersonalFactSignal.IsMatch(s) == false)) return null;

        return (cat, s);
    }

    static bool IsQuestionLike(string text)
    {
        if (text.EndsWith('?') || text.EndsWith('？')) return true;
        if (Regex.IsMatch(text, @"[吗呢吧]$")) return true;
        if (Regex.IsMatch(text, @"^(是不是|有没有|能不能|是否|请问|多少|什么|哪)")) return true;
        return false;
    }

    /// <summary>Heuristic fallback: split user message into atomic durable facts.</summary>
    public static IReadOnlyList<(string Category, string Text)> InferInsightsFromUserMessage(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return Array.Empty<(string, string)>();
        var text = message.Trim();
        if (text.Length < 4 || !PersonalFactSignal.IsMatch(text)) return Array.Empty<(string, string)>();
        if (IsQuestionLike(text)) return Array.Empty<(string, string)>();

        var list = new List<(string, string)>();

        foreach (Match m in AgeCn.Matches(text))
            TryAddInsight(list, InsightCategories.Demographic, $"{m.Groups[1].Value}岁");
        foreach (Match m in AgeEn.Matches(text))
            TryAddInsight(list, InsightCategories.Demographic, $"{m.Groups[1].Value} years old");

        if (Regex.IsMatch(text, @"男生|男性|\bmale\b", RegexOptions.IgnoreCase))
            TryAddInsight(list, InsightCategories.Demographic, "男生");
        if (Regex.IsMatch(text, @"女生|女性|\bfemale\b", RegexOptions.IgnoreCase))
            TryAddInsight(list, InsightCategories.Demographic, "女生");

        foreach (Match m in UniversityCn.Matches(text))
            TryAddInsight(list, InsightCategories.Education, m.Groups[1].Value.Trim());
        foreach (Match m in MajorCn.Matches(text))
            TryAddInsight(list, InsightCategories.Education, m.Groups[1].Value.Trim());

        foreach (Match m in Regex.Matches(text, @"就读于\s*([\u4e00-\u9fa5A-Za-z]{2,30})"))
            TryAddInsight(list, InsightCategories.Education, m.Groups[1].Value.Trim());

        if (Regex.IsMatch(text, @"住在|位于|live in", RegexOptions.IgnoreCase))
        {
            var loc = Regex.Match(text, @"住在\s*([\u4e00-\u9fa5A-Za-z]{2,20})");
            if (loc.Success)
                TryAddInsight(list, InsightCategories.Location, loc.Groups[1].Value.Trim());
        }

        foreach (Match m in Regex.Matches(text, @"在([\u4e00-\u9fa5A-Za-z]{2,24})(公司|企业)"))
            TryAddInsight(list, InsightCategories.Job, $"在{m.Groups[1].Value}{m.Groups[2].Value}");

        if (Regex.IsMatch(text, @"习惯|每天|经常|routine|habit", RegexOptions.IgnoreCase) &&
            Regex.IsMatch(text, @"习惯|每天|经常", RegexOptions.IgnoreCase))
            TryAddInsight(list, InsightCategories.Habit, text);

        if (Regex.IsMatch(text, @"喜欢|爱好|兴趣|hobby|interest", RegexOptions.IgnoreCase))
        {
            var hobby = Regex.Match(text, @"(喜欢|爱好)([\u4e00-\u9fa5A-Za-z]{2,20})");
            if (hobby.Success)
                TryAddInsight(list, InsightCategories.Interest, hobby.Groups[2].Value.Trim());
        }

        return list;
    }



    static void TryAddInsight(List<(string Category, string Text)> list, string category, string text)
    {
        var summary = text.Trim();
        if (summary.Length == 0) return;
        var normalized = InsightCategories.Normalize(category);
        if (list.Any(i => i.Category == normalized && i.Text == summary))
            return;
        list.Add((normalized, summary));
    }



    /// <summary>Remove provider reasoning and activity memory tags from visible text.</summary>

    public static string StripInternalTags(string? text)

    {

        if (string.IsNullOrWhiteSpace(text)) return text ?? "";

        var s = StripReasoning(text);

        s = InsightBlock.Replace(s, "");

        s = InsightTag.Replace(s, "");

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

    public static PromptExecutionSettings CreateChatSettings(IConfiguration config, bool enableTools = false, bool autoInvokeTools = true)

    {

        if (LlmSettings.IsMiniMax(config))

        {

            var settings = new OpenAIPromptExecutionSettings

            {

                ExtensionData = new Dictionary<string, object> { ["reasoning_split"] = true }

            };

            if (enableTools)

                settings.FunctionChoiceBehavior = autoInvokeTools

                    ? FunctionChoiceBehavior.Auto()

                    : FunctionChoiceBehavior.Auto(autoInvoke: false);

            return settings;

        }



        var gemini = new GeminiPromptExecutionSettings();

        if (enableTools)

            gemini.FunctionChoiceBehavior = autoInvokeTools

                ? FunctionChoiceBehavior.Auto()

                : FunctionChoiceBehavior.Auto(autoInvoke: false);

        return gemini;

    }

#pragma warning restore SKEXP0070, SKEXP0010

}


