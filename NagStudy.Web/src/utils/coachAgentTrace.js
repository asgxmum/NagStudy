const TOOL_LABELS = {
  "Analytics-get_tasks": "Fetched tasks",
  "Analytics-get_summary_information": "Loaded stats",
  "Analytics-get_summary_report": "Generated report",
  "Analytics-get_relevant_information": "Searched insights",
  "Study-get_study_summary": "Loaded study snapshot",
};

export function toolDisplayName(toolName) {
  if (!toolName) return "Tool";
  return TOOL_LABELS[toolName] ?? toolName.replace(/^(Analytics|Study)-/, "").replace(/_/g, " ");
}

/** Parse persisted Tool message content from ToolInvocationRecorder.FormatRecord */
export function parseToolMessageContent(content) {
  if (!content?.trim()) return null;
  const match = content.match(/^\[([^\]]+)\](?:\nArgs:\s*(.*))?\n([\s\S]*)$/);
  if (!match) {
    return { toolName: "tool", arguments: null, result: content.trim() };
  }
  return {
    toolName: match[1].trim(),
    arguments: match[2]?.trim() || null,
    result: match[3]?.trim() || "",
  };
}

/** Build steps from API agentSteps and/or Tool role messages */
export function buildTraceSteps(agentSteps, toolMessages) {
  const steps = [];
  if (agentSteps?.length) {
    for (const s of agentSteps) {
      if (s.type === "thinking" && s.content) {
        steps.push({ type: "thinking", content: s.content });
      } else if (s.type === "tool") {
        steps.push({
          type: "tool",
          toolName: s.toolName,
          label: toolDisplayName(s.toolName),
          arguments: s.arguments,
          result: s.resultPreview || "",
        });
      }
    }
    if (steps.length) return steps;
  }

  for (const msg of toolMessages ?? []) {
    const parsed = parseToolMessageContent(msg.content);
    if (!parsed) continue;
    steps.push({
      type: "tool",
      toolName: parsed.toolName,
      label: toolDisplayName(parsed.toolName),
      arguments: parsed.arguments,
      result: parsed.result,
    });
  }
  return steps;
}

/** Group chat messages for timeline rendering */
export function groupCoachTimeline(messages) {
  const items = [];
  let pendingTools = [];
  let pendingSteps = null;

  for (const msg of messages) {
    if (msg.role === "Tool") {
      pendingTools.push(msg);
      continue;
    }
    if (msg.role === "Assistant") {
      if (pendingTools.length || msg.agentSteps?.length) {
        items.push({
          type: "trace",
          key: `trace-${msg.id}`,
          steps: buildTraceSteps(msg.agentSteps, pendingTools),
        });
        pendingTools = [];
      }
      items.push({ type: "assistant", key: `a-${msg.id}`, msg });
      continue;
    }
    if (msg.role === "User") {
      if (pendingTools.length) {
        items.push({
          type: "trace",
          key: `trace-orphan-${msg.id}`,
          steps: buildTraceSteps(null, pendingTools),
        });
        pendingTools = [];
      }
      items.push({ type: "user", key: `u-${msg.id}`, msg });
    }
  }

  if (pendingTools.length) {
    items.push({
      type: "trace",
      key: "trace-tail",
      steps: buildTraceSteps(pendingSteps, pendingTools),
    });
  }
  return items;
}
