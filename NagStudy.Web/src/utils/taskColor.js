// Theme-aligned task colours (Tasks · Gantt · Pomodoro). Stable per-id fallback when unset.
export const TASK_COLORS = [
  "#E8734A", // coral — primary
  "#1B2150", // navy
  "#5BA06E", // green
  "#E2A33B", // amber
  "#6E89BE", // sky
  "#D98C97", // rose
  "#3FA7A2", // teal
];

export const taskColor = (id) =>
  TASK_COLORS[((id % TASK_COLORS.length) + TASK_COLORS.length) % TASK_COLORS.length];

export const isPresetTaskColor = (color) =>
  !!color && TASK_COLORS.some((c) => c.toLowerCase() === color.toLowerCase());
