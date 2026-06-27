using System.Net.Http.Json;
using System.Text.Json;

namespace NagStudy.API.Services;

public class GeminiEmbeddingService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;

    public GeminiEmbeddingService(IConfiguration config, IHttpClientFactory httpFactory)
    {
        _config = config;
        _httpFactory = httpFactory;
    }

    public async Task<float[]?> EmbedAsync(string text, CancellationToken ct = default)
    {
        var apiKey = _config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(text)) return null;

        var model = _config["Gemini:EmbeddingModel"] ?? "text-embedding-004";
        var client = _httpFactory.CreateClient();
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={apiKey}";

        var body = new
        {
            model = $"models/{model}",
            content = new { parts = new[] { new { text = text.Length > 8000 ? text[..8000] : text } } }
        };

        try
        {
            var res = await client.PostAsJsonAsync(url, body, ct);
            if (!res.IsSuccessStatusCode) return null;

            var json = await res.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
            var values = json.GetProperty("embedding").GetProperty("values");
            var arr = new float[values.GetArrayLength()];
            for (int i = 0; i < arr.Length; i++)
                arr[i] = values[i].GetSingle();
            return arr;
        }
        catch
        {
            return null;
        }
    }
}
