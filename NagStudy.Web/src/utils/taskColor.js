// Shared task colour palette so Tasks · Gantt and Pomodoro show the SAME colour for the same
// task. Used as a stable per-id fallback when the user hasn't picked an explicit colour yet.
export const TASK_COLORS = ["#E8734A", "#2C3E63", "#6FA07A", "#BE9E54", "#6E89BE", "#D98C97"];

export const taskColor = (id) =>
  TASK_COLORS[((id % TASK_COLORS.length) + TASK_COLORS.length) % TASK_COLORS.length];
