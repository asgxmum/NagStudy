import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { TASK_COLORS, isPresetTaskColor } from "../utils/taskColor";
import { todayMytStr, classifyFromForm } from "../utils/taskMapper";

const emptyForm = () => ({
  title: "",
  description: "",
  dateStr: "",
  startMin: "",
  endMin: "",
  imp: false,
  remindBeforeStart: false,
  color: TASK_COLORS[0],
});

function placementMeta(dateStr, startMin) {
  const c = classifyFromForm({ dateStr, startMin });
  if (!dateStr?.trim()) return { icon: "📦", label: "Backlog · no date", tone: "nodate" };
  if (c.isBacklog) return { icon: "📦", label: "Backlog · future", tone: "backlog" };
  if (startMin !== "") return { icon: "🗓️", label: "Today · Scheduled", tone: "gantt" };
  return { icon: "📋", label: "Today", tone: "today" };
}

// 12-hour time picker (1–12 : minute : AM/PM). Stores minutes-since-midnight,
// so the backend/Gantt are unaffected. Replaces the native <input type="time">,
// whose 12h/24h display Chrome controls by browser locale (ignores `lang`).
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i);      // 0..59

function minToParts(min) {
  if (min === "" || min == null) return { h: "", m: "", ap: "AM" };
  const h24 = Math.floor(min / 60);
  return { h: String(h24 % 12 || 12), m: String(min % 60), ap: h24 < 12 ? "AM" : "PM" };
}
function partsToMin(h, m, ap) {
  if (h === "") return "";
  const h12 = Number(h);
  const h24 = ap === "AM" ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);
  return h24 * 60 + (m === "" ? 0 : Number(m)); // minute defaults to :00 once hour is set
}

