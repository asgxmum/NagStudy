// Single source of truth for where the JWT + user are persisted.
// "Remember me" checked  → localStorage (survives closing the browser).
// "Remember me" unchecked → sessionStorage (cleared when the tab/browser closes).
// Both AuthContext and the axios client read/write through here so the two stay in sync.

const KEYS = ["token", "user"];

// Read from whichever storage currently holds the value (localStorage wins if both exist).
export function getToken() {
  return localStorage.getItem("token") ?? sessionStorage.getItem("token");
}

export function getUserRaw() {
  return localStorage.getItem("user") ?? sessionStorage.getItem("user");
}

// Persist a fresh login into the chosen storage, clearing the other so only one copy exists.
export function setAuth(token, user, remember) {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  store.setItem("token", token);
  store.setItem("user", JSON.stringify(user));
  KEYS.forEach((k) => other.removeItem(k));
}

// Update just the stored user, writing back to whichever storage currently holds it.
export function setUser(user) {
  const store = localStorage.getItem("user") != null ? localStorage : sessionStorage;
  store.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  KEYS.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}
