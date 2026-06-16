import axios from "axios";
import { getToken, clearAuth } from "../auth/storage";

// One configured Axios instance for the whole app (W6 pattern + §8.2 upgrade).
// Point baseURL at the ASP.NET Core API port that `dotnet watch` prints.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5178/api",
});

// §8.2 extension: attach the JWT to every request automatically.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Session-expiry handling: the JWT lives 2h (appsettings ExpiresInMinutes).
// When it expires, the API answers 401 — instead of failing silently, clear the
// stored session and bounce to the login page so the user knows to sign in again.
// (Login/Register 401s are credential errors handled by those pages, so skip them.)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || "";
    const isAuthCall = url.includes("/auth/login") || url.includes("/auth/register");
    if (status === 401 && !isAuthCall && getToken()) {
      clearAuth();
      // Full redirect (interceptor runs outside React Router) — resets app state cleanly.
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
