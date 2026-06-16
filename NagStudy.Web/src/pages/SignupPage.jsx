import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";


// Standalone full-screen page (NOT inside AppLayout) — ported from NagStudy.html #screen-signup.
// W4 controlled form → live XMU email check → W6 register API.
const XMU_DOMAIN = "@xmu.edu.my";
const isXmu = (email) => email.toLowerCase().trim().endsWith(XMU_DOMAIN);

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  // Live email-domain feedback (mirrors prototype onSignupEmail()).
  // Live per-field validation (reacts from the first keystroke).
  // Requires a real local part + exactly @xmu.edu.my (stricter than endsWith).
  const emailOk = /^[^@\s]+@xmu\.edu\.my$/i.test(email.trim());
  const nickOk = nickname.trim().length >= 2;
  const pwOk = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password);
  const matchOk = confirm.length > 0 && confirm === password;

  async function handleSubmit(e) {
    e.preventDefault();

    if (!nickname.trim() || !email.trim() || !password || !confirm) {
      setError("Please fill in every field.");
      return;
    }
    if (!isXmu(email)) {
      setError("Use your XMU email (@xmu.edu.my).");
      return;
    }
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password)) {
      setError("Password needs 8+ chars with an uppercase letter, a number, and a special character.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setError("");
    try {
      const data = await register({ email, password, nickname });
      login(data.token, { email: data.email, nickname: data.nickname, role: data.role, aiTone: data.aiTone });
      navigate(data.role === "Admin" ? "/admin" : "/app");
    } catch (err) {
      setError(err.response?.data?.message ?? "Sign up failed. Try again.");
    }
  }


  return (
    <div className="screen lp active" id="screen-signup">
      <div className="auth-wrap">
        <form className="auth-card" onSubmit={handleSubmit} autoComplete="off">
          <Link to="/" className="auth-home" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <img src="/NagStudy-Logo.svg" alt="NagStudy" style={{ height: 26, width: "auto", display: "block" }} />
            <span><span className="nag">Nag</span>Study</span>
          </Link>
          <img src="/NagStudy-Logo.svg" alt="NagStudy" style={{ width: 72, height: 72, objectFit: "contain", display: "block", margin: "14px auto 16px" }} />
          <h1 className="auth-h">Join NagStudy</h1>
          <p className="auth-sub">Use your university email — we'll sort your school automatically.</p>
          <div className="auth-field">
            <label htmlFor="signup-nickname">Nickname <span className="auth-mini">(shown on the ranking)</span></label>
            <input
              id="signup-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="e.g. Snoozebun"
              autoComplete="off"
            />
            <div className={`auth-domain${nickname ? (nickOk ? " ok" : " bad") : ""}`}>
              {nickname ? (nickOk ? "✓ Looks good" : "At least 2 characters") : ""}
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="signup-email">University email</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@xmu.edu.my"
              autoComplete="off"
            />
            <div className={`auth-domain${email ? (emailOk ? " ok" : " bad") : ""}`} id="suDomain">
              {email
                ? emailOk
                  ? "XMU Malaysia — verified"
                  : "Must be your XMU email(ends with @xmu.edu.my)"
                : ""}
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <PasswordInput
              id="signup-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <div className={`auth-domain${password ? (pwOk ? " ok" : " bad") : ""}`}>
              {password ? (pwOk ? "Strong password" : "Use at least 8 characters with a capital letter, a number, and a symbol.") : ""}
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="signup-confirm">Confirm password</label>
            <PasswordInput
              id="signup-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
            <div className={`auth-domain${confirm ? (matchOk ? " ok" : " bad") : ""}`}>
              {confirm ? (matchOk ? "Passwords match" : "Passwords don't match yet") : ""}
            </div>
          </div>
          <button type="submit" className="btn btn-coral auth-btn">Create account</button>
          <div className="auth-err" id="suErr">{error}</div>
          <div className="auth-alt">
            Already have an account? <Link to="/login" className="auth-link">Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
