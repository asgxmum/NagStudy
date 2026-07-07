using System.ComponentModel;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using NagStudy.API.Data;

namespace NagStudy.API.Plugins;

/// <summary>Lightweight study context for the coach agent.</summary>
public class StudyContextPlugin
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly int _userId;

    public StudyContextPlugin(IServiceScopeFactory scopeFactory, int userId)
    {
        _scopeFactory = scopeFactory;
        _userId = userId;
    }

    [KernelFunction("get_pending_tasks")]
    [Description("List inbox and upcoming scheduled tasks for the user.")]
    public async Task<string> GetPendingTasksAsync()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NagStudyContext>();

        var tasks = await db.Tasks
            .Where(t => t.UserId == _userId && t.Status != "Done")
            .OrderBy(t => t.IsImportant ? 0 : 1)
            .ThenBy(t => t.CreatedAt)
            .Take(20)
            .ToListAsync();

        if (tasks.Count == 0) return "No pending tasks.";

        return string.Join("\n", tasks.Select(t =>
        {
            var time = t.StartTime.HasValue
                ? $" scheduled {t.StartTime.Value.AddHours(8):HH:mm}-{t.EndTime?.AddHours(8):HH:mm}"
                : "";
            return $"- [{t.Status}] {t.Title}{(t.IsImportant ? " (important)" : "")}{time}";
        }));
    }
}
