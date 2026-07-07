using NagStudy.API.Models.Domain;

namespace NagStudy.API.Services;

internal static class CoachQueryHelper
{
    static readonly string[] TaskKeywords =
    [
        "任务", "耗时", "时长", "最长", "最短", "完成", "做了什", "学了什",
        "刚才", "最近", "上周", "这周", "今天做", "task", "duration", "completed"
    ];

    public static bool NeedsTaskData(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        return TaskKeywords.Any(k => message.Contains(k, StringComparison.OrdinalIgnoreCase));
    }

    public static bool HasCachedTaskHistory(IEnumerable<ChatMessage> history) =>
        history.Any(m => m.Role == "Tool" &&
            m.Content.Contains("search_task_history", StringComparison.OrdinalIgnoreCase));
}
