using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using NagStudy.API.Data;
using NagStudy.API.Infrastructure;
using NagStudy.API.Models.Domain;
using NagStudy.API.Models.DTO;

namespace NagStudy.API.Services;

/// <summary>Shared report body generation for UI and agent tool get_summary_report.</summary>
public class CoachReportGenerator
{
    private readonly NagStudyContext _db;
    private readonly CoachKernelFactory _kernelFactory;

    public CoachReportGenerator(NagStudyContext db, CoachKernelFactory kernelFactory)
    {
        _db = db;
        _kernelFactory = kernelFactory;
    }

    public async Task<string> GenerateAsync(int userId, string period, string language, string systemPrompt)
    {
        var (start, end) = ResolvePeriod(period, null, null);
        var startStr = start.AddHours(8).ToString("yyyy-MM-dd");
        var endStr = end.AddHours(8).ToString("yyyy-MM-dd");

        var snapshotKernel = _kernelFactory.CreateKernel(userId);
        var studyData = await KernelPluginHelper.InvokeAsync(snapshotKernel, "Study", "get_study_summary");

        var agentKernel = _kernelFactory.CreateAgentKernel(userId);
        var periodSummary = await KernelPluginHelper.InvokeAsync(agentKernel, "Analytics", "get_summary_information",
            new KernelArguments { ["startDate"] = startStr, ["endDate"] = endStr });
        var taskHistory = await KernelPluginHelper.InvokeAsync(agentKernel, "Analytics", "get_tasks",
            new KernelArguments { ["startDate"] = startStr, ["endDate"] = endStr });

        var prompt = $"""
            Generate a detailed study performance report in {language}.
            Period: {startStr} to {endStr} (MYT)

            {PlainTextFormatter.OutputRules}

            Required sections (each as ── Section ── then • bullets):
            ── Focus overview ──
            ── Task completion ──
            ── Patterns ──
            ── AI observations ──
            ── Next-week suggestions ──

            Use ONLY real data below. Do not invent numbers.

            === Today/week snapshot ===
            {studyData}

            === Period summary ===
            {periodSummary}

            === Tasks in period ===
            {taskHistory}
            """;

        return await InvokeLlmAsync(snapshotKernel, systemPrompt, prompt);
    }

    public static (DateTime start, DateTime end) ResolvePeriod(string period, DateTime? from, DateTime? to)
    {
        var nowMyt = DateTime.UtcNow.AddHours(8).Date;
        return period switch
        {
            "7days" => (nowMyt.AddDays(-7).AddHours(-8), DateTime.UtcNow),
            "30days" => (nowMyt.AddDays(-30).AddHours(-8), DateTime.UtcNow),
            "custom" when from.HasValue && to.HasValue => (from.Value, to.Value),
            _ => (GetWeekStartUtc(), DateTime.UtcNow)
        };
    }

    static DateTime GetWeekStartUtc()
    {
        var nowMyt = DateTime.UtcNow.AddHours(8);
        int daysSinceMonday = ((int)nowMyt.DayOfWeek + 6) % 7;
        return nowMyt.Date.AddDays(-daysSinceMonday).AddHours(-8);
    }

    async Task<string> InvokeLlmAsync(Kernel kernel, string systemPrompt, string userPrompt)
    {
        var chat = kernel.GetRequiredService<Microsoft.SemanticKernel.ChatCompletion.IChatCompletionService>();
        var history = new Microsoft.SemanticKernel.ChatCompletion.ChatHistory(systemPrompt);
        history.AddUserMessage(userPrompt);
        var settings = _kernelFactory.CreateChatSettings();
        var result = await chat.GetChatMessageContentAsync(history, settings, kernel);
        var text = LlmCompat.NormalizeAssistantText(result.Content);
        return text.Length > 0 ? text : "I'm having trouble generating the report. Please try again.";
    }
}