function Time12({ id, value, onChange }) {
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [ap, setAp] = useState("AM");

  useEffect(() => {
    const p = minToParts(value);
    setH(p.h); setM(p.m); setAp(p.ap);
  }, [value]);

  const emit = (nh, nm, nap) => onChange(partsToMin(nh, nm, nap));
  const two = (n) => String(n).padStart(2, "0");
  const sel = { border: "none", background: "transparent", outline: "none", font: "inherit", color: "inherit", cursor: "pointer", padding: "2px 0" };

  return (
    <div className="set-input task-time12" style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "6px 10px" }}>
      <select id={id} style={sel} value={h}
        onChange={(e) => { setH(e.target.value); emit(e.target.value, m, ap); }}>
        <option value="">--</option>
        {HOURS_12.map((x) => <option key={x} value={x}>{two(x)}</option>)}
      </select>
      <span style={{ opacity: 0.5 }}>:</span>
      <select style={sel} value={m} aria-label="Minute"
        onChange={(e) => { setM(e.target.value); emit(h, e.target.value, ap); }}>
        <option value="">--</option>
        {MINUTES.map((x) => <option key={x} value={x}>{two(x)}</option>)}
      </select>
      <select style={{ ...sel, marginLeft: 6 }} value={ap} aria-label="AM/PM"
        onChange={(e) => { setAp(e.target.value); emit(h, m, e.target.value); }}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function TaskPopover({ task, onSave, onDelete, onClose }) {
  const isNew = !task?.id;
  const [form, setForm] = useState(emptyForm);
  const [dateError, setDateError] = useState("");
  const today = todayMytStr();

  useEffect(() => {
    if (!task) {
      setForm(emptyForm());
      setDateError("");
      return;
    }
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      dateStr: task.dateStr ?? "",
      startMin: task.startMin ?? "",
      endMin: task.endMin ?? "",
      imp: task.imp ?? false,
      remindBeforeStart: task.remindBeforeStart ?? false,
      color: task.color ?? TASK_COLORS[0],
    });
    setDateError("");
  }, [task]);

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === "dateStr") setDateError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    const dateStr = form.dateStr.trim();
    if (dateStr && dateStr < today) {
      setDateError("Date cannot be before today.");
      return;
    }

    const classified = classifyFromForm({ dateStr, startMin: form.startMin });
    onSave({
      ...task,
      title,
      description: form.description.trim(),
      dateStr: classified.dateStr,
      isBacklog: classified.isBacklog,
      startMin: form.startMin === "" ? null : Number(form.startMin),
      endMin: form.endMin === "" ? null : Number(form.endMin),
      imp: form.imp,
      remindBeforeStart: form.remindBeforeStart,
      color: form.color,
      status: task?.status ?? "inbox",
      when: classified.isBacklog ? "later" : "now",
    });
  }

  const place = placementMeta(form.dateStr, form.startMin);
  const customColor = !isPresetTaskColor(form.color);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card task-modal" lang="en" onClick={(e) => e.stopPropagation()}>
        <header className="task-modal-head">
          <div>
            <h3>{isNew ? "Add task" : "Edit task"}</h3>
            <span className={`task-place-pill tone-${place.tone}`}>
              {place.icon} {place.label}
            </span>
          </div>
          <button type="button" className="task-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <form className="task-modal-form" onSubmit={handleSubmit}>
          <section className="task-modal-section">
            <div className="set-field task-field-title">
              <label htmlFor="task-title">Title</label>
              <input
                id="task-title"
                className="set-input"
                value={form.title}
                maxLength={200}
                required
                autoFocus
                placeholder="What needs doing?"
                onChange={(e) => setField("title", e.target.value)}
              />
            </div>
            <div className="set-field">
              <label htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                className="set-input task-textarea"
                rows={2}
                maxLength={2000}
                placeholder="Optional notes…"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>
          </section>

          <section className="task-modal-section task-modal-schedule">
            <div className="task-section-label">Schedule</div>
            <div className="set-field">
              <label htmlFor="task-date">Date</label>
              <input
                id="task-date"
                type="date"
                lang="en-GB"
                className="set-input task-date-input"
                min={today}
                value={form.dateStr}
                onChange={(e) => setField("dateStr", e.target.value)}
              />
              {dateError && <p className="task-field-error">{dateError}</p>}
              {!form.dateStr && !dateError && (
                <p className="sub" style={{ marginTop: 6 }}>📦 No date = saved for later (Backlog)</p>
              )}
            </div>
            <div className="task-time-row">
              <div className="set-field">
                <label htmlFor="task-start">Start</label>
                <Time12 id="task-start" value={form.startMin} onChange={(v) => setField("startMin", v)} />
              </div>
              <div className="set-field">
                <label htmlFor="task-end">End</label>
                <Time12 id="task-end" value={form.endMin} onChange={(v) => setField("endMin", v)} />
              </div>
            </div>
          </section>

          <section className="task-modal-section task-modal-options">
            <div className="task-toggle-row">
              <button
                type="button"
                className={`task-toggle${form.imp ? " on" : ""}`}
                onClick={() => setField("imp", !form.imp)}
              >
                ⭐ Important
              </button>
              <button
                type="button"
                className={`task-toggle${form.remindBeforeStart ? " on" : ""}`}
                onClick={() => setField("remindBeforeStart", !form.remindBeforeStart)}
              >
                🔔 Remind me
              </button>
            </div>
            <div className="task-color-row">
              <span className="task-color-label">Colour</span>
              <div className="task-color-swatches">
                {TASK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`task-swatch${form.color?.toLowerCase() === c.toLowerCase() ? " on" : ""}`}
                    style={{ background: c }}
                    title={c}
                    aria-label={`Colour ${c}`}
                    onClick={() => setField("color", c)}
                  />
                ))}
                <label
                  className={`task-swatch task-swatch-custom${customColor ? " on" : ""}`}
                  title="Custom colour"
                  style={customColor ? { background: form.color } : undefined}
                >
                  {!customColor && <span className="task-swatch-custom-icon" aria-hidden>🎨</span>}
                  <input
                    type="color"
                    value={form.color?.startsWith("#") ? form.color : TASK_COLORS[0]}
                    aria-label="Pick custom colour"
                    onChange={(e) => setField("color", e.target.value)}
                  />
                </label>
              </div>
            </div>
          </section>

          <footer className="task-modal-foot">
            {!isNew ? (
              <button type="button" className="btn btn-ghost btn-sm task-btn-delete" onClick={() => onDelete?.(task.id)}>
                Delete
              </button>
            ) : <span />}
            <div className="task-modal-foot-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Save task</button>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
