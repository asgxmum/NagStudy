import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNag } from "../context/NagContext";
import { personas } from "../data/mock";
import BlinkFace from "../components/BlinkFace";

function headlineFor(mins) {
  if (mins === 0) return { title: "Fresh slate today", sub: "Nothing logged yet — your AI coach is standing by." };
  if (mins < 60) return { title: "Dashboard", sub: "First focus is in. Keep the momentum going." };
  if (mins < 120) return { title: "Nice momentum today 👏", sub: "You're building a solid streak — keep it rolling." };
  return { title: "You're on fire today 🔥", sub: "Strong focus logged. Impressive — don't let it cool off." };
}

function ChartEmpty({ icon, title, subtitle }) {
  return (
    <div className="chart-empty">
      <div className="ce-emoji">{icon}</div>
      <div className="ce-title">{title}</div>
      <div className="ce-sub">{subtitle}</div>
      <div className="ce-cta">
        <Link to="/app/pomodoro" className="btn btn-primary btn-sm">⏰ Start focusing</Link>
        <Link to="/app/tasks" className="btn btn-ghost btn-sm">📝 Plan a task</Link>
      </div>
    </div>
  );
}

const fmtDur = (min) => {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
};
const dayLabel = (iso) => new Date(iso).toLocaleDateString("en", { weekday: "short" });

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "none",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(27,33,80,0.14)",
  padding: "8px 12px",
};
const TOOLTIP_ITEM = { color: "#2C3E63", fontSize: 12.5, fontWeight: 700 };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const { fireTrigger } = useNag();
  const [doneMissed, setDoneMissed] = useState({ done: 0, missed: 0 });
  const [rank, setRank] = useState(null);

  useEffect(() => {
    api.get("/dashboard")
      .then((res) => setData(res.data))
      .catch(() => setError("Couldn't load your dashboard."));

    api.get("/tasks").then((res) => {
      const now = new Date();
      const asUtc = (iso) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
      const done = res.data.filter((t) => t.status === "Done").length;
      const missed = res.data.filter((t) => t.status === "Scheduled" && t.endTime && asUtc(t.endTime) < now).length;
      setDoneMissed({ done, missed });
    }).catch(() => { });

    api.get("/ranking").then((res) => {
      const me = res.data.find((r) => r.isMe);
      setRank(me ? me.rank : null);
    }).catch(() => { });
  }, []);

  const weekly = useMemo(
    () => (data?.byDay ?? []).map((d) => ({ day: dayLabel(d.date), min: Math.round(d.seconds / 60) })),
    [data]
  );
  const categoryMix = useMemo(
    () => (data?.byCategory ?? []).map((c) => ({ name: c.name, value: Math.round(c.seconds / 60), color: c.color })),
    [data]
  );

  if (error) return <p style={{ color: "#E8734A", fontWeight: 700 }}>{error}</p>;
  if (!data) return <p>Loading…</p>;

  const todayMin = Math.round(data.todaySeconds / 60);
  const weekTotal = Math.round(data.weekSeconds / 60);
  const mixTotal = categoryMix.reduce((a, c) => a + c.value, 0);
  const mixCenter = `${Math.floor(mixTotal / 60)}h\n${mixTotal % 60}m`;

  const toneKey = user?.nagProfileKey ?? user?.aiTone ?? "Normal";
  const persona = personas.find((p) => p.key === toneKey) ?? personas[1];
  const personaShort = persona.name.replace(/^The\s+/i, "");
  const frameStyle = {
    background: persona.tint,
    boxShadow: `0 0 0 3px var(--card), 0 0 0 5px ${persona.color}59, 0 6px 18px ${persona.color}33`,
  };
  const head = headlineFor(todayMin);
  const welcomeMsg = todayMin === 0
    ? "Ready when you are — tap Nag me for a fresh push from your coach."
    : `You've logged ${fmtDur(todayMin)} today. Tap Nag me anytime for a nudge.`;

  function handleNag() {
    fireTrigger("Manual");
  }

  return (
    <section className="view active" id="view-dashboard">
      <div className="view-head">
        <h2>{head.title}</h2>
        <p>{head.sub}</p>
      </div>

      <div className="hero">
        <div className="hero-frame" id="heroFrame" style={frameStyle}>
          <BlinkFace src={persona.profile} blink={persona.blink} alt={persona.name} style={{ width: "80%", height: "80%", objectFit: "contain", display: "block" }} />
          <span className="mode-badge focus" style={{ background: persona.color }}>{persona.face} {personaShort}</span>
        </div>
        <div className="msg">
          <div className="from" style={{ color: persona.color }}>{persona.name}</div>
          <div className="text">{welcomeMsg}</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleNag}>💬 Nag me</button>
      </div>

      <div className="grid-stats">
        <div className="stat">
          <div className="lbl">⏱️ Focus today</div>
          <div className="val">{fmtDur(todayMin)}</div>
          <div className="delta flat">measured focus</div>
        </div>
        <div className="stat">
          <div className="lbl">📅 This week</div>
          <div className="val">{fmtDur(weekTotal)}</div>
          <div className="delta flat">resets Mon 00:00 (MYT)</div>
        </div>
        <div className="stat">
          <div className="lbl">✅ Done / 😱 Missed</div>
          <div className="val">{doneMissed.done} / {doneMissed.missed}</div>
          <div className={`delta ${doneMissed.missed > 0 ? "down" : "flat"}`}>
            {doneMissed.missed > 0 ? "tackle the missed ones first" : "no misses — nice"}
          </div>
        </div>
        <div className="stat">
          <div className="lbl">🏆 School rank</div>
          <div className="val">{rank ? `#${rank}` : "—"}</div>
          <div className="delta flat">{rank ? "this week by focus minutes" : "study to get ranked"}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>📊 This week&apos;s focus <span className="sub">minutes per day</span></h3>
          <div className="chart" style={{ height: 200, display: "block", padding: 0 }}>
            {weekTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly} margin={{ top: 16, right: 4, bottom: 0, left: -16 }}>
                  <XAxis dataKey="day" tick={{ fill: "#9AA0B0", fontSize: 11.5, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9AA0B0", fontSize: 11.5 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip cursor={{ fill: "rgba(232,115,74,0.08)" }} contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} formatter={(value) => [fmtDur(value), "Focus"]} />
                  <Bar dataKey="min" fill="#E8734A" radius={[9, 9, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty
                icon="📈"
                title="No focus logged this week yet"
                subtitle="Run a Pomodoro and your daily minutes show up here."
              />
            )}
          </div>
        </div>

        <div className="card">
          <h3>🎨 Category mix <span className="sub">this week</span></h3>
          {mixTotal > 0 ? (
            <div className="donut-wrap">
              <div className="donut" style={{ background: "none", display: "grid", placeItems: "center" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                      {categoryMix.map((c) => (<Cell key={c.name} fill={c.color} />))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-disp)", fontSize: 14, fontWeight: 600, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.35, pointerEvents: "none" }}>
                  {mixCenter}
                </div>
              </div>
              <div className="legend">
                {categoryMix.map((c) => (
                  <div className="li" key={c.name}>
                    <span className="dot" style={{ background: c.color }} />
                    <span className="nm">{c.name}</span>
                    <span className="tm">{fmtDur(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ChartEmpty
              icon="🎨"
              title="No study time logged yet"
              subtitle="Focus on a category and the mix appears here."
            />
          )}
        </div>
      </div>
    </section>
  );
}
