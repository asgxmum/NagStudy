import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { personas } from "../data/mock";
import BlinkFace from "./BlinkFace";

// App shell using the prototype's exact markup/classes (.screen.ap > .app > .sidebar + main),
// styled by the reused prototype.css. Logic (routing, logout) unchanged.

// AI coach persona shown on the user card, derived from the account's AiTone (Soft/Normal/Harsh).
const TONE_PERSONA = {
  Soft: "The Healer",
  Normal: "The Secretary",
  Harsh: "The Elite",
};

const NAV = [
  { to: "/app", label: "Dashboard", ico: "🏠", end: true },
  { to: "/app/tasks", label: "Tasks · Gantt", ico: "📝" },
  { to: "/app/pomodoro", label: "Pomodoro", ico: "⏰" },
  { to: "/app/coach", label: "AI Coach", ico: "💬" },
  { to: "/app/ranking", label: "Ranking", ico: "🏆" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Tint the persona chip with the active coach's colour (Soft=green / Normal=navy / Harsh=gold),
  // sharing personas[] as the single source so the sidebar matches the Coach page exactly.
  const persona = personas.find((p) => p.key === user?.aiTone) ?? personas[1]; // default: The Secretary
  const toneStyle = {
    background: `${persona.color}22`,
    color: persona.color,
    borderColor: `${persona.color}55`,
  };
  // Avatar circle tinted in the coach's pastel (matches the Dashboard bunny frame + landing cards).
  const avatarStyle = {
    background: persona.tint,
    boxShadow: `0 0 0 2px var(--card), 0 0 0 3.5px ${persona.color}59`,
  };

  function handleLogout() {
    logout();
    navigate("/"); // back to the public landing (it shows the logged-out nav)
  }

  return (
    <div className="screen ap active">
      <div className="app">
        <aside className="sidebar">
          <Link to="/" className="logo" title="Back to home" style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/NagStudy-Logo.svg" alt="" style={{ height: 30, width: "auto", display: "block", flexShrink: 0 }} />
              <h1><span className="nag">Nag</span>Study</h1>
            </div>
            <p>AI study nag + school ranking 🐰</p>
          </Link>

          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => "nav-btn" + (isActive ? " active" : "")}
            >
              <span className="ico">{n.ico}</span>
              {n.label}
            </NavLink>
          ))}

          <div className="spacer" />

          <Link to="/app/settings" className="user-card" style={{ cursor: "pointer" }} title="My Page · Settings">
            <div className="who">
              <div className="avatar" style={avatarStyle}>
                <BlinkFace src={persona.profile} blink={persona.blink} alt={persona.name} style={{ width: "82%", height: "82%", objectFit: "contain", display: "block" }} />
              </div>
              <div>
                <div className="nick">{user?.nickname ?? "Student"}</div>
                <div className="school">🏫 XMU Malaysia</div>
              </div>
            </div>
            <span
              className="tone-chip"
              id="sideTone"
              role="button"
              title="Adjust your AI coach mode"
              style={{ cursor: "pointer", ...toneStyle }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate("/app/coach"); }}
            >
              {TONE_PERSONA[user?.aiTone] ?? "📋 The Secretary"}
            </span>
          </Link>

          <button onClick={handleLogout} type="button" className="logout-btn">
            ↩ Log out
          </button>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
      <div id="toast-root" />
    </div>
  );
}
