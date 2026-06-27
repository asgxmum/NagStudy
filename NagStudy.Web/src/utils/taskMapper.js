import { taskColor } from "./taskColor";

const asUtc = (iso) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);

export function mytDateStr(iso) {
  if (!iso) return "";
  const d = asUtc(iso);
  const myt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 10);
}

export function todayMytStr() {
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return myt.toISOString().slice(0, 10);
}

export function minOfDay(iso) {
  if (!iso) return null;
  const d = asUtc(iso);
  const myt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return myt.getUTCHours() * 60 + myt.getUTCMinutes();
}

export function nowMinutesMyt() {
  const now = new Date();
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return myt.getUTCHours() * 60 + myt.getUTCMinutes();
}

export function isoForDateAndMinutes(dateStr, minutes) {
  if (!dateStr) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return new Date(
    `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+08:00`,
  ).toISOString();
}

export function scheduledDateIso(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00+08:00`).toISOString();
}

/** Route task from form fields: no date or future date → Backlog; today → Today/Gantt. */
export function classifyFromForm({ dateStr, startMin }) {
  const today = todayMytStr();
  const d = (dateStr || "").trim();
  if (!d) return { dateStr: "", isBacklog: true };
  if (d > today) return { dateStr: d, isBacklog: true };
  return { dateStr: d, isBacklog: false, onGantt: d === today && startMin != null && startMin !== "" };
}

export function fromApi(t) {
  const scheduledDate = t.scheduledDate ?? null;
  const today = todayMytStr();
  const dateStr = scheduledDate ? mytDateStr(scheduledDate) : "";
  const isBacklog = scheduledDate
    ? dateStr > today
    : (t.when || "").toLowerCase() === "later";

  return {
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    imp: t.isImportant,
    remindBeforeStart: t.remindBeforeStart ?? false,
    scheduledDate,
    dateStr: scheduledDate ? dateStr : (isBacklog ? "" : today),
    isBacklog,
    status: (t.status || "Inbox").toLowerCase(),
    startMin: minOfDay(t.startTime),
    endMin: minOfDay(t.endTime),
    completedAt: t.completedAt,
    color: t.color || taskColor(t.id),
    when: isBacklog ? "later" : "now",
  };
}

export function toApi(t) {
  const today = todayMytStr();
  const classified = classifyFromForm({ dateStr: t.dateStr, startMin: t.startMin });
  const dateStr = classified.dateStr;
  const isBacklog = classified.isBacklog;

  let status = "Inbox";
  if (t.status === "done") status = "Done";
  else if (t.startMin != null && dateStr === today) status = "Scheduled";
  else if (t.status === "scheduled") status = "Scheduled";

  const startTime = t.startMin != null && dateStr
    ? isoForDateAndMinutes(dateStr, t.startMin)
    : null;
  const endTime = t.endMin != null && dateStr
    ? isoForDateAndMinutes(dateStr, t.endMin)
    : null;

  return {
    title: t.title,
    description: t.description || null,
    isImportant: t.imp,
    remindBeforeStart: t.remindBeforeStart ?? false,
    scheduledDate: dateStr ? scheduledDateIso(dateStr) : null,
    when: isBacklog || !dateStr ? "Later" : "Now",
    status,
    color: t.color,
    startTime,
    endTime,
    completedAt: t.status === "done" ? (t.completedAt || new Date().toISOString()) : null,
  };
}

export function mergeBoard(board) {
  const map = new Map();
  [...(board.today ?? []), ...(board.backlog ?? []), ...(board.gantt ?? [])].forEach((t) => {
    map.set(t.id, fromApi(t));
  });
  return map;
}

export function isScheduledToday(t) {
  const todayStr = todayMytStr();
  return t.startMin != null && t.dateStr === todayStr;
}

export function splitBoard(map) {
  const todayStr = todayMytStr();
  const todayList = [];
  const backlogList = [];
  const ganttList = [];

  for (const t of map.values()) {
    const onGantt = isScheduledToday(t);
    if (onGantt) ganttList.push(t);

    if (t.isBacklog || (t.dateStr && t.dateStr > todayStr)) {
      backlogList.push(t);
    } else if (t.dateStr === todayStr || (!t.dateStr && !t.isBacklog)) {
      todayList.push(t);
    }
  }

  const sortFn = (a, b) => {
    const doneA = a.status === "done" ? 1 : 0;
    const doneB = b.status === "done" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    return Number(b.imp) - Number(a.imp);
  };

  return {
    today: todayList.sort(sortFn),
    backlog: backlogList.sort(sortFn),
    gantt: ganttList.sort(sortFn),
  };
}

export const fmtTime = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const isOnGantt = (t) => t.startMin != null && (t.status === "scheduled" || t.status === "done");
export const isMissed = (t, now) => t.status === "scheduled" && t.endMin !== null && t.endMin < now;

/** Blank task for the add popover */
export const NEW_TASK = { color: null, status: "inbox" };
