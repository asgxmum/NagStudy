import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { personas, todayMin, fmtDur } from "../data/mock";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

// Reference screen: persona picker → two-way chat (W4 controlled input, W7 useEffect autoscroll).
// Coach replies are mocked locally for now; later they'll come from the backend coach service.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Persona art (public/) keyed by tone — replaces the emoji faces on the coach picker cards.
const COACH_IMG = {
  Soft: "/Healer.png",
  Normal: "/Secretary.png",
  Harsh: "/Elite.png",
};
const COACH_IMG_SIZE = 88; // same render height for all three so the cards look uniform

// minutes-of-day "now" → "08:30" (chat timestamps, like the prototype's fmtT)
function clockNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Persona-flavoured, data-aware reply. Ports the spirit of the prototype's coachReply():
// a "tired" keyword branch + a few canned lines per tone, woven with today's focus minutes.
// TODO: POST to api/coach/chat (SK+Gemini) — replace this local stub with the real coach call.
function coachReply(userText, tone) {
  const m = fmtDur(todayMin);
  const tired = /tired|hard|exhaust|sleep|can'?t|burn|give up|quit/.test(
    (userText || "").toLowerCase()
  );
  const lib = {
    Soft: {
      tired: [
        `It's okay to feel that way 🌷 You've already focused ${m} today. Rest 5 min, then let's do the next one together?`,
      ],
      def: [
        `I'm listening 💗 You're at ${m} today — that's great. Let's take the next small step together.`,
        `No pressure 🌷 Just one tiny thing next? Starting is half the battle, and you've got this.`,
      ],
    },
    Normal: {
      tired: [`Logged: ${m} focus today. Rest is part of the plan. 10-min timer, then resume.`],
      def: [
        `Noted. Today: ${m} focused. Recommend proceeding with the next item.`,
        `Bottom line: clear the oldest task first. Begin.`,
      ],
    },
    Harsh: {
      tired: [`Tired already? After only ${m}? First place is still at the desk. Up you get 👑`],
      def: [
        `Talk is cheap. Today's ${m} won't grow itself — start the next task, gracefully 👑`,
        `How interesting. So — the next task now, or more excuses? 👑`,
      ],
    },
  };
  const set = lib[tone] || lib.Normal;
  return pick(tired ? set.tired : set.def);
}

// Unprompted "Nag me now" lines — one set per tone, seeded with today's focus minutes.
function nagText(tone) {
  const m = fmtDur(todayMin);
  const lib = {
    Soft: [
      `You've already focused for ${m} today — that's wonderful! 🌷 Let's do just one more together, okay?`,
      `You're doing great 💗 How about a quick stretch before your next thing? Your body matters too.`,
    ],
    Normal: [
      `Status report — ${m} focused today. Recommend starting with the oldest item. That is all.`,
      `Today: ${m} focus logged. Next action pending. Proceed.`,
    ],
    Harsh: [
      `Only ${m}, and already asking for attention? Bold. Your tasks won't do themselves 👑`,
      `${m} today… not terrible. But first place is still studying right now 👑`,
    ],
  };
  return pick(lib[tone] || lib.Normal);
}

