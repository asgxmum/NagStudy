using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NagStudy.API.Data;
using NagStudy.API.Infrastructure;
using NagStudy.API.Models.Domain;

namespace NagStudy.API.Services;

public class RagService
{
    public const string InsightSourceType = "Insight";

    private readonly NagStudyContext _db;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly GeminiEmbeddingService _embedding;
    private readonly ILogger<RagService> _logger;

    public RagService(
        NagStudyContext db,
        IServiceScopeFactory scopeFactory,
        GeminiEmbeddingService embedding,
        ILogger<RagService> logger)
    {
        _db = db;
        _scopeFactory = scopeFactory;
        _embedding = embedding;
        _logger = logger;
    }

    public void IndexInsightFireAndForget(int userId, int insightId, string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return;
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var rag = scope.ServiceProvider.GetRequiredService<RagService>();
                await rag.UpsertDocumentAsync(userId, InsightSourceType, insightId, content);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "RAG insight index failed for {Id}", insightId); }
        });
    }

    public void DeleteInsightFireAndForget(int userId, int insightId)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var rag = scope.ServiceProvider.GetRequiredService<RagService>();
                await rag.DeleteDocumentAsync(userId, InsightSourceType, insightId);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "RAG insight delete failed for {Id}", insightId); }
        });
    }

    public async Task UpsertDocumentAsync(int userId, string sourceType, int sourceId, string content)
    {
        var embedding = await _embedding.EmbedAsync(content);
        var existing = await _db.RagDocuments
            .FirstOrDefaultAsync(r => r.UserId == userId && r.SourceType == sourceType && r.SourceId == sourceId);

        if (existing == null)
        {
            _db.RagDocuments.Add(new RagDocument
            {
                UserId = userId,
                SourceType = sourceType,
                SourceId = sourceId,
                Content = content,
                EmbeddingJson = embedding != null ? JsonSerializer.Serialize(embedding) : null,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.Content = content;
            existing.EmbeddingJson = embedding != null ? JsonSerializer.Serialize(embedding) : existing.EmbeddingJson;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync();
    }

    public async Task DeleteDocumentAsync(int userId, string sourceType, int sourceId)
    {
        var existing = await _db.RagDocuments
            .FirstOrDefaultAsync(r => r.UserId == userId && r.SourceType == sourceType && r.SourceId == sourceId);
        if (existing == null) return;
        _db.RagDocuments.Remove(existing);
        await _db.SaveChangesAsync();
    }

    public async Task<string> SearchInsightsAsync(int userId, string query, int topK = 5)
    {
        var queryVec = await _embedding.EmbedAsync(query);
        if (queryVec == null) return "";

        var docs = await _db.RagDocuments
            .Where(r => r.UserId == userId && r.SourceType == InsightSourceType && r.EmbeddingJson != null)
            .ToListAsync();

        var scored = docs
            .Select(d =>
            {
                var vec = JsonSerializer.Deserialize<float[]>(d.EmbeddingJson!)!;
                return (d.Content, Score: CosineSimilarity(queryVec, vec));
            })
            .OrderByDescending(x => x.Score)
            .Take(topK)
            .Where(x => x.Score > 0.3)
            .Select(x => x.Content)
            .ToList();

        return scored.Count == 0 ? "" : string.Join("\n---\n", scored);
    }

    private static float CosineSimilarity(float[] a, float[] b)
    {
        if (a.Length != b.Length) return 0;
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        if (na == 0 || nb == 0) return 0;
        return (float)(dot / (Math.Sqrt(na) * Math.Sqrt(nb)));
    }

    public static string FormatInsight(UserInsight i) => TaskRagFormatter.FormatInsight(i);
}
