namespace NagStudy.API.Services;

/// <summary>Reads LLM provider settings (Gemini vs MiniMax OpenAI-compatible).</summary>
public static class LlmSettings
{
    public const string ProviderGemini = "Gemini";
    public const string ProviderMiniMax = "MiniMax";

    public static string GetProvider(IConfiguration config) =>
        config["Llm:Provider"]?.Trim() ?? ProviderGemini;

    public static bool IsMiniMax(IConfiguration config) =>
        GetProvider(config).Equals(ProviderMiniMax, StringComparison.OrdinalIgnoreCase);

    public static string ProviderDisplayName(IConfiguration config) =>
        IsMiniMax(config) ? "MiniMax" : "Gemini";

    /// <summary>
    /// MiniMax Token Plan keys (sk-cp-) are region-locked:
    /// China subscriptions → api.minimaxi.com, Global → api.minimax.io.
    /// </summary>
    public static string GetMiniMaxBaseUrl(IConfiguration config)
    {
        var explicitUrl = config["MiniMax:BaseUrl"]?.Trim();
        if (!string.IsNullOrWhiteSpace(explicitUrl))
            return explicitUrl.TrimEnd('/');

        var region = config["MiniMax:Region"]?.Trim() ?? "Global";
        return region.Equals("China", StringComparison.OrdinalIgnoreCase)
            ? "https://api.minimaxi.com/v1"
            : "https://api.minimax.io/v1";
    }
}
