import { useState } from "react";

function StepRow({ step, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const isThinking = step.type === "thinking";
  const label = isThinking ? "Thinking" : step.label || step.toolName || "Tool";
  const icon = isThinking ? "🧠" : "🔧";

  return (
    <div className={`coach-trace-step${open ? " open" : ""}`}>
      <button type="button" className="coach-trace-step-head" onClick={() => setOpen((v) => !v)}>
        <span className="coach-trace-step-icon">{icon}</span>
        <span className="coach-trace-step-label">{label}</span>
        {!isThinking && step.arguments && (
          <span className="coach-trace-step-args">{step.arguments}</span>
        )}
        <span className="coach-trace-step-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="coach-trace-step-body">
          <pre>{isThinking ? step.content : step.result || "(empty)"}</pre>
        </div>
      )}
    </div>
  );
}

/** Gemini-style collapsible agent trace (thinking + tool calls). */
export default function CoachAgentTrace({ steps, loading = false, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded || loading);
  const count = steps?.length ?? 0;

  if (!loading && count === 0) return null;

  return (
    <div className={`coach-agent-trace${loading ? " loading" : ""}`}>
      <button
        type="button"
        className="coach-trace-toggle"
        onClick={() => !loading && setExpanded((v) => !v)}
        disabled={loading}
      >
        <span className="coach-trace-toggle-icon">{loading ? "⏳" : "✨"}</span>
        <span className="coach-trace-toggle-text">
          {loading ? "Agent is working…" : `Agent steps (${count})`}
        </span>
        {!loading && <span className="coach-trace-toggle-chevron">{expanded ? "▾" : "▸"}</span>}
      </button>
      {(expanded || loading) && (
        <div className="coach-trace-steps">
          {loading && count === 0 && (
            <div className="coach-trace-placeholder">
              <span className="coach-trace-pulse" />
              Calling tools…
            </div>
          )}
          {steps?.map((step, i) => (
            <StepRow key={`${step.type}-${i}`} step={step} defaultOpen={i === steps.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}