export default function Coach() {
  const { user, updateUser } = useAuth();
  // Start on the coach saved to the account (AiTone), so it matches the sidebar badge.
  const [tone, setTone] = useState(user?.aiTone ?? personas[0].key);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  // Toast shown when the active coach changes (portaled into AppLayout's #toast-root).
  const [toast, setToast] = useState(null); // { id, face, name, color, out }

  const logRef = useRef(null);
  const activePersona = personas.find((p) => p.key === tone) ?? personas[0];

  // Switch coach + raise a "Coach switched" toast (skip if it's already the active one).
  // Updates the shared user (so the sidebar badge changes instantly) and persists to the API.
  function selectTone(p) {
    if (p.key === tone) return;
    setTone(p.key);
    setToast({ id: Date.now(), img: COACH_IMG[p.key], name: p.name, color: p.color, out: false });
    updateUser({ aiTone: p.key }); // optimistic — live-syncs the sidebar persona chip
    api.put("/users/me/tone", { aiTone: p.key }).catch(() => {
      // Persistence is best-effort here; the local UI already reflects the choice.
    });
  }

  // Auto-dismiss the persona toast: hold ~2.4s, slide out, then unmount.
  // Keyed on toast.id so flipping `out` to true doesn't restart the timers.
  useEffect(() => {
    if (!toast) return;
    const hold = setTimeout(() => setToast((t) => (t ? { ...t, out: true } : t)), 2400);
    const drop = setTimeout(() => setToast(null), 2720);
    return () => { clearTimeout(hold); clearTimeout(drop); };
  }, [toast?.id]);

  // Autoscroll to newest message whenever the log or typing indicator changes.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Brief "…is typing", then append the coach reply.
  useEffect(() => {
    if (!typing) return;
    const id = setTimeout(() => {
      setMessages((prev) => {
        const lastUser = [...prev].reverse().find((msg) => msg.role === "user");
        // TODO: POST to api/coach/chat (SK+Gemini) — generate the reply server-side here.
        return [
          ...prev,
          { id: Date.now(), role: "coach", tone, text: coachReply(lastUser?.text, tone), time: clockNow() },
        ];
      });
      setTyping(false);
    }, 650);
    return () => clearTimeout(id);
  }, [typing, tone]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: Date.now(), role: "user", text, time: clockNow() }]);
    setDraft("");
    setTyping(true);
  }

  function nagMe() {
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "coach", tone, text: nagText(tone), time: clockNow() },
    ]);
  }

  // Toast lives outside the page flow — portal it into the shell's fixed #toast-root.
  const toastRoot = typeof document !== "undefined" ? document.getElementById("toast-root") : null;

  return (
    <section className="view active" id="view-coach">
      {toast && toastRoot &&
        createPortal(
          <div className={`toast${toast.out ? " out" : ""}`} style={{ borderLeftColor: toast.color }}>
            <div className="ta">
              <img src={toast.img} alt="" style={{ width: 32, height: 32, objectFit: "contain", display: "block" }} />
            </div>
            <div className="tc">
              <div className="th">
                <span className="tn2" style={{ color: toast.color }}>Coach switched</span>
              </div>
              <div className="tx">
                <b>{toast.name}</b> is your coach now — say hi, or hit “Nag me now”.
              </div>
            </div>
          </div>,
          toastRoot
        )}

      <div className="view-head">
        <h2> AI Coach</h2>
        <p>
          Pick your coach, then chat with them — it reads your data and replies in that character's
          voice, in real time.
        </p>
      </div>

      {/* Persona picker — clicking a card selects the active tone */}
      <div className="char-grid" id="charGrid">
        {personas.map((p) => (
          <div
            key={p.key}
            className={`char-card ${tone === p.key ? "on" : ""}`}
            onClick={() => selectTone(p)}
          >
            <div className="pick">✅</div>
            <div className="face" style={{ height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src={COACH_IMG[p.key] ?? COACH_IMG.Normal}
                alt={p.name}
                style={{ height: COACH_IMG_SIZE, width: "auto", objectFit: "contain" }}
              />
            </div>
            <div className="nm">{p.name}</div>
            <div className="ds">{p.desc}</div>
            <span
              className="tone-chip tn"
              style={{ background: `${p.color}22`, color: p.color, borderColor: `${p.color}55` }}
            >
              {p.key}
            </span>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
      >
        <div style={{ fontSize: "13.5px", color: "var(--txt2)", flex: 1, minWidth: 200, fontWeight: 600 }}>
          It reads your data (focus today · missed tasks · what's next) and nags you{" "}
          <b style={{ color: "var(--txt)" }}>in your chosen character's voice</b>.
        </div>
        <button className="btn btn-primary" onClick={nagMe}>
          💬 Nag me now
        </button>
      </div>

      <div className="card">
        <h3>
          💬 Chat with your coach <span className="sub">real-time · logged as AIFeedback</span>
        </h3>

        {/* Scrollable message list */}
        <div ref={logRef} id="chatLog" className="chat-log">
          {messages.length === 0 ? (
            <div className="chat-typing">
              Talk to your coach — or hit "Nag me now" above for your first nag!
            </div>
          ) : (
            messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="chat-row user">
                  <div className="chat-av">🙂</div>
                  <div className="chat-bubble">
                    {msg.text}
                    <div className="cbt" style={{ textAlign: "right" }}>
                      {msg.time}
                    </div>
                  </div>
                </div>
              ) : (
                <CoachRow key={msg.id} msg={msg} />
              )
            )
          )}

          {typing && (
            <div className="chat-typing">{activePersona.name} is typing…</div>
          )}
        </div>

        {/* Input + Send (Enter to send) */}
        <div className="chat-input">
          <input
            id="chatInput"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Talk to your coach…  (Enter)"
          />
          <button className="btn btn-primary btn-sm" onClick={send}>
            Send
          </button>
        </div>
      </div>
    </section>
  );
}

// Coach bubble (left): persona face avatar + name, both tinted with the persona color.
function CoachRow({ msg }) {
  const p = personas.find((x) => x.key === msg.tone) ?? personas[0];
  return (
    <div className="chat-row coach">
      <div className="chat-av" style={{ background: `${p.color}22` }}>
        {p.face}
      </div>
      <div className="chat-bubble">
        <div className="cbn" style={{ color: p.color }}>
          {p.name}
        </div>
        {msg.text}
        <div className="cbt">{msg.time}</div>
      </div>
    </div>
  );
}
