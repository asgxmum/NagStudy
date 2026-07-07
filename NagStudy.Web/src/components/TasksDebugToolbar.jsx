import { useState } from "react";
import { createPortal } from "react-dom";
import { useNag } from "../context/NagContext";

/**
 * Dev toolbar — Ctrl+Shift+` on Tasks page.
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
        <span className="sub">Ctrl+Shift+`</span>
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

export const DEBUG_HOTKEY_LABEL = "Ctrl+Shift+`";

export function isTasksDebugHotkey(e) {
  if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return false;
  if (e.code === "Backquote") return true;
  return e.key === "`" || e.key === "~";
}
