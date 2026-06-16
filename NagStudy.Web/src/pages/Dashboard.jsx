import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { personas } from "../data/mock";
import BlinkFace from "../components/BlinkFace";

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Data-aware page headline that reacts to today's focus (no more presumptuous "Slacking again?").
function headlineFor(mins) {
  if (mins === 0) return { title: "Fresh slate today", sub: "Nothing logged yet — your AI coach is standing by." };
  if (mins < 60) return { title: "Dashboard", sub: "First focus is in. Keep the momentum going." };
  if (mins < 120) return { title: "Nice momentum today 👏", sub: "You're building a solid streak — keep it rolling." };
  return { title: "You're on fire today 🔥", sub: "Strong focus logged. Impressive — don't let it cool off." };
}

// Persona-voiced nag lines, woven with today's real numbers (Soft/Normal/Harsh).
// TODO: replace with the live AI coach endpoint (SK+Gemini) — this is the local stand-in.
function nagLines(tone, mins, missed) {
  const m = fmtDur(mins);
  const miss = missed > 0 ? ` ${missed} missed.` : "";
  return ({
    Soft: [
      mins === 0
        ? "No focus yet — and that's perfectly okay 🌷 Shall we start one small session together?"
        : `You've focused ${m} today — wonderful! 🌷 One more gentle push?`,
      "You're doing your best, and that's enough 💗 Ready for the next little step?",
    ],
    Normal: [
      mins === 0
        ? "Status: 0 focus logged today. Recommend starting now."
        : `Today: ${m} focused.${miss} Proceed with the next item.`,
      `Report: ${m} on the clock.${miss} Clear the oldest task first.`,
    ],
    Harsh: [
      mins === 0
        ? "Zero focus so far. First place is already at the desk 👑 Begin."
        : `Only ${m}?${miss} First place won't wait for you 👑`,
      `Talk is cheap — ${m} won't grow itself. Next task, now 👑`,
    ],
  }[tone] || []);
}

// Friendly empty state for the chart cards — a brand-new account has no focus logged yet,
// so instead of a blank chart we nudge the user straight into the two actions that fill it.
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

// Dashboard — real stats from /api/dashboard (today & week totals, weekly bars, category donut).
// The API returns SECONDS → convert to minutes at the boundary so charts/labels stay simple.
const fmtDur = (min) => {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${min % 60}m` : `${min}m`;
};
const dayLabel = (iso) => new Date(iso).toLocaleDateString("en", { weekday: "short" });

// Soft, rounded tooltip styling shared by both charts (Recharts default is a hard square box).
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
  const [nag, setNag] = useState(null); // null → show the data-aware default; "Nag me" sets a fresh line
  const { user } = useAuth();
  const [doneMissed, setDoneMissed] = useState({ done: 0, missed: 0 });
  const [rank, setRank] = useState(null);

  // Fetch the summary + task counts + my rank on mount (so the cards stay in sync).
  useEffect(() => {
    api.get("/dashboard")
      .then((res) => setData(res.data))
      .catch(() => setError("Couldn't load your dashboard."));

    api.get("/tasks").then((res) => {
      const now = new Date();
      // API DateTimes come without a 'Z' — treat them as UTC so the comparison is correct (same fix as Tasks.jsx).
      const asUtc = (iso) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
      const done = res.data.filter((t) => t.status === "Done").length;
      // missed = scheduled, has an end time that already passed, still not done
      const missed = res.data.filter((t) => t.status === "Scheduled" && t.endTime && asUtc(t.endTime) < now).length;
      setDoneMissed({ done, missed });
    }).catch(() => { });

    api.get("/ranking").then((res) => {
      const me = res.data.find((r) => r.isMe);
      setRank(me ? me.rank : null);
    }).catch(() => { });
  }, []);

  // Map API rows (seconds) → chart-friendly minutes.
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

  // The AI coach shown here mirrors the account's chosen tone (sidebar + Coach page stay in sync).
  const persona = personas.find((p) => p.key === user?.aiTone) ?? personas[1]; // default: The Secretary
  const personaShort = persona.name.replace(/^The\s+/i, ""); // "The Healer" → "Healer"
  // Bunny frame uses the landing coach card's soft pastel tint, with a matching coloured ring.
  const frameStyle = {
    background: persona.tint,
    boxShadow: `0 0 0 3px var(--card), 0 0 0 5px ${persona.color}59, 0 6px 18px ${persona.color}33`,
  };
  const head = headlineFor(todayMin);
  const shownNag = nag ?? nagLines(persona.key, todayMin, doneMissed.missed)[0];

  // "Nag me" rolls a fresh line in the active coach's voice, woven with today's real data.
  function handleNag() {
    // TODO: swap for the live AI coach endpoint (SK+Gemini) — local persona stand-in for now.
    setNag(pick(nagLines(persona.key, todayMin, doneMissed.missed)));
  }

  return (
    <section className="view active" id="view-dashboard">
      <div className="view-head">
        <h2>{head.title}</h2>
        <p>{head.sub}</p>
      </div>

      {/* AI coach hero — persona + nag reflect the account's chosen tone */}
      <div className="hero">
        <div className="hero-frame" id="heroFrame" style={frameStyle}>
          <BlinkFace src={persona.profile} blink={persona.blink} alt={persona.name} style={{ width: "80%", height: "80%", objectFit: "contain", display: "block" }} />
          <span className="mode-badge focus" style={{ background: persona.color }}>{persona.face} {personaShort}</span>
        </div>
        <div className="msg">
          <div className="from" style={{ color: persona.color }}>{persona.name} · latest nag</div>
          <div className="text">{shownNag}</div>
        </div>
        <button className="btn btn-primary" onClick={handleNag}>💬 Nag me</button>
      </div>

      {/* Stat cards — today & week are real; done/missed & rank are wired later */}
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

      {/* Charts: weekly bars + category-mix donut */}
      <div className="grid-2">
        <div className="card">
          <h3>📊 This week's focus <span className="sub">minutes per day</span></h3>
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
                    {/* No hover tooltip — the centre total + legend already show every value,
                        and a cursor-following box would overlap the centre label. */}
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
