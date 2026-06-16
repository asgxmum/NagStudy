import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import { TASK_COLORS, taskColor } from "../utils/taskColor";

// Tasks · Gantt — original prototype layout, wired to /api/tasks.
// Tasks have no category, so colour the Gantt blocks from an on-brand palette keyed by task id
// (shared with Pomodoro via utils/taskColor) — stable per task, varied across tasks.
// Current local time as minutes-of-day (0..1439). Read live via the `nowMin` state below so the
// Gantt "now" line and missed flags track the real clock instead of freezing at page-load time.
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const fmtTime = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const isMissed = (t, now) => t.status === "scheduled" && t.endMin !== null && t.endMin < now;

// ── backend(DateTime / "Now"/"Inbox") ↔ frontend(minutes / "now"/"inbox") ──
// The API serialises DateTimes without a trailing 'Z', so treat them as UTC (append Z) before
// reading LOCAL hours. Without this, a saved Gantt time is misread on reload and blocks jump by
// the timezone offset when you leave the page and come back. (Mirrors Pomodoro's asLocal.)
const minOfDay = (iso) => {
  if (!iso) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return d.getHours() * 60 + d.getMinutes();
};
const isoForToday = (m) => { const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.toISOString(); };
const fromApi = (t) => ({
  id: t.id, title: t.title, imp: t.isImportant,
  when: (t.when || "Now").toLowerCase(),
  status: (t.status || "Inbox").toLowerCase(),
  startMin: minOfDay(t.startTime), endMin: minOfDay(t.endTime),
  // Use the colour the user picked; fall back to a stable per-id palette colour for older tasks.
  completedAt: t.completedAt, color: t.color || taskColor(t.id),
});
const toApi = (t) => ({
  title: t.title,
  isImportant: t.imp,
  when: t.when === "later" ? "Later" : "Now",
  status: t.status === "done" ? "Done" : t.status === "scheduled" ? "Scheduled" : "Inbox",
  color: t.color,
  startTime: t.startMin != null ? isoForToday(t.startMin) : null,
  endTime: t.endMin != null ? isoForToday(t.endMin) : null,
  completedAt: t.status === "done" ? (t.completedAt || new Date().toISOString()) : null,
});

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [yesterday, setYesterday] = useState([]); // loaded from GET /tasks?date=yesterday (see useEffect)
  const [draft, setDraft] = useState("");
  const [nowMin, setNowMin] = useState(nowMinutes); // live clock — drives the "now" line + missed flags
  const [toast, setToast] = useState(null); // { id, face, color, title, text, out } — "added to Gantt" + error notices
  const gdropRef = useRef(null);

  useEffect(() => {
    // Today's board (scheduled-for-today or brain-dumped today) and yesterday's review
    // are fetched separately so each day stays on its own screen.
    api.get("/tasks?date=today").then((res) => setTasks(res.data.map(fromApi)))
      .catch(() => notifyError("Couldn't load today's tasks — check your connection and refresh."));
    api.get("/tasks?date=yesterday").then((res) => setYesterday(res.data.map(fromApi))).catch(() => { });
  }, []);

  // Tick the "now" line forward every 30s so it follows the real time while the page is open.
  useEffect(() => {
    const id = setInterval(() => setNowMin(nowMinutes()), 30000);
    return () => clearInterval(id);
  }, []);

  // Scroll the 24h timeline so the current time sits in the middle of the viewport.
  // Used on first load (instant) and by the "now" button (smooth).
  function centerOnNow(smooth = false) {
    const el = gdropRef.current;
    if (!el) return;
    const target = (nowMinutes() / 1440) * el.scrollWidth - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }

  // On first load, center on the current time (otherwise it opens at 00:00 and "now" can sit off-screen).
  useEffect(() => { centerOnNow(false); }, []);

  // Native <details> dropdowns don't close each other or on outside-click. Close any open one
  // when a click lands outside it — so only one task dropdown is open at a time.
  useEffect(() => {
    function onDocClick(e) {
      document.querySelectorAll("details.wsel[open]").forEach((d) => {
        if (!d.contains(e.target)) d.open = false;
      });
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Auto-dismiss the "added to Gantt" toast: hold ~2.4s, slide out, then unmount.
  useEffect(() => {
    if (!toast) return;
    const hold = setTimeout(() => setToast((t) => (t ? { ...t, out: true } : t)), 2400);
    const drop = setTimeout(() => setToast(null), 2720);
    return () => { clearTimeout(hold); clearTimeout(drop); };
  }, [toast?.id]);

  // Red error toast — reuses the same toast UI/auto-dismiss as the "added to Gantt" notice.
  function notifyError(text) {
    setToast({ id: Date.now(), face: "⚠️", color: "#D9534F", title: "Something went wrong", text, out: false });
  }

  async function patch(id, changes) {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const updated = { ...current, ...changes };
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    try {
      await api.put(`/tasks/${id}`, toApi(updated));
    } catch {
      // Roll the optimistic change back so the UI doesn't lie about what was saved.
      setTasks((prev) => prev.map((t) => (t.id === id ? current : t)));
      notifyError("Couldn't save that change — reverted.");
    }
  }

  function toggleImp(id) { patch(id, { imp: !tasks.find((t) => t.id === id)?.imp }); }
  function setWhen(id, when) { patch(id, { when }); }
  function setColor(id, color) { patch(id, { color }); } // colours the task everywhere it shows (brain dump + Gantt)
  function setTitle(id, title) { patch(id, { title }); } // inline rename from the brain dump
  function setDone(id, done) {
    const t = tasks.find((x) => x.id === id);
    patch(id, { status: done ? "done" : (t?.startMin != null ? "scheduled" : "inbox") });
  }
  function scheduleTask(id) {
    const start = Math.min((Math.floor(nowMin / 60) + 1) * 60, 1380);
    patch(id, { status: "scheduled", startMin: start, endMin: start + 60 });
    const t = tasks.find((x) => x.id === id);
    setToast({
      id: Date.now(),
      face: "🗓️",
      color: t?.color || taskColor(id),
      title: "Added to the Gantt",
      text: `“${t?.title ?? "Task"}” scheduled for ${fmtTime(start)}–${fmtTime(start + 60)}.`,
      out: false,
    });
  }
  async function delTask(id) {
    const prevTasks = tasks; // snapshot so we can restore on failure
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.delete(`/tasks/${id}`);
    } catch {
      setTasks(prevTasks);
      notifyError("Couldn't delete that task — restored.");
    }
  }
  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    try {
      const res = await api.post("/tasks", { title, isImportant: false, when: "Now", status: "Inbox", startTime: null, endTime: null });
      setTasks((prev) => [fromApi(res.data), ...prev]);
    } catch {
      setDraft(title); // put the typed text back so it isn't silently lost
      notifyError("Couldn't add that task — your text is back, try again.");
    }
  }
  async function carryToday(id) {
    const item = yesterday.find((t) => t.id === id);
    if (!item) return;
    const prevYesterday = yesterday; // snapshot so we can restore on failure
    setYesterday((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await api.post("/tasks", { title: item.title, isImportant: false, when: "Now", status: "Inbox", startTime: null, endTime: null });
      setTasks((prev) => [fromApi(res.data), ...prev]);
    } catch {
      setYesterday(prevYesterday);
      notifyError("Couldn't carry that over — restored.");
    }
  }

  // Scroll the 24h (1440px) timeline left/right with the ‹ › buttons.
  function scrollGantt(dir) {
    const el = gdropRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  }

  // Drop a brain-dump task onto the Gantt → schedule a 1h block at the dropped time.
  // Account for horizontal scroll: position is within the full 1440px track, not just the visible area.
  function onGanttDrop(e) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("id"));
    if (!id) return;
    const el = e.currentTarget;
    const x = e.clientX - el.getBoundingClientRect().left + el.scrollLeft;
    const frac = Math.min(Math.max(x / el.scrollWidth, 0), 1);
    let start = Math.round((frac * 1440) / 30) * 30; // snap to 30 min
    start = Math.min(start, 1380);                   // clamp so the 1h block fits in 24h
    patch(id, { status: "scheduled", startMin: start, endMin: start + 60 });
  }

  // Drag a placed Gantt block to move it, or grab an edge to resize. Persists on release.
  function startDrag(e, task, mode) {
    e.preventDefault();
    e.stopPropagation();
    const track = e.currentTarget.closest(".gantt-track");
    if (!track) return;
    const pxToMin = 1440 / track.getBoundingClientRect().width;
    const startX = e.clientX;
    const origStart = task.startMin, origEnd = task.endMin;
    let s = origStart, en = origEnd;

    function onMove(ev) {
      const delta = Math.round(((ev.clientX - startX) * pxToMin) / 15) * 15; // 15-min snap
      if (mode === "move") {
        s = origStart + delta; en = origEnd + delta;
        if (s < 0) { en -= s; s = 0; }
        if (en > 1440) { s -= (en - 1440); en = 1440; }
      } else if (mode === "left") {
        s = Math.max(0, Math.min(origStart + delta, origEnd - 15));
      } else {
        en = Math.min(1440, Math.max(origEnd + delta, origStart + 15));
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, startMin: s, endMin: en } : t)));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      api.put(`/tasks/${task.id}`, toApi({ ...task, startMin: s, endMin: en })).catch(() => {
        // Save failed — snap the block back to where it was so the screen matches the server.
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, startMin: origStart, endMin: origEnd } : t)));
        notifyError("Couldn't save the new time — reverted.");
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // fromApi gives each task a `status` ("done"/"scheduled"/"inbox"), not a `done` flag.
  const yDone = yesterday.filter((t) => t.status === "done");
  const yMiss = yesterday.filter((t) => t.status !== "done");
  // Only tasks actually placed on the timeline (have a start time) get a Gantt row —
  // a task marked Done straight from the brain dump has no time, so it shouldn't show here.
  const ganttRows = tasks.filter((t) => t.startMin != null && (t.status === "scheduled" || t.status === "done"));
  const nowPct = (nowMin / 1440) * 100;

  const toastRoot = typeof document !== "undefined" ? document.getElementById("toast-root") : null;

  return (
    <section className="view active" id="view-tasks">
      {toast && toastRoot &&
        createPortal(
          <div className={`toast${toast.out ? " out" : ""}`} style={{ borderLeftColor: toast.color }}>
            <div className="ta">{toast.face}</div>
            <div className="tc">
              <div className="th"><span className="tn2" style={{ color: toast.color }}>{toast.title}</span></div>
              <div className="tx">{toast.text}</div>
            </div>
          </div>,
          toastRoot
        )}

      <div className="view-head">
        <h2> Tasks · Gantt</h2>
        <p>Brain-dump it, then drag it onto the timeline. Both screens share the <b>same Task</b>.</p>
      </div>
      <div className="tasks-grid">
        {/* ───────── Yesterday review ───────── */}
        <div className="card yday-card">
          <h3> Yesterday's review <span className="sub">cheer the wins · carry the misses to today</span></h3>
          {yesterday.length === 0 ? (
            // Brand-new account (or a genuinely empty yesterday): don't claim "All done" when
            // nothing was ever planned — show a neutral fresh-start note instead.
            <div className="dump-empty" style={{ padding: "26px 8px", textAlign: "center", fontSize: 15, fontWeight: 600 }}>
              Nothing from yesterday — today's a fresh start! ✨
            </div>
          ) : (
            <div className="dump-cols">
              <div className="dump-col">
                <div className="dump-sec">✅ Done yesterday <span className="dump-n">{yDone.length}</span></div>
                <div>
                  {yDone.length ? yDone.map((t) => (
                    <div className="task-li" key={t.id}>
                      <span className="title" title={t.title}>{t.title}</span>
                      <span className="chip done">✅ Done</span>
                    </div>
                  )) : (<div className="dump-empty">Nothing</div>)}
                </div>
              </div>
              <div className="dump-col">
                <div className="dump-sec">😵 Missed yesterday <span className="dump-n">{yMiss.length}</span></div>
                <div>
                  {yMiss.length ? yMiss.map((t) => (
                    <div className="task-li" key={t.id}>
                      <span className="title" title={t.title}>{t.title}</span>
                      <button className="act carry" onClick={() => carryToday(t.id)}>↓ To today</button>

                    </div>
                  )) : (<div className="dump-empty">All done! 🎉</div>)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ───────── Brain dump ───────── */}
        <div className="card">
          <h3> Brain dump <span className="sub">⭐ = important</span></h3>
          <div className="dump-input">
            <input
              type="text"
              placeholder="Dump whatever's in your head… (Enter)"
              value={draft}
              maxLength={60} /* soft cap — keeps titles label-length; long ones still ellipsis + tooltip */
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
            />
            <button className="btn btn-primary btn-sm" onClick={addTask}>Add</button>
          </div>
          {draft.length >= 40 && (
            <div
              style={{
                textAlign: "right",
                fontSize: 11.5,
                fontWeight: 700,
                marginTop: 6,
                color: draft.length >= 60 ? "var(--coral)" : "var(--txt3)",
              }}
            >
              {draft.length}/60{draft.length >= 60 ? " · max length reached" : ""}
            </div>
          )}
          <div>
            <div className="dump-cols">
              <DumpColumn label="⚡ Now" when="now" tasks={tasks} nowMin={nowMin}
                onToggleImp={toggleImp} onSetDone={setDone} onSetWhen={setWhen} onSetColor={setColor} onRename={setTitle} onSchedule={scheduleTask} onDel={delTask} />
              <DumpColumn label="🌙 Later" when="later" tasks={tasks} nowMin={nowMin}
                onToggleImp={toggleImp} onSetDone={setDone} onSetWhen={setWhen} onSetColor={setColor} onRename={setTitle} onSchedule={scheduleTask} onDel={delTask} />
            </div>
          </div>
        </div>

        {/* ───────── Today's Gantt ───────── */}
        <div className="card">
          <h3 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            Today's Gantt
            <span className="sub" style={{ flex: 1 }}>drag a task here · drag block to move/resize · 30 min · 24h</span>
            <button type="button" className="gnow-btn" onClick={() => centerOnNow(true)} title="Scroll the timeline to the current time">
              🕒 Current time
            </button>
          </h3>
          <div className="gwrap">
            <button className="gnav l" aria-label="Previous hours" onClick={() => scrollGantt(-1)}>‹</button>
            <div className="gdrop" ref={gdropRef} onDragOver={(e) => e.preventDefault()} onDrop={onGanttDrop}>
              <div className="gantt-head">
                <div className="gt">{HOURS.map((h) => (<span key={h}>{h}</span>))}</div>
              </div>
              {/* width must equal the 1440px track (--gw) so the now-line's left:%% maps to the
                  same hour scale as the header/tracks and scrolls with them — otherwise it lands
                  on the wrong hour (the percentage was measured against the visible width). */}
              <div style={{ position: "relative", width: "var(--gw)" }}>
                {/* a single full-height now-line over all lanes */}
                {nowPct >= 0 && nowPct <= 100 && (
                  <div className="now-line" style={{ left: `${nowPct}%`, top: 0, bottom: 0 }} />
                )}
                {/* always show at least 6 lanes so there's room to place tasks freely */}
                {Array.from({ length: Math.max(ganttRows.length, 6) }).map((_, i) => {
                  const t = ganttRows[i];
                  const left = t ? (t.startMin / 1440) * 100 : 0;
                  const width = t ? ((t.endMin - t.startMin) / 1440) * 100 : 0;
                  const missed = t ? isMissed(t, nowMin) : false;
                  const done = t ? t.status === "done" : false;
                  return (
                    <div className="gantt-row" key={t ? t.id : `empty-${i}`}>
                      <div className="gantt-track">
                        {t && (
                          <div className={`gantt-block ${missed ? "missed" : ""} ${done ? "is-done" : ""}`}
                            data-id={t.id}
                            title={`${t.title} · ${fmtTime(t.startMin)}–${fmtTime(t.endMin)}`}
                            onPointerDown={(e) => startDrag(e, t, "move")}
                            style={{ left: `${left}%`, width: `${width}%`, background: `${t.color}22`, borderLeft: `3px solid ${t.color}`, color: t.color, cursor: "grab" }}>
                            {!done && <span className="gres l" onPointerDown={(e) => startDrag(e, t, "left")} />}
                            <button className="gck" onPointerDown={(e) => e.stopPropagation()} onClick={() => setDone(t.id, !done)}>{done ? "✓" : "○"}</button>
                            <span className="glabel">{t.imp ? "⭐ " : ""}{t.title}{missed ? " 😱" : ""}</span>
                            {!done && <span className="gres r" onPointerDown={(e) => startDrag(e, t, "right")} />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button className="gnav r" aria-label="Next hours" onClick={() => scrollGantt(1)}>›</button>
          </div>
          <div className="gantt-hint">
            💡 <b>Drag</b> a task here for an exact time · or hit <b>⏱ Schedule</b> for a quick slot · grab a block edge to resize · red dotted = <b style={{ color: "var(--coral)" }}>missed</b>
          </div>
        </div>
      </div>
    </section>
  );
}

// One brain-dump column (Now / Later). Important tasks sort to top.
function DumpColumn({ label, when, tasks, nowMin, onToggleImp, onSetDone, onSetWhen, onSetColor, onRename, onSchedule, onDel }) {
  const arr = tasks.filter((t) => (t.when || "now") === when).sort((a, b) => Number(b.imp) - Number(a.imp));
  // Close the <details> dropdown right after a choice — keeps the pill snappy.
  const close = (e) => { const d = e.currentTarget.closest("details"); if (d) d.open = false; };
  // Inline title rename: double-click the title → edit → Enter / blur saves, Esc cancels.
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  return (
    <div className="dump-col">
      <div className="dump-sec">{label} <span className="dump-n">{arr.length}</span></div>
      {arr.length ? arr.map((t) => {
        const w = t.when || "now";
        const done = t.status === "done";
        return (
          <div className={`task-li ${done ? "done" : ""}`} key={t.id} draggable={editId !== t.id}
            onDragStart={(e) => e.dataTransfer.setData("id", String(t.id))}>
            <button className="star" onClick={() => onToggleImp(t.id)}>{t.imp ? "⭐" : "☆"}</button>
            <div className="title-wrap">
              {editId === t.id ? (
                <input
                  className="title-input"
                  value={editText}
                  autoFocus
                  maxLength={60}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { const v = editText.trim(); setEditId(null); if (v && v !== t.title) onRename(t.id, v); }
                    else if (e.key === "Escape") setEditId(null);
                  }}
                  onBlur={() => { const v = editText.trim(); setEditId(null); if (v && v !== t.title) onRename(t.id, v); }}
                />
              ) : (
                <>
                  <span
                    className="title"
                    title={t.title}
                    onDoubleClick={() => { setEditId(t.id); setEditText(t.title); }}
                  >
                    {t.title}
                  </span>
                  {isMissed(t, nowMin) && <span className="miss-flag" title="Past due · missed">😱</span>}
                  <button
                    className="title-edit-btn"
                    title="Rename"
                    onClick={() => { setEditId(t.id); setEditText(t.title); }}
                  >
                    ✏️
                  </button>
                </>
              )}
            </div>

            {/* All controls grouped so they wrap to the next line as one block (never split raggedly). */}
            <div className="task-ctrls">
              {/* Colour picker — sets the task's colour everywhere it shows (this list + the Gantt block). */}
              <details className="wsel csel">
                <summary className="wpill cpill" title="Task colour — also shows on the Gantt block">
                  <span className="cdot" style={{ background: t.color }} /> ▾
                </summary>
                <div className="wmenu cmenu">
                  {TASK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`cswatch${t.color === c ? " on" : ""}`}
                      style={{ background: c }}
                      title={c}
                      onClick={(e) => { onSetColor(t.id, c); close(e); }}
                    />
                  ))}
                  <label className="cswatch ccustom" title="Custom colour" onClick={(e) => e.stopPropagation()}>
                    🎨
                    <input
                      type="color"
                      value={t.color || "#E8734A"}
                      onChange={(e) => onSetColor(t.id, e.target.value)}
                    />
                  </label>
                </div>
              </details>

              <details className="wsel">
                <summary className={`wpill ${done ? "st-done" : "st-todo"}`}>{done ? "✅ Done" : "⭕ To do"} ▾</summary>
                <div className="wmenu">
                  <button className="wopt" onClick={(e) => { onSetDone(t.id, true); close(e); }}>✅ Done</button>
                  <button className="wopt" onClick={(e) => { onSetDone(t.id, false); close(e); }}>⭕ To do</button>
                </div>
              </details>

              {t.status === "inbox" && (
                <button
                  className="act"
                  title="Quick-schedule: drops a 1-hour block at the next hour. Or drag the task onto the timeline for an exact time."
                  onClick={() => onSchedule(t.id)}
                >
                  ⏱ Schedule
                </button>
              )}

              <details className="wsel">
                <summary className={`wpill ${w}`}>{w === "now" ? "⚡ Now" : "🌙 Later"} ▾</summary>
                <div className="wmenu">
                  <button className="wopt" onClick={(e) => { onSetWhen(t.id, "now"); close(e); }}>⚡ Now</button>
                  <button className="wopt" onClick={(e) => { onSetWhen(t.id, "later"); close(e); }}>🌙 Later</button>
                </div>
              </details>

              <button className="act del" onClick={() => onDel(t.id)}>🗑</button>
            </div>
          </div>
        );
      }) : (<div className="dump-empty">Nothing here</div>)}
    </div>
  );
}
