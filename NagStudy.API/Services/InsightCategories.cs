namespace NagStudy.API.Services;

/// <summary>Canonical Insight categories for soft RAG memory (one atomic fact per row).</summary>
public static class InsightCategories
{
    public const string Demographic = "demographic";
    public const string Education = "education";
    public const string Job = "job";
    public const string Location = "location";
    public const string Habit = "habit";
    public const string Interest = "interest";
    public const string Preference = "preference";
    public const string Other = "other";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        Demographic, Education, Job, Location, Habit, Interest, Preference, Other
    };

    public static string Normalize(string? category)
    {
        var c = (category ?? Other).Trim().ToLowerInvariant();
        return c switch
        {
            Demographic or "profile" or "identity" or "age" or "gender" => Demographic,
            Education or "study" or "studies" or "school" or "university" or "major" => Education,
            Job or "career" or "work" or "employment" => Job,
            Location or "place" or "city" => Location,
            Habit or "routine" => Habit,
            Interest or "hobby" => Interest,
            Preference or "prefer" => Preference,
            _ => All.Contains(c) ? c : Other
        };
    }
}
