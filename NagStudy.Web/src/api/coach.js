import api from "./client";

export const listProfiles = () => api.get("/coach/profiles");

export const listSessions = () => api.get("/coach/sessions");
export const createSession = (profileId) => api.post("/coach/sessions", { profileId });
export const deleteSession = (sessionId) => api.delete(`/coach/sessions/${sessionId}`);
export const updateSessionTitle = (sessionId, title) =>
  api.patch(`/coach/sessions/${sessionId}`, { title });
export const getMessages = (sessionId) => api.get(`/coach/sessions/${sessionId}/messages`);
export const sendChat = (sessionId, message) => api.post(`/coach/sessions/${sessionId}/chat`, { message });
export const generateReport = (sessionId, body) => api.post(`/coach/sessions/${sessionId}/report`, body);

export const triggerNag = (trigger, options = {}) =>
  api.post("/coach/trigger", {
    trigger,
    force: options.force ?? false,
    taskId: options.taskId ?? undefined,
    debugNowMinutes: options.debugNowMinutes ?? undefined,
    naggingContext: options.naggingContext ?? undefined,
  });
export const listNags = () => api.get("/coach/nags");

export const updateNagProfile = (profileId) => api.put("/users/me/nag-profile", { profileId });
export const updateAiNotifications = (enabled) => api.put("/users/me/ai-notifications", { enabled });
