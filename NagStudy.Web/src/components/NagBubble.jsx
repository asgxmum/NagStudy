import { createPortal } from "react-dom";
import CoachMessageBody from "./CoachMessageBody";
import BlinkFace from "./BlinkFace";

const TRIGGER_LABELS = {
  DayBrief: "Daily briefing",
  Manual: "Coach nag",
  Nagging: "Check-in",
  TaskStarting: "Starting soon",
  TaskEnded: "Task check-in",
  MissedTask: "Missed task",
  TaskPileup: "Inbox alert",
};

/**
 * Top-right premium frosted-glass coach nag.
 * @param {{ nag: object, persona: object, onDismiss: () => void, onTaskDone?: (done: boolean) => void, busy?: boolean }} props
 */
export default function NagBubble({ nag, persona, onDismiss, onTaskDone, busy }) {
  if (!nag) return null;

  const label = nag.loading ? "Writing…" : (TRIGGER_LABELS[nag.trigger] ?? nag.trigger);
  const accent = persona.color ?? "#2C3E63";

  return createPortal(
    <div className="nag-live-panel" role="dialog" aria-label={label} style={{ "--nag-accent": accent }}>
      <div className="nag-live-glass">
        <div className="nag-live-shine" aria-hidden />
        <header className="nag-live-meta">
          <div className="nag-live-av" style={{ background: persona.tint, boxShadow: `0 0 0 2px rgba(255,255,255,0.25), 0 0 12px ${accent}55` }}>
            <BlinkFace
              src={persona.profile}
              blink={persona.blink}
              alt={persona.name}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          </div>
          <div className="nag-live-meta-text">
            <span className="nag-live-from">{persona.name}</span>
            <span className="nag-live-tag">{label}</span>
          </div>
          <button type="button" className="nag-live-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
        </header>
        <div className="nag-live-content">
          {nag.loading ? (
            <p style={{ margin: 0, fontStyle: "italic", opacity: 0.85 }}>
              {persona.name} is writing your nag… <span className="nag-live-dots">●●●</span>
            </p>
          ) : (
            <CoachMessageBody content={nag.message} />
          )}
        </div>
        {!nag.loading && nag.showTaskActions && (
          <footer className="nag-live-actions">
            <button type="button" className="nag-live-btn nag-live-btn--done" disabled={busy} onClick={() => onTaskDone?.(true)}>
              Done
            </button>
            <button type="button" className="nag-live-btn nag-live-btn--later" disabled={busy} onClick={() => onTaskDone?.(false)}>
              Not yet
            </button>
          </footer>
        )}
      </div>
      <span className="nag-live-tail" aria-hidden />
    </div>,
    document.body
  );
}
