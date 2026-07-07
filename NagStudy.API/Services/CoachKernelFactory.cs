using Microsoft.SemanticKernel;
using NagStudy.API.Plugins;

namespace NagStudy.API.Services;

public class CoachKernelFactory
{
    private readonly IConfiguration _config;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly CoachFunctionInvocationFilter _invocationFilter;

    public CoachKernelFactory(
        IConfiguration config,
        IServiceScopeFactory scopeFactory,
        CoachFunctionInvocationFilter invocationFilter)
    {
        _config = config;
        _scopeFactory = scopeFactory;
        _invocationFilter = invocationFilter;
    }

    public string ProviderName => LlmSettings.GetProvider(_config);
    public bool UseMiniMax => LlmSettings.IsMiniMax(_config);
    public string ProviderDisplayName => LlmSettings.ProviderDisplayName(_config);

    public PromptExecutionSettings CreateChatSettings(bool enableTools = false) =>
        LlmCompat.CreateChatSettings(_config, enableTools);

    /// <summary>Triggers / manual snapshot (get_study_summary only).</summary>
    public Kernel CreateKernel(int userId)
    {
        var kernel = BuildChatKernel();
        kernel.Plugins.AddFromObject(new StudySnapshotPlugin(_scopeFactory, userId), "Study");
        return kernel;
    }

    /// <summary>Coach agent chat with analytics + RAG tools.</summary>
    public Kernel CreateAgentKernel(int userId)
    {
        var kernel = BuildChatKernel();
        kernel.Plugins.AddFromObject(new StudyContextPlugin(_scopeFactory, userId), "Study");
        kernel.Plugins.AddFromObject(new StudyAnalyticsPlugin(_scopeFactory, userId), "Analytics");
        return kernel;
    }

    Kernel BuildChatKernel()
    {
        var builder = Kernel.CreateBuilder();
        builder.Services.AddSingleton<IFunctionInvocationFilter>(_invocationFilter);
        if (UseMiniMax)
            AddMiniMaxChat(builder);
        else
            AddGeminiChat(builder);
        return builder.Build();
    }

    void AddGeminiChat(IKernelBuilder builder)
    {
        var apiKey = _config["Gemini:ApiKey"]
            ?? throw new InvalidOperationException(
                "Gemini API key missing. Set: dotnet user-secrets set \"Gemini:ApiKey\" \"your-key\"");

        var model = _config["Gemini:ChatModel"] ?? "gemini-2.5-flash";

#pragma warning disable SKEXP0070
        builder.AddGoogleAIGeminiChatCompletion(model, apiKey);
#pragma warning restore SKEXP0070
    }

    void AddMiniMaxChat(IKernelBuilder builder)
    {
        var apiKey = _config["MiniMax:ApiKey"]
            ?? throw new InvalidOperationException(
                "MiniMax API key missing. Set: dotnet user-secrets set \"MiniMax:ApiKey\" \"sk-cp-...\"");

        var model = _config["MiniMax:ChatModel"] ?? "MiniMax-M3";
        var baseUrl = LlmSettings.GetMiniMaxBaseUrl(_config);

#pragma warning disable SKEXP0010
        builder.AddOpenAIChatCompletion(
            modelId: model,
            endpoint: new Uri(baseUrl.TrimEnd('/') + "/"),
            apiKey: apiKey);
#pragma warning restore SKEXP0010
    }
}
