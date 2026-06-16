import { useEffect, useState } from "react";
import api from "../api/client";

// 🏆 Weekly ranking — real data from /api/ranking (single-school leaderboard).
const medal = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);

// Backend returns seconds → show as minutes / hours.
const fmtDur = (secs) => {
  const m = Math.round(secs / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

export default function Ranking() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch once when the screen mounts.
  useEffect(() => {
    api.get("/ranking")
      .then((res) => setRows(res.data))
      .catch(() => setError("Couldn't load the ranking."))
      .finally(() => setLoading(false));
  }, []);

  // Top scorer sets the 100% reference for every progress bar.
  const topSecs = rows[0]?.totalSeconds || 1;

  return (
    <section className="view active" id="view-rank">
      <div className="view-head">
        <h2> Ranking</h2>
        <p>
          Rank up against your schoolmates this week — by total <b>focus minutes</b>. Every session counts.
        </p>
      </div>

      <div className="rank-tabs">
        <span className="rank-tab on" style={{ cursor: "default" }}>
          Xiamen University Malaysia
        </span>
        <span className="rank-reset">⏳ resets Mon 00:00 (MYT) · this week</span>
      </div>

      <div className="card">
        {loading && <p>Loading…</p>}
        {error && <p style={{ color: "#E8734A", fontWeight: 700 }}>{error}</p>}

        {!loading && !error && (
          <div id="rankList">
            {rows.map((p, i) => (
              <div className={`rank-li ${p.isMe ? "me" : ""}`} key={p.id}>
                <div className="rk">{medal(i)}</div>
                <div className="info">
                  <div className="rnm">
                    {p.nickname} {p.isMe && <span className="you">YOU</span>}
                  </div>
                  <div className="rbar">
                    <i style={{ width: `${Math.min((p.totalSeconds / topSecs) * 100, 100)}%` }} />
                  </div>
                </div>
                <div className="rv">
                  {fmtDur(p.totalSeconds)}
                  <small>this week</small>
                </div>
              </div>
            ))}
            {rows.length === 0 && <p>No sessions yet this week.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

