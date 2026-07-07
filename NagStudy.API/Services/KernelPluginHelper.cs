using Microsoft.SemanticKernel;

namespace NagStudy.API.Services;

internal static class KernelPluginHelper
{
    public static async Task<string> InvokeAsync(Kernel kernel, string plugin, string function, KernelArguments? args = null)
    {
        var fn = kernel.Plugins.GetFunction(plugin, function);
        var result = await kernel.InvokeAsync(fn, args ?? new KernelArguments());
        return result.ToString();
    }
}
