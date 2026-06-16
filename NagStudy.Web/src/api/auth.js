import api from "./client";

// POST /api/auth/login → { token, email, nickname, role, aiTone }
export async function login(email, password) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

// POST /api/auth/register → { token, email, nickname, role, aiTone }
export async function register(payload) {
  const res = await api.post("/auth/register", payload);
  return res.data;
}

