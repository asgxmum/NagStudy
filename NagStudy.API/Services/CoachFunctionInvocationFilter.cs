using Microsoft.SemanticKernel;

namespace NagStudy.API.Services;

/// <summary>Logs coach plugin invocations so results can be cached in session context.</summary>
public sealed class CoachFunctionInvocationFilter : IFunctionInvocationFilter
{
    public async Task OnFunctionInvocationAsync(
        FunctionInvocationContext context,
        Func<FunctionInvocationContext, Task> next)
    {
        await next(context);

        var recorder = CoachToolScope.Active;
        if (recorder == null) return;

        var toolName = $"{context.Function.PluginName}-{context.Function.Name}";
        var args = context.Arguments == null
            ? null
            : string.Join(", ", context.Arguments.Select(kv => $"{kv.Key}={kv.Value}"));
        var result = context.Result?.ToString() ?? "";
        recorder.Record(toolName, args, result);
    }
}
