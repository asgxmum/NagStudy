import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { taskColor } from "../utils/taskColor";
import { useNag } from "../context/NagContext";
import { useNavigate } from "react-router-dom";
import { useTour } from "../context/useTour";
import introJs from "intro.js";
import "intro.js/introjs.css";

// Pomodoro — prototype layout (ring timer + presets + category chips + today's log),
// wired to the backend: categories from /api/categories, sessions to /api/studysessions.
// Markup + classNames mirror the prototype 1:1 — styling comes from src/styles/prototype.css.

const RING_R = 120;
const RING_C = 2 * Math.PI * RING_R; // circumference for the SVG progress ring
const LOG_THRESHOLD = 600; // ≥ 10 min of cumulative focus (seconds) gets logged

const PRESETS = [
    { label: "25 min", min: 25 },
    { label: "50 min", min: 50 },
    { label: "Custom", min: 0 },
];

// new-category palette (cycled as categories are added)
const PALETTE = ["#E8734A", "#6E89BE", "#3FA7A2", "#9B7EBD", "#D9883E", "#2C3E63", "#BE9E54", "#D98C97", "#6FA07A"];

const pad = (n) => String(n).padStart(2, "0");
const now = () => `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
const fmtDur = (min) => {
    const h = Math.floor(min / 60);
    return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
};

// API DateTime comes back without a 'Z' but is stored as UTC — append 'Z' so the browser
// converts it to local (MYT) time correctly.
const asLocal = (iso) => new Date(`${iso}Z`);
const isToday = (iso) => {
    const d = asLocal(iso), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};
// UTC ISO (no 'Z') → local minutes-of-day, for matching a scheduled task against "now".
const minOfDay = (iso) => { if (!iso) return null; const d = asLocal(iso); return d.getHours() * 60 + d.getMinutes(); };
const nowMinutes = () => new Date().getHours() * 60 + new Date().getMinutes();
// API session row → display row. If the session is tied to a task, label it with the task
// (title + its colour); otherwise fall back to the category name + colour.
const toRow = (s, catList, taskList = []) => {
    const c = catList.find((x) => x.id === s.categoryId) || { name: "Study", color: "#E8734A" };
    const t = s.taskId ? taskList.find((x) => x.id === s.taskId) : null;
    const d = asLocal(s.startedAt);
    return {
        name: t ? t.title : c.name,
        color: t ? t.color : c.color,
        cat: c,
        start: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        min: Math.round(s.duration / 60),
    };
};

export default function Pomodoro() {
    const [dur, setDur] = useState(25 * 60); // total seconds for this preset
    const [left, setLeft] = useState(25 * 60); // seconds remaining
    const [focused, setFocused] = useState(0); // cumulative focus seconds (pauses excluded)
    const [running, setRunning] = useState(false);
    const [presetMin, setPresetMin] = useState(25); // which preset chip is active (0 = Custom)
    const [customLabel, setCustomLabel] = useState("Custom"); // shows "40 min ✎" after a custom pick
    const [demo, setDemo] = useState(true); // ⚡ demo speed: 1 sec counts as 1 min
    const [cats, setCats] = useState([]); // category chips from /api/categories
    const [cat, setCat] = useState(null); // currently selected category
    const [adding, setAdding] = useState(false); // showing the inline "+ New" input
    const [name, setName] = useState(""); // optional session name (display only)
    const [sessions, setSessions] = useState([]); // today's logged sessions
    const [note, setNote] = useState(""); // info message (short session / errors)
    const [tasks, setTasks] = useState([]); // today's open tasks (for the "working on" picker)
    const [taskId, setTaskId] = useState(null); // which task this focus is for (optional)
    const [donePrompt, setDonePrompt] = useState(null); // { id, title } → offer to mark a task done after a session

    const { setFocusSnapshot } = useNag();
    const navigate = useNavigate();
    const { active, currentPage, nextPage, endTour } = useTour();
    const tourStartedRef = useRef(false);
    const ringWrapRef = useRef(null);

    useEffect(() => {
        if (!active || currentPage !== "pomodoro") return;
        if (!ringWrapRef.current) return;
        if (tourStartedRef.current) return;
        tourStartedRef.current = true;

        const intro = introJs();
        intro.setOptions({
            steps: [
                { element: ".ring-wrap", intro: "This is the <b>Pomodoro timer</b>. Start a focus session and watch the ring fill up.", title: "Timer" },
                { element: ".pomo-presets", intro: "Pick a <b>preset duration</b> — 25 min, 50 min, or a custom length.", title: "Presets" },
                { element: ".pomo-ctrl", intro: "Hit <b>Start</b> to begin focusing. Pause anytime, or Stop & log to save early.", title: "Controls" },
                { element: ".pomo-side", intro: "Set up your session — pick a <b>task</b>, a <b>category</b>, and toggle demo speed.", title: "Session Setup" },
                { element: ".pomo-log-card", intro: "Your <b>study log</b> for today — every session you complete shows up here.", title: "Today's Log" },
            ],
            nextLabel: "Next →", prevLabel: "← Back", doneLabel: "Next page →",
            skipLabel: "Skip tour", showProgress: true, showBullets: false, exitOnOverlayClick: false,
        });
        let completed = false;
        intro.oncomplete(() => { completed = true; nextPage(); setTimeout(() => navigate("/app/coach"), 200); });
        intro.onexit(() => { if (!completed) endTour(); });
        intro.start();
    }, [active, currentPage, ringWrapRef.current]);

    const demoRef = useRef(demo);
    demoRef.current = demo; // keep the interval's speed reading current without resetting it

    // Load my categories + today's sessions on mount.
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const cres = await api.get("/categories");
                if (!alive) return;
                const list = cres.data;
                setCats(list);
                if (list.length) { setCat(list[0]); setName(list[0].name); }

                // Today's open tasks (from Tasks · Gantt) feed the "what are you working on?" picker.
                const tres = await api.get("/tasks?date=today");
                if (!alive) return;
                const openTasks = tres.data
                    .filter((t) => (t.status || "").toLowerCase() !== "done")
                    .map((t) => ({
                        // Same colour rule as Tasks · Gantt: picked colour, else stable per-id palette colour.
                        id: t.id, title: t.title, color: t.color || taskColor(t.id),
                        startMin: minOfDay(t.startTime), endMin: minOfDay(t.endTime),
                    }));
                setTasks(openTasks);
                // Auto-suggest from the Gantt-scheduled, not-done tasks: the one happening right now,
                // else the next one coming up today. (Unscheduled tasks are pickable but not auto-picked.)
                const nm = nowMinutes();
                const scheduled = openTasks.filter((t) => t.startMin != null && t.endMin != null);
                const current = scheduled.find((t) => nm >= t.startMin && nm < t.endMin);
                const upcoming = scheduled.filter((t) => t.startMin > nm).sort((a, b) => a.startMin - b.startMin)[0];
                const suggest = current || upcoming;
                if (suggest) { setTaskId(suggest.id); setName(suggest.title); }

                const sres = await api.get("/studysessions");
                if (!alive) return;
                setSessions(sres.data.filter((s) => isToday(s.startedAt)).map((s) => toRow(s, list, openTasks)));
            } catch { /* not logged in / offline — leave empty */ }
        })();
        return () => { alive = false; };
    }, []);

    // The countdown: one interval while running, cleaned up on pause/unmount.
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => {
            const step = demoRef.current ? 60 : 1; // demo: 1 real sec = 60 focus sec (1 min)
            setFocused((f) => f + step);
            setLeft((l) => {
                const next = Math.max(0, l - step);
                if (next === 0) setRunning(false); // auto-stop at zero
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [running]);

    // Share live focus state with NagContext for Nagging check-ins.
    useEffect(() => {
        const selTask = tasks.find((t) => t.id === taskId);
        const elapsedMin = Math.floor(focused / 60);
        setFocusSnapshot({
            isFocusing: running,
            focusTaskId: running && taskId ? taskId : null,
            focusTaskTitle: running && selTask ? selTask.title : null,
            focusCategory: running && cat ? cat.name : null,
            focusElapsedMinutes: running ? elapsedMin : 0,
        });
        return () => setFocusSnapshot(null);
    }, [running, taskId, tasks, cat, focused, setFocusSnapshot]);

    // Reaching zero auto-logs the session.
    useEffect(() => {
        if (left === 0 && focused > 0) logSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [left]);

    function applyPreset(p) {
        setRunning(false);
        let m = p.min;
        if (m === 0) {
            const raw = parseInt(prompt("How many minutes? (5–180)", "40"), 10) || 40;
            m = Math.min(Math.max(raw, 5), 180);
            setCustomLabel(`${m} min ✎`);
        }
        setPresetMin(p.min);
        setDur(m * 60);
        setLeft(m * 60);
        setFocused(0);
        setNote("");
    }

    function toggle() {
        setNote("");
        setRunning((r) => !r);
    }

    // Stop the timer and, if enough focus accrued, persist the session to the backend.
    async function logSession() {
        setRunning(false);
        if (focused >= LOG_THRESHOLD && cat) {
            const min = Math.round(focused / 60);
            const selTask = tasks.find((t) => t.id === taskId) || null;
            const label = selTask ? selTask.title : (name.trim() || cat.name);
            const rowColor = selTask ? selTask.color : cat.color;
            // Optimistic row first, then persist (duration in seconds, startedAt in UTC).
            setSessions((prev) => [{ name: label, cat, color: rowColor, start: now(), min }, ...prev]);
            setNote("");
            try {
                await api.post("/studysessions", {
                    categoryId: cat.id,
                    taskId: selTask ? selTask.id : null,
                    startedAt: new Date().toISOString(),
                    duration: focused,
                });
                // After a real focus session on a task, offer to tick it off (Pomodoro → Tasks).
                if (selTask) setDonePrompt({ id: selTask.id, title: selTask.title });
            } catch {
                setNote("Couldn't save this session to the server.");
            }
        } else if (focused > 0) {
            setNote(`Only ${Math.floor(focused / 60)} min of focus — under 10 min, so it wasn't logged.`);
        }
        setLeft(dur);
        setFocused(0);
    }

    // Mark the just-focused task as Done (GET the full task, then PUT it back with Done status).
    async function markTaskDone() {
        const p = donePrompt;
        setDonePrompt(null);
        if (!p) return;
        try {
            const { data: t } = await api.get(`/tasks/${p.id}`);
            await api.put(`/tasks/${p.id}`, {
                title: t.title,
                description: t.description,
                isImportant: t.isImportant,
                remindBeforeStart: t.remindBeforeStart ?? false,
                scheduledDate: t.scheduledDate,
                when: t.when,
                status: "Done",
                color: t.color,
                startTime: t.startTime,
                endTime: t.endTime,
                completedAt: new Date().toISOString(),
            });
            setTasks((prev) => prev.filter((x) => x.id !== p.id)); // drop from the picker
            if (taskId === p.id) setTaskId(null);
            setNote(`Nice — "${p.title}" marked done ✅`);
        } catch {
            setNote("Couldn't mark the task done.");
        }
    }

    function pickCat(c) {
        setCat(c);
        setName(c.name); // clicking a category fills the session-name input
    }

    // Create a new category on the backend, then select it.
    async function commitCat(val) {
        setAdding(false);
        const nm = (val || "").trim();
        if (!nm) return;
        const color = PALETTE[cats.length % PALETTE.length];
        try {
            const res = await api.post("/categories", { name: nm, color });
            const created = res.data;
            setCats((prev) => [...prev, created]);
            setCat(created);
            setName(created.name);
        } catch (e) {
            setNote(e.response?.data?.message || "Couldn't create the category.");
        }
    }

    const mm = pad(Math.floor(left / 60));
    const ss = pad(left % 60);
    const focusedMin = Math.floor(focused / 60);
    const dashOffset = RING_C * (1 - (dur ? left / dur : 0));
    const startLabel = running ? "⏸ Pause" : focused > 0 ? "▶ Resume" : "▶ Start";

    return (
        <section className="view active" id="view-pomo">
            <div className="view-head">
                <h2> Pomodoro</h2>
                <p>
                    Escape to another tab and it auto-pauses — then you get nagged the
                    second you're back. For real. Try it!
                </p>
            </div>
            <div className="pomo-wrap">
                <div className="pomo-left">
                    <div className="card pomo-main">
                        <div className="ring-wrap" ref={ringWrapRef}>
                            <svg width="270" height="270" viewBox="0 0 270 270">
                                <defs>
                                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#F3A684" />
                                        <stop offset="100%" stopColor="#E8734A" />
                                    </linearGradient>
                                </defs>
                                <circle className="ring-bg" cx="135" cy="135" r={RING_R} />
                                <circle
                                    className="ring-fg"
                                    id="ringFg"
                                    cx="135"
                                    cy="135"
                                    r={RING_R}
                                    strokeDasharray={RING_C}
                                    strokeDashoffset={dashOffset}
                                />
                            </svg>
                            <div className="ring-center">
                                <div className="time" id="pomoTime">
                                    {mm}:{ss}
                                </div>
                                <div className="stat" id="pomoStat">
                                    {running ? "🔴 recording" : "idle"} · this session{" "}
                                    <b>{focusedMin}m</b>
                                </div>
                            </div>
                        </div>
                        <div className="pomo-presets">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    className={`preset${presetMin === p.min ? " on" : ""}`}
                                    data-min={p.min}
                                    onClick={() => applyPreset(p)}
                                >
                                    {p.min === 0 ? customLabel : p.label}
                                </button>
                            ))}
                        </div>
                        <div className="pomo-ctrl">
                            <button className="btn btn-primary" id="pomoStart" onClick={toggle}>
                                {startLabel}
                            </button>
                            <button className="btn btn-ghost" onClick={logSession}>
                                ■ Stop &amp; log
                            </button>
                        </div>
                        {donePrompt && (
                            <div className="pomo-doneprompt">
                                <span>Done with <b>“{donePrompt.title}”</b>?</span>
                                <button className="btn btn-primary btn-sm" onClick={markTaskDone}>✅ Mark done</button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setDonePrompt(null)}>Not yet</button>
                            </div>
                        )}
                    </div>

                    {/* Today's study log — moved under the timer (left column) instead of the side card. */}
                    <div className="card pomo-log-card">
                        <label style={{ fontSize: 16, color: "var(--txt)", marginBottom: 10, display: "block", fontWeight: 800 }}>
                            📒 What you studied today
                        </label>
                        <div id="pomoLog" className="pomo-log">
                            {sessions.length === 0 ? (
                                <div className="pomo-log-empty">
                                    No sessions yet — hit Start, study, then Stop &amp; log!
                                </div>
                            ) : (
                                sessions.slice(0, 6).map((s, i) => (
                                    <div className="pomo-log-row" key={`${s.name}-${s.start}-${i}`}>
                                        <span
                                            className="cdot"
                                            style={{ width: 9, height: 9, borderRadius: 3, display: "inline-block", flexShrink: 0, background: s.color || s.cat.color }}
                                        />
                                        <span className="pl-nm">{s.name}</span>
                                        <span className="pl-min">{fmtDur(s.min)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                <div className="card pomo-side">
                    <h3 style={{ fontSize: 18 }}>⚙️ Session setup</h3>
                    <div className="field">
                        <label>🎯 What are you working on? <span style={{ fontWeight: 600, color: "var(--txt3)" }}>(optional · today's tasks)</span></label>
                        {tasks.length === 0 ? (
                            <div className="note" style={{ margin: 0 }}>No tasks for today — add some in <b>Tasks · Gantt</b>.</div>
                        ) : (
                            <div className="cat-chips">
                                {tasks.map((t) => (
                                    <button
                                        key={t.id}
                                        className={`cat-chip${taskId === t.id ? " on" : ""}`}
                                        title={t.title}
                                        onClick={() => {
                                            const next = taskId === t.id ? null : t.id;
                                            setTaskId(next);
                                            if (next) setName(t.title); // fill the session name with the task title
                                        }}
                                    >
                                        <span className="d" style={{ background: t.color }} />
                                        <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="field">
                        <label>Category (name + colour, reused)</label>
                        <div className="cat-chips" id="catChips">
                            {cats.map((c) => (
                                <button
                                    key={c.id}
                                    className={`cat-chip${cat?.id === c.id ? " on" : ""}`}
                                    onClick={() => pickCat(c)}
                                >
                                    <span className="d" style={{ background: c.color }} />
                                    {c.name}
                                </button>
                            ))}
                            {adding ? (
                                <span className="cat-chip cat-input">
                                    <input
                                        id="newCatInput"
                                        maxLength={20}
                                        autoComplete="off"
                                        placeholder="Name, then Enter"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                commitCat(e.currentTarget.value);
                                            } else if (e.key === "Escape") {
                                                e.preventDefault();
                                                setAdding(false);
                                            }
                                        }}
                                        onBlur={(e) => commitCat(e.currentTarget.value)}
                                    />
                                </span>
                            ) : (
                                <button
                                    className="cat-chip cat-add"
                                    onClick={() => setAdding(true)}
                                >
                                    + New
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="field">
                        <label>Session name (optional)</label>
                        <input
                            type="text"
                            id="sessName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Finish algorithms assignment"
                        />
                    </div>
                    <label className="demo-toggle">
                        <input
                            type="checkbox"
                            id="demoSpeed"
                            checked={demo}
                            onChange={(e) => setDemo(e.target.checked)}
                        />
                        ⚡ Demo speed — 1 sec counts as 1 min
                    </label>
                    <div className="note">
                        · <b>Sessions under 10 min aren't logged</b> (cumulative focus,
                        pauses excluded)
                        <br />· Leave the tab → auto-pause → the AI notices when you're back
                        <br />· Logs flow straight into the dashboard &amp; ranking
                    </div>
                    {note && (
                        <div className="note" style={{ color: "var(--mint)" }}>
                            {note}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}