import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createInsight, deleteInsight, listInsights } from "../api/coach";

const CATEGORIES = [
  { id: "demographic", label: "Demographic", icon: "👤" },
  { id: "education", label: "Education", icon: "🎓" },
  { id: "job", label: "Career", icon: "💼" },
  { id: "location", label: "Location", icon: "📍" },
  { id: "habit", label: "Habit", icon: "🔄" },
  { id: "interest", label: "Interest", icon: "🎯" },
  { id: "preference", label: "Preference", icon: "⭐" },
  { id: "other", label: "Other", icon: "💡" },
];

function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function InsightsModal({ open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("habit");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listInsights();
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("Couldn't load insights.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function handleAdd(e) {
    e.preventDefault();
    const text = summary.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      const res = await createInsight({ category, summary: text });
      setItems((prev) => [res.data, ...prev]);
      setSummary("");
    } catch (err) {
      setError(err.response?.data?.message ?? "Couldn't save insight.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteInsight(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("Couldn't delete insight.");
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card insights-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="insights-title">
        <div className="insights-modal-head">
          <h3 id="insights-title">💡 Saved Insights</h3>
          <p className="sub">Atomic facts your coach remembers — age, school, habits, interests. Each row is one fact for better search.</p>
          <button type="button" className="btn btn-ghost btn-sm insights-close" onClick={onClose}>✕</button>
        </div>

        <form className="insights-add-form" onSubmit={handleAdd}>
          <select className="set-input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
          <input
            className="set-input"
            placeholder="e.g. I study best before 9am"
            value={summary}
            maxLength={300}
            onChange={(e) => setSummary(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !summary.trim()}>
            {saving ? "Saving…" : "Add"}
          </button>
        </form>

        {error && <p className="coach-gemini-error" style={{ margin: "0 0 12px" }}>{error}</p>}

        <div className="insights-list">
          {loading && <p className="sub">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="sub insights-empty">No insights yet. Add one above, or let the coach learn from chat.</p>
          )}
          {items.map((item) => {
            const meta = categoryMeta(item.category);
            return (
              <div className="insight-row" key={item.id}>
                <div className="insight-row-main">
                  <span className="insight-cat" title={meta.label}>{meta.icon} {meta.label}</span>
                  <p className="insight-text">{item.summary}</p>
                  <span className="insight-meta">
                    {formatDate(item.recordedAt)}
                    {item.sourceMessageId ? " · from chat" : " · added by you"}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm insight-del" onClick={() => handleDelete(item.id)} title="Delete">
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
