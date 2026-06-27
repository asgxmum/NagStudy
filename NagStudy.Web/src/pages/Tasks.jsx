import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import { taskColor, TASK_COLORS } from "../utils/taskColor";
import {
  fromApi, toApi, mergeBoard, splitBoard, fmtTime, classifyFromForm,
  isMissed, isScheduledToday, todayMytStr, nowMinutesMyt, NEW_TASK,
} from "../utils/taskMapper";
import TasksDebugToolbar, { isTasksDebugHotkey } from "../components/TasksDebugToolbar";
import TaskPopover from "../components/TaskPopover";
import { useNag } from "../context/NagContext";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

export default function Tasks() {
  const [taskMap, setTaskMap] = useState(new Map());
  const [yesterday, setYesterday] = useState([]);
  const [nowMin, setNowMin] = useState(nowMinutesMyt);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugDragNow, setDebugDragNow] = useState(false);
  const [debugNowMin, setDebugNowMin] = useState(null);
  const [toast, setToast] = useState(null);
  const [popover, setPopover] = useState(null);
  const gdropRef = useRef(null);
  const { checkTaskNudges, setDebugNow, onTaskUpdated } = useNag();

  const effectiveNowMin = debugDragNow && debugNowMin != null ? debugNowMin : nowMin;
  const { today, backlog, gantt } = splitBoard(taskMap);

  async function loadBoard() {
    try {
      const res = await api.get("/tasks/board");
      setTaskMap(mergeBoard(res.data));
    } catch {
      notifyError("Couldn't load tasks — check your connection and refresh.");
    }
  }

  useEffect(() => {
    loadBoard();
    api.get("/tasks?date=yesterday").then((res) => setYesterday(res.data.map(fromApi))).catch(() => {});
  }, []);

  useEffect(() => {
    if (debugDragNow) return undefined;
    const id = setInterval(() => setNowMin(nowMinutesMyt()), 30000);
    return () => clearInterval(id);
  }, [debugDragNow]);

  useEffect(() => () => setDebugNow(false, null), [setDebugNow]);

  useEffect(() => {
    if (!onTaskUpdated) return undefined;
    return onTaskUpdated((apiTask) => {
      const t = fromApi(apiTask);
      setTaskMap((prev) => new Map(prev).set(t.id, t));
    });
  }, [onTaskUpdated]);

  const handleDebugDragNow = useCallback((on) => {
    setDebugDragNow(on);
    if (on) setDebugNowMin(nowMinutesMyt());
    else setDebugNowMin(null);
  }, []);

  const toggleDebugToolbar = useCallback(() => setDebugOpen((v) => !v), []);

  useEffect(() => {
    setDebugNow(debugDragNow, debugNowMin);
    if (debugDragNow && debugNowMin != null) checkTaskNudges(debugNowMin);
  }, [debugDragNow, debugNowMin, setDebugNow, checkTaskNudges]);

  useEffect(() => {
    function onKey(e) {
      if (!isTasksDebugHotkey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      toggleDebugToolbar();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [toggleDebugToolbar]);

  function centerOnNow(smooth = false) {
    const el = gdropRef.current;
    if (!el) return;
    const target = (effectiveNowMin / 1440) * el.scrollWidth - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }

  useEffect(() => { centerOnNow(false); }, []);

  useEffect(() => {
    function onDocClick(e) {
      document.querySelectorAll("details.wsel[open]").forEach((d) => {
        if (!d.contains(e.target)) d.open = false;
      });
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const hold = setTimeout(() => setToast((t) => (t ? { ...t, out: true } : t)), 2400);
    const drop = setTimeout(() => setToast(null), 2720);
    return () => { clearTimeout(hold); clearTimeout(drop); };
  }, [toast?.id]);

  function notifyError(text) {
    setToast({ id: Date.now(), face: "⚠️", color: "#D9534F", title: "Something went wrong", text, out: false });
  }

  function upsertTask(apiTask) {
    const t = fromApi(apiTask);
    setTaskMap((prev) => new Map(prev).set(t.id, t));
  }

  function removeTask(id) {
    setTaskMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  async function patch(id, changes) {
    const current = taskMap.get(id);
    if (!current) return;
    const updated = { ...current, ...changes };
    if (changes.startMin != null || changes.endMin != null) {
      updated.status = "scheduled";
      if (!updated.dateStr) updated.dateStr = todayMytStr();
    }
    setTaskMap((prev) => new Map(prev).set(id, updated));
    try {
      const res = await api.put(`/tasks/${id}`, toApi(updated));
      upsertTask(res.data);
      checkTaskNudges();
    } catch {
      setTaskMap((prev) => new Map(prev).set(id, current));
      notifyError("Couldn't save that change — reverted.");
    }
  }

  async function savePopoverTask(t) {
    const classified = classifyFromForm({ dateStr: t.dateStr, startMin: t.startMin });
    const merged = {
      ...t,
      dateStr: classified.dateStr,
      isBacklog: classified.isBacklog,
      color: t.color || TASK_COLORS[0],
    };
    if (merged.status !== "done") {
      merged.status = merged.startMin != null && classified.dateStr === todayMytStr() && !classified.isBacklog
        ? "scheduled" : "inbox";
    }
    try {
      if (merged.id) {
        const res = await api.put(`/tasks/${merged.id}`, toApi(merged));
        upsertTask(res.data);
      } else {
        const res = await api.post("/tasks", toApi(merged));
        upsertTask(res.data);
      }
      setPopover(null);
    } catch {
      notifyError("Couldn't save task.");
    }
  }

  async function delTask(id) {
    removeTask(id);
    try {
      await api.delete(`/tasks/${id}`);
      setPopover(null);
    } catch {
      await loadBoard();
      notifyError("Couldn't delete that task.");
    }
  }

  function moveToBacklog(id) {
    const t = taskMap.get(id);
    if (!t) return;
    patch(id, { isBacklog: true, when: "later", dateStr: "", startMin: null, endMin: null, status: "inbox" });
  }

  function moveToToday(id) {
    const t = taskMap.get(id);
    if (!t) return;
    patch(id, { isBacklog: false, when: "now", dateStr: todayMytStr(), status: "inbox" });
  }

  function toggleImp(id) { patch(id, { imp: !taskMap.get(id)?.imp }); }
  function setDone(id, done) {
    const t = taskMap.get(id);
    patch(id, { status: done ? "done" : (t?.startMin != null ? "scheduled" : "inbox") });
  }

  function unscheduleTask(id) {
    const t = taskMap.get(id);
    patch(id, { status: "inbox", startMin: null, endMin: null });
    setToast({
      id: Date.now(), face: "↩", color: t?.color || taskColor(id),
      title: "Returned to Today",
      text: `“${t?.title ?? "Task"}” is off the Gantt.`,
      out: false,
    });
  }

  async function carryToday(id) {
    const item = yesterday.find((t) => t.id === id);
    if (!item) return;
    setYesterday((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await api.post("/tasks", toApi({
        title: item.title, imp: false, isBacklog: false, dateStr: todayMytStr(),
        status: "inbox", startMin: null, endMin: null, color: item.color,
      }));
      upsertTask(res.data);
    } catch {
      notifyError("Couldn't carry that over.");
      api.get("/tasks?date=yesterday").then((r) => setYesterday(r.data.map(fromApi))).catch(() => {});
    }
  }

  function scrollGantt(dir) {
    const el = gdropRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  }

  function onGanttDrop(e) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("id"));
    if (!id) return;
    const el = e.currentTarget;
    const x = e.clientX - el.getBoundingClientRect().left + el.scrollLeft;
    const frac = Math.min(Math.max(x / el.scrollWidth, 0), 1);
    let start = Math.round((frac * 1440) / 30) * 30;
    start = Math.min(start, 1380);
    patch(id, { status: "scheduled", dateStr: todayMytStr(), startMin: start, endMin: start + 60, isBacklog: false });
  }

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
      const delta = Math.round(((ev.clientX - startX) * pxToMin) / 15) * 15;
      if (mode === "move") {
        s = origStart + delta; en = origEnd + delta;
        if (s < 0) { en -= s; s = 0; }
        if (en > 1440) { s -= (en - 1440); en = 1440; }
      } else if (mode === "left") {
        s = Math.max(0, Math.min(origStart + delta, origEnd - 15));
      } else {
        en = Math.min(1440, Math.max(origEnd + delta, origStart + 15));
      }
      setTaskMap((prev) => new Map(prev).set(task.id, { ...task, startMin: s, endMin: en }));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const updated = { ...task, startMin: s, endMin: en };
      api.put(`/tasks/${task.id}`, toApi(updated)).then((res) => {
        upsertTask(res.data);
        checkTaskNudges();
      }).catch(() => {
        setTaskMap((prev) => new Map(prev).set(task.id, { ...task, startMin: origStart, endMin: origEnd }));
        notifyError("Couldn't save the new time — reverted.");
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startNowLineDrag(e) {
    if (!debugDragNow) return;
    e.preventDefault();
    e.stopPropagation();
    const area = e.currentTarget.closest("[data-gantt-track-area]");
    if (!area) return;
    const rect = area.getBoundingClientRect();
    function minFromEvent(ev) {
      const x = ev.clientX - rect.left;
      const frac = Math.min(Math.max(x / rect.width, 0), 1);
      return Math.round((frac * 1440) / 5) * 5;
    }
    setDebugNowMin(minFromEvent(e));
    function onMove(ev) { setDebugNowMin(minFromEvent(ev)); }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      checkTaskNudges();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const yDone = yesterday.filter((t) => t.status === "done");
  const yMiss = yesterday.filter((t) => t.status !== "done");
  const ganttRows = gantt;
  const nowPct = (effectiveNowMin / 1440) * 100;
  const toastRoot = typeof document !== "undefined" ? document.getElementById("toast-root") : null;

  return (
    <section className="view active" id="view-tasks">
      <TasksDebugToolbar
        open={debugOpen}
        onClose={() => setDebugOpen(false)}
        dragNowLine={debugDragNow}
        onDragNowLineChange={handleDebugDragNow}
      />

      {popover !== null && (
        <TaskPopover
          task={popover}
          onSave={savePopoverTask}
          onDelete={delTask}
          onClose={() => setPopover(null)}
        />
      )}

      {toast && toastRoot && createPortal(
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
        <h2>Tasks · Gantt</h2>
      </div>

      <div className="tasks-layout">
        {yesterday.length > 0 && (
          <div className="card yday-card tasks-yday">
            <h3>Yesterday&apos;s review</h3>
            <div className="dump-cols">
              <div className="dump-col">
                <div className="dump-sec">✅ Done <span className="dump-n">{yDone.length}</span></div>
                {yDone.map((t) => <div className="task-li" key={t.id}><span className="title">{t.title}</span></div>)}
              </div>
              <div className="dump-col">
                <div className="dump-sec">😵 Missed <span className="dump-n">{yMiss.length}</span></div>
                {yMiss.map((t) => (
                  <div className="task-li" key={t.id}>
                    <span className="title">{t.title}</span>
                    <button type="button" className="act carry" onClick={() => carryToday(t.id)}>↓ To today</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="card tasks-top-panel">
          <div className="tasks-top-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPopover({ ...NEW_TASK, color: TASK_COLORS[0] })}>+ Add task</button>
          </div>
          <div className="tasks-top-cols dump-cols">
            <TaskColumn label="📋 Today" tasks={today} nowMin={effectiveNowMin} onEdit={setPopover} onToggleImp={toggleImp} onSetDone={setDone} onMoveBacklog={moveToBacklog} onDel={delTask} />
            <TaskColumn label="📦 Backlog" tasks={backlog} nowMin={effectiveNowMin} onEdit={setPopover} onToggleImp={toggleImp} onSetDone={setDone} onMoveToday={moveToToday} onDel={delTask} />
          </div>
        </div>

        <div className="card tasks-gantt-panel">
          <h3 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            Today&apos;s Gantt
            <span className="sub" style={{ flex: 1 }}>
              {debugDragNow && <span style={{ color: "var(--coral)", fontWeight: 700 }}>debug {fmtTime(effectiveNowMin)} · </span>}
              drag from Today · ↩ on Gantt returns to list
            </span>
            <button type="button" className="gnow-btn" onClick={() => centerOnNow(true)}>🕒 Center</button>
          </h3>
          <div className="gwrap">
            <button type="button" className="gnav l" onClick={() => scrollGantt(-1)}>‹</button>
            <div className="gdrop" ref={gdropRef} onDragOver={(e) => e.preventDefault()} onDrop={onGanttDrop}>
              <div className="gantt-head"><div className="gt">{HOURS.map((h) => <span key={h}>{h}</span>)}</div></div>
              <div className="gantt-track-area" data-gantt-track-area style={{ position: "relative", width: "var(--gw)" }}>
                {nowPct >= 0 && nowPct <= 100 && (
                  <div className={`now-line${debugDragNow ? " now-line-draggable" : ""}`} style={{ left: `${nowPct}%`, top: 0, bottom: 0 }}
                    onPointerDown={startNowLineDrag} title={debugDragNow ? "Drag debug time" : undefined} />
                )}
                {Array.from({ length: Math.max(ganttRows.length, 6) }).map((_, i) => {
                  const t = ganttRows[i];
                  const left = t ? (t.startMin / 1440) * 100 : 0;
                  const width = t ? ((t.endMin - t.startMin) / 1440) * 100 : 0;
                  const missed = t ? isMissed(t, effectiveNowMin) : false;
                  const done = t ? t.status === "done" : false;
                  return (
                    <div className="gantt-row" key={t ? t.id : `e-${i}`}>
                      <div className="gantt-track">
                        {t && (
                          <div className={`gantt-block gantt-block-compact ${missed ? "missed" : ""} ${done ? "is-done" : ""}`}
                            onPointerDown={(e) => startDrag(e, t, "move")}
                            title={`${t.title} · ${fmtTime(t.startMin)}–${fmtTime(t.endMin)}`}
                            style={{ left: `${left}%`, width: `${width}%`, background: `${t.color}22`, borderLeft: `3px solid ${t.color}`, color: t.color, cursor: "grab" }}>
                            {!done && <span className="gres l" onPointerDown={(e) => startDrag(e, t, "left")} />}
                            <span className="glabel">{t.title}</span>
                            {!done && <button type="button" className="gunsched" onPointerDown={(e) => e.stopPropagation()} onClick={() => unscheduleTask(t.id)} title="Return to Today">↩</button>}
                            {!done && <span className="gres r" onPointerDown={(e) => startDrag(e, t, "right")} />}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button type="button" className="gnav r" onClick={() => scrollGantt(1)}>›</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskColumn({ label, tasks, nowMin, onEdit, onToggleImp, onSetDone, onMoveBacklog, onMoveToday, onDel }) {
  return (
    <div className="dump-col">
      <div className="dump-sec">{label} <span className="dump-n">{tasks.length}</span></div>
      {tasks.length ? tasks.map((t) => {
        const done = t.status === "done";
        return (
        <div className={`task-li${done ? " done" : ""}`} key={t.id} draggable={!done} onDragStart={(e) => !done && e.dataTransfer.setData("id", String(t.id))}>
          <button type="button" className="star" onClick={() => onToggleImp(t.id)} disabled={done}>{t.imp ? "⭐" : "☆"}</button>
          <div className="title-wrap">
            {isScheduledToday(t) && !done && <span className="gantt-sched-badge">Scheduled</span>}
            <button type="button" className="title title-btn" onClick={() => onEdit(t)} title={t.description || t.title}>
              {t.title}
            </button>
            {isScheduledToday(t) && !done && (
              <span className="task-time-hint">{fmtTime(t.startMin)}–{fmtTime(t.endMin)}</span>
            )}
            {t.description && <span className="task-desc-hint" title={t.description}>📄</span>}
            {isMissed(t, nowMin) && !done && <span className="miss-flag">😱</span>}
          </div>
          <div className="task-ctrls">
            <span className={`wpill ${done ? "st-done" : "st-todo"}`}>{done ? "✅ Done" : "⭕ To do"}</span>
            {!done && (
              <>
                <button type="button" className="act" onClick={() => onSetDone(t.id, true)} title="Mark done">✅</button>
                {onMoveBacklog && <button type="button" className="act" onClick={() => onMoveBacklog(t.id)}>→ Backlog</button>}
                {onMoveToday && <button type="button" className="act" onClick={() => onMoveToday(t.id)}>→ Today</button>}
                <button type="button" className="act del" onClick={() => onDel(t.id)}>🗑</button>
              </>
            )}
            {done && (
              <button type="button" className="act" onClick={() => onSetDone(t.id, false)} title="Reopen">↩ Reopen</button>
            )}
          </div>
        </div>
        );
      }) : <div className="dump-empty">Nothing here</div>}
    </div>
  );
}
