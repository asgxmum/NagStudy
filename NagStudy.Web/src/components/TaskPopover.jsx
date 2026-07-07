import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { TASK_COLORS, isPresetTaskColor } from "../utils/taskColor";
import { todayMytStr, yesterdayMytStr, taskDatePickerMinStr, classifyFromForm } from "../utils/taskMapper";

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
  const today = todayMytStr();
  const yday = yesterdayMytStr();
  if (!dateStr?.trim()) return { icon: "📦", label: "Backlog · no date", tone: "nodate" };
  if (c.isBacklog) return { icon: "📦", label: "Backlog · future", tone: "backlog" };
  if (dateStr < today) {
    const dayLabel = dateStr === yday ? "Yesterday" : dateStr;
    if (startMin !== "") return { icon: "🗓️", label: `${dayLabel} · Scheduled`, tone: "past" };
    return { icon: "📋", label: `${dayLabel} · planned`, tone: "past" };
  }
  if (startMin !== "") return { icon: "🗓️", label: "Today · Scheduled", tone: "gantt" };
  return { icon: "📋", label: "Today", tone: "today" };
}

// Time picker (MUI TimePicker, 24h). The form stores minutes-since-midnight
// (or "" = unset / Backlog); we bridge that to a dayjs time value here.
const muiTheme = createTheme({
  palette: { primary: { main: "#E8734A" } },
  shape: { borderRadius: 12 },
  typography: { fontFamily: "inherit", fontSize: 13.5 },
});

const minToDayjs = (min) =>
  min === "" || min == null ? null : dayjs().startOf("day").add(Number(min), "minute");
const dayjsToMin = (d) => (d && d.isValid() ? d.hour() * 60 + d.minute() : "");

function TimeField({ id, value, onChange, showNow = true }) {
  const setNow = () => {
    const n = dayjs();
    onChange(n.hour() * 60 + n.minute());
  };
  return (
    <div className="task-time12" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <TimePicker
        value={minToDayjs(value)}
        ampm={false}
        minutesStep={5}
        format="HH:mm"
        localeText={{ fieldHoursPlaceholder: () => "HH" }}
        onChange={(d) => onChange(dayjsToMin(d))}
        slotProps={{
          textField: { id, size: "small", sx: { width: 164 } },
          field: { clearable: true },
          // keep Cancel/OK for clarity; clicking outside also closes (accepts) it
          actionBar: { actions: ["cancel", "accept"] },
          // our task modal sits at z-index 9000; lift the picker popup above it
          // prefer opening downward; keep the clock compact so it fits below
          popper: {
            placement: "bottom-start",
            sx: {
              zIndex: 9500,
              "& .MuiMultiSectionDigitalClockSection-root": { maxHeight: 168 },
              // clock is narrower than the Cancel/OK bar → centre it (no lopsided left gap)
              "& .MuiPickersLayout-contentWrapper": { justifySelf: "center" },
            },
          },
          dialog: { sx: { zIndex: 9500 } },
        }}
      />
      {showNow && (
        <button type="button" className="time-now-btn" onClick={setNow} title="Set to current time">
          Now
        </button>
      )}
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
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card task-modal" lang="en">
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
                min={taskDatePickerMinStr()}
                value={form.dateStr}
                onChange={(e) => setField("dateStr", e.target.value)}
              />
              {dateError && <p className="task-field-error">{dateError}</p>}
              {!form.dateStr && !dateError && (
                <p className="sub" style={{ marginTop: 6 }}>📦 No date = saved for later (Backlog)</p>
              )}
              {form.dateStr && form.dateStr < today && !dateError && (
                <p className="sub" style={{ marginTop: 6 }}>📅 Past dates show in Yesterday&apos;s review (debug)</p>
              )}
            </div>
            <ThemeProvider theme={muiTheme}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <div className="task-time-row">
                  <div className="set-field">
                    <label htmlFor="task-start">Start</label>
                    <TimeField id="task-start" value={form.startMin} onChange={(v) => setField("startMin", v)} />
                  </div>
                  <div className="set-field">
                    <label htmlFor="task-end">End</label>
                    <TimeField id="task-end" value={form.endMin} onChange={(v) => setField("endMin", v)} showNow={false} />
                  </div>
                </div>
              </LocalizationProvider>
            </ThemeProvider>
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
