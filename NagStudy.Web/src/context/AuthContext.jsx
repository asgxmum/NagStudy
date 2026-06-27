import { createContext, useContext, useState } from "react";
import { getToken, getUserRaw, setAuth, setUser as persistUser, clearAuth } from "../auth/storage";

const dayBriefSessionKey = (userId) => `nagstudy:daybrief:${userId}`;

// Holds the JWT + user; persistence (localStorage vs sessionStorage) is decided by "Remember me"
// and centralised in auth/storage.js so the axios client reads the token from the same place.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(() => {
    const raw = getUserRaw();
    return raw ? JSON.parse(raw) : null;
  });

  // remember = true → localStorage (persist across browser close); false → sessionStorage.
  function login(jwt, userInfo, remember = true) {
    setAuth(jwt, userInfo, remember);
    setToken(jwt);
    setUser(userInfo);
  }

  function logout() {
    const raw = getUserRaw();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.id) sessionStorage.removeItem(dayBriefSessionKey(parsed.id));
      } catch { /* ignore */ }
    }
    clearAuth();
    setToken(null);
    setUser(null);
  }

  // Merge a partial update into the stored user (e.g. after a nickname change in Settings).
  function updateUser(patch) {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      persistUser(next);
      return next;
    });
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
