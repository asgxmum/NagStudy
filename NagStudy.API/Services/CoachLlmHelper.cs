using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace NagStudy.API.Services;

internal static class CoachLlmHelper
{
    public static async Task<string?> TryCompleteAsync(
        Kernel kernel,
        CoachKernelFactory kernelFactory,
        string systemPrompt,
        string userPrompt,
        ILogger logger,
        string label,
        string providerName = "LLM")
    {
        try
        {
            var chat = kernel.GetRequiredService<IChatCompletionService>();
            var history = new ChatHistory(systemPrompt);
            history.AddUserMessage(userPrompt);
            var settings = kernelFactory.CreateChatSettings();
            var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
            var text = LlmCompat.NormalizeAssistantText(result.Content);
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "{Provider} call failed for {Label}", providerName, label);
            return null;
        }
    }
}
