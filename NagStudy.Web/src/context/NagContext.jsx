import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../api/client";
import { triggerNag } from "../api/coach";
import { useAuth } from "./AuthContext";
import { personas } from "../data/mock";
import { fromApi, toApi, todayMytStr, isScheduledToday, nowMinutesMyt } from "../utils/taskMapper";
import NagBubble from "../components/NagBubble";

const NagContext = createContext(null);

const dayBriefSessionKey = (userId) => `nagstudy:daybrief:${userId}`;

/** Minutes-of-day for comparing with Gantt task blocks (same clock as Tasks page). */
function effectiveNowMin(debugNowRef) {
  const d = debugNowRef.current;
  if (d.enabled && d.min != null) return d.min;
  return nowMinutesMyt();
}

const emptyFocusSnapshot = () => ({
  isFocusing: false,
  focusTaskId: null,
  focusTaskTitle: null,
  focusCategory: null,
  focusElapsedMinutes: 0,
});

/** Random delay 5–20 minutes (ms). */
function nextNaggingDelayMs() {
  return (5 + Math.random() * 15) * 60 * 1000;
}

export function NagProvider({ children }) {
  const { user } = useAuth();
  const [activeNag, setActiveNag] = useState(null);
  const [busy, setBusy] = useState(false);
  const bootedRef = useRef(false);
  const showingRef = useRef(false);
  const debugNowRef = useRef({ enabled: false, min: null });
  const focusSnapshotRef = useRef(emptyFocusSnapshot());
  const taskUpdateListenersRef = useRef(new Set());

  const toneKey = user?.nagProfileKey ?? user?.aiTone ?? "Normal";
  const persona = personas.find((p) => p.key === toneKey) ?? personas[1];

  const showFromResponse = useCallback((trigger, data) => {
    if (!data?.shouldShow || !data?.message) return false;
    showingRef.current = true;
    setActiveNag({
      trigger,
      message: data.message,
      nagId: data.nagId,
      taskId: data.taskId,
      taskTitle: data.taskTitle,
      showTaskActions: data.showTaskActions ?? false,
    });
    return true;
  }, []);

  const buildTriggerPayload = useCallback((trigger, options = {}) => {
    const debug = debugNowRef.current;
    const payload = {
      force: options.force ?? false,
      taskId: options.taskId ?? undefined,
      debugNowMinutes: options.debugNowMinutes
        ?? (debug.enabled && debug.min != null ? debug.min : undefined),
    };
    if (trigger === "Nagging") {
      payload.naggingContext = options.naggingContext ?? focusSnapshotRef.current;
    }
    return payload;
  }, []);

  const fireTrigger = useCallback(async (trigger, options = {}) => {
    if (showingRef.current && !options.forceShow && trigger !== "Manual") return null;
    if (showingRef.current && (trigger === "Manual" || options.forceShow)) {
      showingRef.current = false;
      setActiveNag(null);
    }
    // User-initiated nags (e.g. "Nag me") hit the LLM and take a few seconds —
    // show a loading bubble immediately so the tap feels responsive.
    const userInitiated = trigger === "Manual" || options.forceShow;
    if (userInitiated) {
      showingRef.current = true;
      setActiveNag({ trigger, loading: true });
    }
    try {
      const res = await triggerNag(trigger, buildTriggerPayload(trigger, options));
      const shown = showFromResponse(trigger, res.data);
      if (!shown && userInitiated) { setActiveNag(null); showingRef.current = false; }
      return res.data;
    } catch {
      if (userInitiated) { setActiveNag(null); showingRef.current = false; }
      return null;
    }
  }, [showFromResponse, buildTriggerPayload]);

  const dismissNag = useCallback(() => {
    setActiveNag(null);
    showingRef.current = false;
  }, []);

  const emitTaskUpdated = useCallback((apiTask) => {
    taskUpdateListenersRef.current.forEach((fn) => fn(apiTask));
  }, []);

  const onTaskUpdated = useCallback((listener) => {
    taskUpdateListenersRef.current.add(listener);
    return () => taskUpdateListenersRef.current.delete(listener);
  }, []);

  const setFocusSnapshot = useCallback((snapshot) => {
    focusSnapshotRef.current = snapshot ? { ...emptyFocusSnapshot(), ...snapshot } : emptyFocusSnapshot();
  }, []);

  const handleTaskDone = useCallback(async (done) => {
    if (!activeNag?.taskId) {
      dismissNag();
      return;
    }
    setBusy(true);
    try {
      if (done) {
        const res = await api.get(`/tasks/${activeNag.taskId}`);
        const t = fromApi(res.data);
        const putRes = await api.put(`/tasks/${activeNag.taskId}`, toApi({ ...t, status: "done" }));
        emitTaskUpdated(putRes.data);
      }
    } catch { /* ignore */ }
    finally {
      setBusy(false);
      dismissNag();
    }
  }, [activeNag, dismissNag, emitTaskUpdated]);

  /** Sync debug now-line from Tasks · Gantt (Ctrl+Shift+`). */
  const setDebugNow = useCallback((enabled, min) => {
    debugNowRef.current = { enabled: !!enabled, min: min ?? null };
  }, []);

  const checkTaskNudges = useCallback(async (nowOverride) => {
    if (showingRef.current) return;
    const nowMin = nowOverride ?? effectiveNowMin(debugNowRef);
    const todayStr = todayMytStr();

    try {
      const res = await api.get("/tasks/board");
      const seen = new Set();
      const all = [...(res.data.today ?? []), ...(res.data.backlog ?? []), ...(res.data.gantt ?? [])]
        .map(fromApi)
        .filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });

      for (const t of all) {
        if (t.status === "done" || t.dateStr !== todayStr) continue;
        if (t.status !== "scheduled" && t.startMin == null) continue;

        if (isScheduledToday(t) && t.endMin != null && t.endMin <= nowMin) {
          await fireTrigger("TaskEnded", { taskId: t.id });
          return;
        }

        if (t.startMin != null && isScheduledToday(t)) {
          const until = t.startMin - nowMin;
          if (until <= 2 && until >= -2) {
            await fireTrigger("TaskStarting", { taskId: t.id });
            return;
          }
        }
      }
    } catch { /* ignore */ }
  }, [fireTrigger]);

  // Boot: DayBrief once per browser session (F5 keeps sessionStorage → no re-show; logout clears key)
  useEffect(() => {
    if (!user?.id || bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      if (user.aiNotificationsEnabled !== false) {
        const key = dayBriefSessionKey(user.id);
        if (!sessionStorage.getItem(key)) {
          const data = await fireTrigger("DayBrief");
          if (data?.shouldShow) sessionStorage.setItem(key, String(Date.now()));
        }
      }
      if (!showingRef.current) await checkTaskNudges();
    })();
  }, [user?.id, user?.aiNotificationsEnabled, fireTrigger, checkTaskNudges]);

  // Poll task start/end nudges (uses debug now-line when enabled on Tasks page)
  useEffect(() => {
    if (!user?.id || user?.aiNotificationsEnabled === false) return undefined;

    checkTaskNudges();
    const id = setInterval(() => checkTaskNudges(), 10000);
    return () => clearInterval(id);
  }, [user?.id, user?.aiNotificationsEnabled, checkTaskNudges]);

  // Nagging: random interval 5–20 min between check-ins
  useEffect(() => {
    if (!user?.id || user?.aiNotificationsEnabled === false) return undefined;

    let cancelled = false;
    let timeoutId;

    function scheduleNext() {
      timeoutId = setTimeout(async () => {
        if (cancelled) return;
        if (!showingRef.current) await fireTrigger("Nagging");
        if (!cancelled) scheduleNext();
      }, nextNaggingDelayMs());
    }

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user?.id, user?.aiNotificationsEnabled, fireTrigger]);

  return (
    <NagContext.Provider value={{
      fireTrigger, dismissNag, activeNag, checkTaskNudges, setDebugNow, onTaskUpdated, setFocusSnapshot,
    }}>
      {children}
      <NagBubble
        nag={activeNag}
        persona={persona}
        onDismiss={dismissNag}
        onTaskDone={handleTaskDone}
        busy={busy}
      />
    </NagContext.Provider>
  );
}

export function useNag() {
  const ctx = useContext(NagContext);
  if (!ctx) throw new Error("useNag must be used within NagProvider");
  return ctx;
}
