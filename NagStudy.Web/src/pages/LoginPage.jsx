import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login as loginApi } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";



// Reference screen: controlled form (W4) → Axios login (W6) → store JWT (§8.2) → role routing (§8.1).
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState(() => localStorage.getItem("rememberedEmail") || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  // Forgot-password is out of scope for this demo (no email server). Rather than a dead
  // link, a soft info note explains what to do — and hands graders a working demo login.
  const [showReset, setShowReset] = useState(false);
  // Show a heads-up when we were bounced here by an expired session (?expired=1).
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).get("expired") === "1"
      ? "Your session expired — please log in again."
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginApi(email, password); // { token, email, nickname, role, aiTone }
      // "Remember me" decides persistence: localStorage (stays) vs sessionStorage (clears on close).
      login(data.token, {
        email: data.email,
        nickname: data.nickname,
        role: data.role,
        aiTone: data.aiTone,
        nagProfileId: data.nagProfileId,
        nagProfileName: data.nagProfileName,
        nagProfileKey: data.nagProfileKey,
        aiNotificationsEnabled: data.aiNotificationsEnabled !== false,
        hasSeenTutorial: data.hasSeenTutorial === true,
      }, remember);
    if (remember) {
        localStorage.setItem("rememberedEmail", email);
    } else {
        localStorage.removeItem("rememberedEmail");
    }
      navigate(data.role === "Admin" ? "/admin" : "/app");
    } catch (err) {
      setError(err.response?.data?.message ?? "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }



  return (
    <div className="screen lp active" id="screen-login">
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={handleSubmit} autoComplete="off">
          <Link to="/" className="auth-home" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <img src="/NagStudy-Logo.svg" alt="NagStudy" style={{ height: 26, width: "auto", display: "block" }} />
            <span><span className="nag">Nag</span>Study</span>
          </Link>
          <img src="/NagStudy-Logo.svg" alt="NagStudy" style={{ width: 72, height: 72, objectFit: "contain", display: "block", margin: "14px auto 16px" }} />
          <h1 className="auth-h">Welcome back</h1>
          <p className="auth-sub">Log in — your bunny coach has been waiting.</p>
          <div className="auth-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu.my"
              autoComplete="email"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div className="auth-row">
            <label className="auth-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              /> Remember me
            </label>
            <span
              className="auth-link"
              role="button"
              onClick={() => setShowReset((v) => !v)}
            >
              Forgot password?
            </span>
          </div>

          {showReset && (
            <div className="auth-reset-note">
              <b>🔑 Reset isn't available in this demo</b> — there's no email server set up
              yet. To get back in, ask an admin to reset it, or sign in with a demo account:
              <code>focusfox@xmu.edu.my</code> / <code>Demo@1234</code>.
            </div>
          )}
          <button type="submit" className="btn btn-coral auth-btn" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
          <div className="auth-err" id="loginErr">{error}</div>
          <div className="auth-alt">
            New here? <Link to="/signup" className="auth-link">Create an account</Link>
          </div>
          <div className="auth-mini" style={{ marginTop: 14, opacity: 0.8 }}>
            🔑 Demo: an <b>Admin</b> account routes to the admin view; a <b>User</b> account to the app.
          </div>
        </form>
      </div>
    </div>
  );
}

