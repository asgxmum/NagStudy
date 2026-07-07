import { useState } from "react";
import { createPortal } from "react-dom";
import { useNag } from "../context/NagContext";

/**
 * Dev toolbar — F9 on Tasks page.
 * @param {{ open: boolean, onClose: () => void, dragNowLine: boolean, onDragNowLineChange: (v: boolean) => void }} props
 */
export default function TasksDebugToolbar({ open, onClose, dragNowLine, onDragNowLineChange }) {
  const { fireTrigger } = useNag();
  const [busy, setBusy] = useState(false);

  async function fireDayBrief() {
    setBusy(true);
    try {
      await fireTrigger("DayBrief", { force: true, forceShow: true });
    } finally {
      setBusy(false);
    }
  }

  async function fireNagging() {
    setBusy(true);
    try {
      await fireTrigger("Nagging", { force: true, forceShow: true });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="tasks-debug-bar" role="dialog" aria-label="Tasks debug toolbar">
      <div className="tasks-debug-head">
        <strong>Tasks debug</strong>
        <span className="sub">F9</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <label className="tasks-debug-row">
        <input
          type="checkbox"
          checked={dragNowLine}
          onChange={(e) => onDragNowLineChange(e.target.checked)}
        />
        Drag current-time line (overrides live clock on this page)
      </label>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={fireDayBrief}>
        {busy ? "Triggering…" : "Trigger DayBrief"}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={fireNagging}>
        {busy ? "Triggering…" : "Trigger Nagging"}
      </button>
    </div>,
    document.body
  );
}

/** Primary hotkey — avoids Ctrl+Shift (IME switch on Chinese Windows). */
export const DEBUG_HOTKEY_LABEL = "Ctrl+Alt+D";

export function isTasksDebugHotkey(e) {
  if (e.metaKey) return false;
  // Primary: Ctrl+Alt+D (does not conflict with input-method switch)
  if (e.ctrlKey && e.altKey && !e.shiftKey) {
    if (e.code === "KeyD" || e.key === "d" || e.key === "D") return true;
  }
  // Demo fallback when modifiers are captured by OS / recorder
  if (!e.ctrlKey && !e.altKey && !e.shiftKey && e.code === "F9") return true;
  return false;
}
