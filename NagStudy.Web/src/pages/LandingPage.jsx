import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { personas, ranking, fmtDur } from "../data/mock";

// Standalone full-screen marketing landing (NOT inside AppLayout).
// Mirrors the prototype's #screen-home block VERBATIM so the global prototype.css
// (imported in main) reproduces the exact design — incl. the sprite-bunny hero.
// W7: react-router <Link> replaces the prototype's data-goapp / data-go nav.

// Persona art (public/) keyed by tone — replaces the emoji faces on the coach cards.
const COACH_IMG = {
  Soft: "/Healer.png",
  Normal: "/Secretary.png",
  Harsh: "/Elite.png",
};

// Persona quotes aren't in mock.js — keep the prototype's coach quotes + tag colours here, keyed by tone.
const COACH_EXTRA = {
  Soft: { top: "rgba(126,196,142,.18)", tagBg: "rgba(126,196,142,.22)", tagColor: "#3f9a5e", quote: '"You\'ve focused 2h already — wonderful! Let\'s do just one more 🌷"' },
  Normal: { top: "rgba(110,137,190,.16)", tagBg: "rgba(110,137,190,.18)", tagColor: "var(--sky)", quote: '"Today: 2h 35m focus, 2 missed. Recommend starting now."' },
  Harsh: { top: "rgba(194,160,91,.2)", tagBg: "rgba(194,160,91,.22)", tagColor: "var(--gold)", quote: '"Only 2h, and already resting? First place isn\'t, you know 👑"' },
};

// Rotating student testimonials for the landing carousel.
const TESTIMONIALS = [
  { quote: "I used to pull all-nighters every week. Now the Elite bunny roasts me at 9pm and I actually start. My GPA thanks it.", name: "Aisyah R.", role: "Year 2 · XMU Malaysia", img: "/Aisyah R.jpg", bg: "var(--coral-soft)" },
  { quote: "The Pomodoro auto-pauses the second I flee to another tab — brutal, but it's exactly the nudge I needed to keep focusing.", name: "Wei Jie L.", role: "Year 3 · XMU Malaysia", img: "/Wei Jie L.jpg", bg: "rgba(110,137,190,.16)" },
  { quote: "Climbing the weekly ranking turned studying into a game with my friends. Now I check my focus minutes every single night.", name: "Priya N.", role: "Year 1 · XMU Malaysia", img: "/Priya N.jpg", bg: "rgba(194,160,91,.18)" },
];

export default function LandingPage() {
  const topRanks = ranking.slice(0, 3); // showcase the podium
  const topMin = topRanks[0]?.min || 1; // scale the bars to the leader
  const medals = ["🥇", "🥈", "🥉"];

  // Landing is public, but a logged-in visitor shouldn't see "Login / Sign up" —
  // swap those for a "Go to app" shortcut (admins go to /admin).
  const { isAuthed, user } = useAuth();
  const appHref = user?.role === "Admin" ? "/admin" : "/app";
  // "See the ranking" should land a logged-in student on the actual Ranking page (admins → admin view);
  // a logged-out visitor still has to sign in first.
  const rankingHref = !isAuthed ? "/login" : user?.role === "Admin" ? "/admin" : "/app/ranking";
  // Logged-in nav avatar tinted in the account's coach colour (matches the sidebar + dashboard).
  const navPersona = personas.find((p) => p.key === user?.aiTone) ?? personas[1];

  // Auto-rotating testimonial carousel (the dots also let you jump manually).
  const [tIdx, setTIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTIdx((i) => (i + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(id);
  }, []);
  const tst = TESTIMONIALS[tIdx];

  // Animate the preview card's progress bars from 0 → target once it scrolls into view.
  const previewRef = useRef(null);
  const [barsShown, setBarsShown] = useState(false);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setBarsShown(true); obs.disconnect(); } },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="screen lp active" id="screen-home">
      <nav>
        <div className="wrap nav-in">
          <div className="brand"><img src="/NagStudy-Logo.svg" alt="NagStudy" style={{ height: 30, width: "auto", display: "block" }} /><span><span className="nag">Nag</span>Study</span></div>
          <div className="nav-links">
            <a className="nav-link active" href="#screen-home">Home</a>
            <a className="nav-link" href="#services">Features</a>
            <a className="nav-link" href="#coaches">Coaches</a>
            <a className="nav-link" href="#leaderboard">Ranking</a>
            {isAuthed ? (
              <Link
                className="signup cta-link"
                to={appHref}
                title={`Logged in as ${user?.nickname ?? "you"} — go to the app`}
                style={{ display: "inline-flex", alignItems: "center", gap: 9 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: navPersona.tint,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, flexShrink: 0,
                    boxShadow: `0 0 0 2px var(--card), 0 0 0 3px ${navPersona.color}59`,
                  }}
                >
                  🐰
                </span>
                {user?.nickname ?? "Go to app"} →
              </Link>
            ) : (
              <>
                <Link className="nav-link cta-link" to="/login">Login</Link>
                <Link className="signup cta-link" to="/signup">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="wrap hero">
        <div className="blob"></div><div className="blob2"></div>
        <div className="hero-copy">
          <div className="eyebrow">Meet your AI study buddy</div>
          <h1>Study, focus,<br />and <span className="ul">win<svg viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M4,13 Q60,2 110,9 T196,7" stroke="#E8734A" strokeWidth="7" fill="none" strokeLinecap="round" /></svg></span> your week.</h1>
          <p className="sub">Brain-dump your tasks, time-box them, and let your AI bunny coach nag you into focus — then climb your school's weekly ranking.</p>
          <div className="hero-cta">
            <Link className="btn btn-coral" to={isAuthed ? appHref : "/login"}>{isAuthed ? "Go to my dashboard" : "Find out more"}</Link>
            <Link className="play" to={isAuthed ? appHref : "/login"}><span className="pbtn">▶</span><span className="ptxt">Play Demo</span></Link>
          </div>
        </div>
        <div className="visual">
          <div className="bun-stage">
            <span className="plane p1">✈️</span><span className="plane p2">✈️</span>
            <span className="spark s1">✦</span><span className="spark s2">✦</span>
            <div className="bun-main" aria-label="NagStudy study bunny animation">
              <span className="bunny-rig" aria-hidden="true">
                <span className="bunny-rig-base"></span>
                <span className="magnifier-frame"></span>
                <span className="magnifier-blink-frame"></span>
                <span className="ear-perk left"></span><span className="ear-perk right"></span>
                <span className="rig-ear left"></span><span className="rig-ear right"></span>
                <span className="rig-blink left"></span><span className="rig-blink right"></span>
                <span className="rig-cheek left"></span><span className="rig-cheek right"></span>
                <span className="rig-line"></span><span className="rig-spark"></span>
              </span>
            </div>
            <div className="chip c1"><div className="ci" style={{ background: "var(--coral-soft)" }}>🔥</div><div><div className="ct">Focus today</div><div className="cv">2h 35m</div></div></div>
            <div className="chip c2"><div className="ci" style={{ background: "rgba(110,137,190,.16)" }}>🏆</div><div><div className="ct">School rank</div><div className="cv">#2 · XMU</div></div></div>
          </div>
        </div>
      </header>

      {/* SERVICES */}
      <section className="sec wrap" id="services">
        <span className="dotgrid" style={{ top: "30px", right: 0 }}></span>
        <div className="sec-head">
          <div className="sec-tag">What you get</div>
          <h2>Everything you need to stop slacking</h2>
        </div>
        <div className="serv-grid">
          <div className="serv">
            <div className="ic" style={{ background: "none", boxShadow: "none", width: "auto", height: "auto" }}>
              <img src="/brain_dump.png" alt="Brain dump" style={{ width: 84, height: 84, objectFit: "contain" }} />
            </div>
            <h3>Brain Dump</h3>
            <p>Splurge every task out of your head, tag important vs. not, sort it later.</p>
          </div>
          <div className="serv">
            <div className="ic" style={{ background: "none", boxShadow: "none", width: "auto", height: "auto" }}>
              <img src="/Timer.png" alt="Focus timer" style={{ width: 84, height: 84, objectFit: "contain" }} />
            </div>
            <h3>Focus Timer</h3>
            <p>A Pomodoro that auto-pauses the second you flee to another tab.</p>
          </div>
          <div className="serv feat-on">
            <div className="ic" style={{ background: "none", boxShadow: "none", width: "auto", height: "auto" }}>
              <img src="/AI_Secretary.png" alt="AI nag coach" style={{ width: 84, height: 84, objectFit: "contain" }} />
            </div>
            <h3>AI Nag Coach</h3>
            <p>Three personalities nag you in their own voice, from your real data.</p>
          </div>
          <div className="serv">
            <div className="ic" style={{ background: "none", boxShadow: "none", width: "auto", height: "auto" }}>
              <img src="/Ranking.png" alt="Weekly ranking" style={{ width: 84, height: 84, objectFit: "contain" }} />
            </div>
            <h3>Weekly Ranking</h3>
            <p>Your focus minutes rank you against your schoolmates — resets every week.</p>
          </div>
        </div>
      </section>

      {/* COACHES — personas from mock */}
      <section className="sec wrap" id="coaches">
        <div className="sec-head">
          <div className="sec-tag">Meet the squad</div>
          <h2>Pick the coach who nags you</h2>
          <p>Same data, completely different attitude. Switch any time — only the prompt changes.</p>
        </div>
        <div className="coach-grid">
          {personas.map((p) => {
            const x = COACH_EXTRA[p.key] ?? COACH_EXTRA.Normal;
            return (
              <div className="coach" key={p.key}>
                <div className="top" style={{ background: x.top }}>
                  <img
                    src={COACH_IMG[p.key] ?? COACH_IMG.Normal}
                    alt={p.name}
                    style={{ height: 104, width: "auto", objectFit: "contain" }}
                  />
                </div>
                <div className="body">
                  <div className="nm">{p.name} <span className="tag" style={{ background: x.tagBg, color: x.tagColor }}>{p.key.toUpperCase()}</span></div>
                  <div className="ds">{p.desc}</div>
                  <div className="quote">{x.quote}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* STEPS */}
      <section className="sec wrap">
        <div className="steps-sec">
          <div className="steps-copy">
            <div className="eyebrow">Easy &amp; fast</div>
            <h2>Get focused in 3 easy steps</h2>
            <div className="step">
              <div className="si" style={{ background: "rgba(226,163,59,.16)", color: "var(--amber)" }}>
                <img src="/List.png" alt="" style={{ width: 32, height: 32, objectFit: "contain", display: "block" }} />
              </div>
              <div><h4>Dump &amp; schedule</h4><p>Brain-dump your tasks, then drag them onto today's Gantt timeline.</p></div>
            </div>
            <div className="step">
              <div className="si" style={{ background: "var(--coral-soft)", color: "var(--coral)" }}>
                <img src="/Timer.png" alt="" style={{ width: 32, height: 32, objectFit: "contain", display: "block" }} />
              </div>
              <div><h4>Start a focus session</h4><p>The Pomodoro measures real focus — leave the tab and it auto-pauses.</p></div>
            </div>
            <div className="step">
              <div className="si" style={{ background: "rgba(63,167,162,.16)", color: "var(--teal)" }}>
                <img src="/Profile_Secretary.png" alt="" style={{ width: 32, height: 32, objectFit: "contain", display: "block" }} />
              </div>
              <div><h4>Get nagged &amp; ranked</h4><p>Your coach reacts to your data, and your minutes climb the weekly ranking.</p></div>
            </div>
          </div>
          <div className="preview" ref={previewRef}>
            <div className="pv-card">
              <div className="pv-hero">
                <div className="pv-bun">🐰</div>
                <div><div className="h-t">✦ FOCUS MODE</div><div className="h-v">2h 35m today</div></div>
              </div>
              <div className="pv-row"><span>Algorithms Q3</span><span className="pv-bar"><i style={{ width: barsShown ? "64%" : "0%" }}></i></span><span>64%</span></div>
              <div className="pv-row"><span>.NET team API</span><span className="pv-bar"><i style={{ width: barsShown ? "30%" : "0%" }}></i></span><span>30%</span></div>
              <div className="pv-mini">
                <div className="av">🔥</div>
                <div style={{ flex: 1 }}><div className="m-t">TODAY'S PLAN</div><div className="m-v">40% done</div><div className="m-bar"><i style={{ width: barsShown ? "40%" : "0%" }}></i></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LEADERBOARD — rows from mock */}
      <section className="sec wrap" id="leaderboard">
        <div className="rank-sec">
          <div className="rank-copy">
            <div className="sec-tag">Ranking</div>
            <h2>Compete with <em>your schoolmates.</em></h2>
            <p>Studying alone is lonely. Every focus minute ranks you against everyone else at your university — and the board resets every week, so anyone can climb.</p>
            <ul>
              <li><span className="ck">✓</span> Ranked by your weekly focus minutes</li>
              <li><span className="ck">✓</span> Weekly reset, every Monday 00:00 (MYT)</li>
              <li><span className="ck">✓</span> See exactly how far you are from the next rank</li>
            </ul>
            <Link className="btn btn-coral" to={rankingHref}>See the ranking →</Link>
          </div>
          <div className="board">
            <div className="board-h"><span>🏆 MY SCHOOL · THIS WEEK</span><span>XMU Malaysia</span></div>
            {topRanks.map((r, i) => (
              <div className="brow" key={r.name}>
                <div className="rk">{medals[i]}</div>
                <div className="nm">{r.emoji} {r.name}</div>
                <div className="bar"><i style={{ width: `${Math.round((r.min / topMin) * 100)}%` }}></i></div>
                <div className="v">{fmtDur(r.min)}</div>
              </div>
            ))}
            <div className="brow me">
              <div className="rk">#12</div>
              <div className="nm"> Snoozebun <span className="you">YOU</span></div>
              <div className="bar"><i style={{ width: "40%" }}></i></div>
              <div className="v">8h 30m</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="sec wrap">
        <div className="tst-sec">
          <div className="tst-copy">
            <div className="sec-tag">Testimonials</div>
            <h2>What students<br />say about us</h2>
            <div className="tst-dots" id="tdots">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  className={`tdot${i === tIdx ? " on" : ""}`}
                  aria-label={`Testimonial ${i + 1}`}
                  onClick={() => setTIdx(i)}
                ></button>
              ))}
            </div>
          </div>
          <div className="tst-stage">
            <div className="tst-back"></div>
            <div className="tst-card" key={tIdx} style={{ animation: "tstFade .45s ease" }}>
              <div className="q">"{tst.quote}"</div>
              <div className="tst-who">
                <div className="av" style={{ background: tst.bg, overflow: "hidden", padding: 0 }}>
                  <img src={tst.img} alt={tst.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
                <div><div className="n">{tst.name}</div><div className="r">{tst.role}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LOGO STRIP */}
      <section className="sec wrap" style={{ padding: "24px 0 72px" }}>
        <div className="logos" style={{ justifyContent: "center" }}>
          <span className="logo-it ours" style={{ display: "inline-flex", alignItems: "center", gap: 26 }}>
            <img
              src="/Xiamen_University_logo.svg"
              alt="Xiamen University Malaysia"
              style={{ height: 110, width: "auto", display: "block" }}
            />
            <span style={{ display: "inline-flex", flexDirection: "column", textAlign: "left", lineHeight: 1.3 }}>
              <b style={{ fontSize: 30, color: "var(--coral)" }}>Built for XMU Malaysia students</b>
              <span style={{ fontSize: 17, color: "var(--ink3)", opacity: 0.75, fontWeight: 600 }}>
                Xiamen University Malaysia
              </span>
            </span>
          </span>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="fb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src="/NagStudy-Logo.svg" alt="" style={{ height: 26, width: "auto", display: "block", flexShrink: 0 }} />
              <span><span className="nag">Nag</span>Study</span>
            </div>
            <p>The study app that nags you (nicely) into focus — and ranks your whole school.</p>
            <div className="soc">
              <a
                href="https://github.com/asgxmum/NagStudy"
                target="_blank"
                rel="noopener noreferrer"
                title="View the source on GitHub"
                aria-label="GitHub repository"
              >
                <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="foot-col"><h5>Product</h5><a href="#services">Features</a><a href="#coaches">AI Coaches</a><a href="#leaderboard">Ranking</a></div>
          <div className="foot-col"><h5>Get started</h5><Link to="/login">Log in</Link><Link to="/signup">Sign up</Link></div>
        </div>
        <div className="foot-base">SWE310 group project · NagStudy</div>
      </footer>
    </div>
  );
}
