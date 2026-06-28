import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import ProfilePickerModal from "../components/ProfilePickerModal";
import {
  listProfiles, listSessions, createSession, deleteSession, updateSessionTitle,
  getMessages, sendChat, generateReport,
} from "../api/coach";
import { profileAvatar, userAvatarFromAuth } from "../utils/coachProfile";
import CoachMessageBody from "../components/CoachMessageBody";

function formatMsgTime(msg) {
  if (msg.time) return msg.time;
  if (!msg.createdAt) return "";
  const d = new Date(msg.createdAt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const COACH_TOOLS = [
  { id: "summary", label: "Summary", icon: "📊", desc: "Generate a study report" },
];

export default function Coach() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [showProfilePicker, setShowProfilePicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("week");
  const [reportLang, setReportLang] = useState("English");
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");
  const [sessionMenu, setSessionMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const logRef = useRef(null);
  const toolMenuRef = useRef(null);
  const sessionMenuRef = useRef(null);

  const userAvatar = userAvatarFromAuth(user);

  async function loadProfiles() {
    setProfilesLoading(true);
    setProfilesError("");
    try {
      const r = await listProfiles();
      setProfiles(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setProfiles([]);
      setProfilesError(e.response?.data?.message ?? "Couldn't load coach profiles. Is the API running?");
    } finally {
      setProfilesLoading(false);
    }
  }

  useEffect(() => {
    loadProfiles();
    listSessions().then((r) => setSessions(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (!toolMenuOpen) return;
    function onDocClick(e) {
      if (toolMenuRef.current && !toolMenuRef.current.contains(e.target)) setToolMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [toolMenuOpen]);

  useEffect(() => {
    if (!sessionMenu) return;
    function onDocClick(e) {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target)) setSessionMenu(null);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setSessionMenu(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sessionMenu]);

  function assistantAvatar(session) {
    if (!session) return profileAvatar(null);
    return profileAvatar({ key: session.profileKey });
  }

  async function loadSession(session) {
    setActiveSession(session);
    setError("");
    setReportPanelOpen(false);
    try {
      const res = await getMessages(session.id);
      setMessages(res.data);
    } catch {
      setError("Couldn't load messages.");
      setMessages([]);
    }
  }

  function openSessionMenu(e, session) {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setSessionMenu({
      session,
      x: Math.min(rect.right - 8, window.innerWidth - 168),
      y: Math.min(rect.bottom + 4, window.innerHeight - 96),
    });
  }

  function startRenameSession(session) {
    setSessionMenu(null);
    setRenameTarget(session);
    setRenameDraft(session.title);
  }

  function startDeleteSession(session) {
    setSessionMenu(null);
    setDeleteTarget(session);
  }

  async function confirmDeleteSession() {
    if (!deleteTarget) return;
    try {
      await deleteSession(deleteTarget.id);
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      if (activeSession?.id === deleteTarget.id) {
        setActiveSession(null);
        setMessages([]);
      }
      setError("");
      setDeleteTarget(null);
    } catch {
      setError("Couldn't delete this chat.");
      setDeleteTarget(null);
    }
  }

  async function saveRenameSession() {
    if (!renameTarget) return;
    const title = renameDraft.trim();
    if (!title) return;
    setRenameSaving(true);
    try {
      const res = await updateSessionTitle(renameTarget.id, title);
      const updated = res.data;
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (activeSession?.id === updated.id) setActiveSession(updated);
      setRenameTarget(null);
      setRenameDraft("");
      setError("");
    } catch (e) {
      setError(e.response?.data?.message ?? "Couldn't rename this chat.");
    } finally {
      setRenameSaving(false);
    }
  }

  function handleSessionContextMenu(e, session) {
    openSessionMenu(e, session);
  }

  async function openProfilePicker() {
    setShowProfilePicker(true);
    await loadProfiles();
  }

  async function startNewChat(profileId) {
    setShowProfilePicker(false);
    try {
      const res = await createSession(profileId);
      const session = res.data;
      setSessions((prev) => [session, ...prev]);
      setActiveSession(session);
      setMessages([]);
      setReportPanelOpen(false);
    } catch (e) {
      setError(e.response?.data?.message ?? "Couldn't create session.");
    }
  }

  function selectTool(toolId) {
    setToolMenuOpen(false);
    if (toolId === "summary") {
      if (!activeSession) {
        setError("Start or select a chat first.");
        return;
      }
      setReportPanelOpen(true);
    }
  }

  async function sendReport() {
    if (!activeSession || typing) return;
    setTyping(true);
    setError("");
    setReportPanelOpen(false);
    const userLine = `[Report] ${reportPeriod} · ${reportLang}`;
    setMessages((prev) => [...prev, { id: Date.now(), role: "User", messageType: "Report", content: userLine, createdAt: new Date().toISOString() }]);
    try {
      const res = await generateReport(activeSession.id, { period: reportPeriod, language: reportLang });
      setMessages((prev) => [
        ...prev,
        { id: res.data.assistantMessageId, role: "Assistant", messageType: "Report", content: res.data.reply, createdAt: new Date().toISOString() },
      ]);
      listSessions().then((r) => setSessions(r.data)).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.message ?? e.response?.data?.title ?? "Report failed.");
    } finally {
      setTyping(false);
    }
  }

  async function sendChatMessage() {
    if (!activeSession || typing) return;
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setTyping(true);
    setError("");
    setMessages((prev) => [...prev, { id: Date.now(), role: "User", messageType: "Chat", content: text, createdAt: new Date().toISOString() }]);
    try {
      const res = await sendChat(activeSession.id, text);
      setMessages((prev) => [
        ...prev,
        { id: res.data.assistantMessageId, role: "Assistant", messageType: "Chat", content: res.data.reply, createdAt: new Date().toISOString() },
      ]);
      listSessions().then((r) => setSessions(r.data)).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.message ?? e.response?.data?.title ?? "Chat failed.");
    } finally {
      setTyping(false);
    }
  }

  function copyReport(content) {
    navigator.clipboard?.writeText(content).catch(() => {});
  }

  function handleComposerKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  return (
    <section className="view active coach-gemini-wrap" id="view-coach">
      <div className={`coach-gemini${sidebarOpen ? "" : " sidebar-collapsed"}`}>
        <aside className="coach-gemini-sidebar">
          <div className="cgs-top">
            <button type="button" className="cgs-icon-btn" onClick={() => setSidebarOpen((v) => !v)} title={sidebarOpen ? "Collapse" : "Expand"}>
              {sidebarOpen ? "◀" : "▶"}
            </button>
            {sidebarOpen && <span className="cgs-brand">Recents</span>}
          </div>
          <button
            type="button"
            className="cgs-new-btn"
            onClick={openProfilePicker}
            title="New chat"
          >
            <span className="cgs-new-icon">+</span>
            {sidebarOpen && <span>New chat</span>}
          </button>
          <div className="cgs-session-list">
            {sidebarOpen && sessions.length === 0 && (
              <div className="sub" style={{ textAlign: "center", padding: "36px 16px", lineHeight: 1.6 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
                No chats yet.<br />Tap <b>+ New chat</b> to begin.
              </div>
            )}
            {sessions.map((s) => (
              <div key={s.id} className={`cgs-session-row${activeSession?.id === s.id ? " active" : ""}`}>
                <button
                  type="button"
                  className={`cgs-session-item${activeSession?.id === s.id ? " active" : ""}`}
                  onClick={() => loadSession(s)}
                  onContextMenu={(e) => handleSessionContextMenu(e, s)}
                  title={sidebarOpen ? s.title : s.title}
                >
                  {sidebarOpen ? s.title : "💬"}
                </button>
                {sidebarOpen && (
                  <button
                    type="button"
                    className="cgs-session-more"
                    onClick={(e) => openSessionMenu(e, s)}
                    title="Chat options"
                    aria-label={`Options for ${s.title}`}
                  >
                    ⋯
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        <div className="coach-gemini-main">
          {!activeSession ? (
            <div className="coach-gemini-empty">
              <h3>👋 Meet your study coach</h3>
              <p>Start a chat and pick a coach personality — they'll nag, cheer, or report based on your real study data.</p>
              <button type="button" className="btn btn-primary" onClick={openProfilePicker} style={{ marginTop: 14 }}>
                ＋ Start a new chat
              </button>
            </div>
          ) : (
            <>
              <header className="coach-gemini-header">
                <img src={assistantAvatar(activeSession)} alt="" className="coach-gemini-header-av" />
                <div className="coach-gemini-header-text">
                  <div className="coach-gemini-header-title-row">
                    <div className="coach-gemini-header-title">{activeSession.title}</div>
                    <button
                      type="button"
                      className="coach-gemini-header-edit"
                      onClick={() => startRenameSession(activeSession)}
                      title="Rename chat"
                      aria-label="Rename chat"
                    >
                      ✎
                    </button>
                  </div>
                  <div className="coach-gemini-header-sub">{activeSession.profileName}</div>
                </div>
              </header>

              {error && <p className="coach-gemini-error">{error}</p>}

              {reportPanelOpen && (
                <div className="coach-gemini-tool-panel">
                  <span className="coach-gemini-tool-label">📊 Summary report</span>
                  <select className="set-input cgs-select" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)}>
                    <option value="week">This week</option>
                    <option value="7days">Last 7 days</option>
                    <option value="30days">Last 30 days</option>
                  </select>
                  <select className="set-input cgs-select" value={reportLang} onChange={(e) => setReportLang(e.target.value)}>
                    <option value="English">English</option>
                    <option value="Chinese">中文</option>
                  </select>
                  <button type="button" className="btn btn-primary btn-sm" onClick={sendReport} disabled={typing}>Generate</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReportPanelOpen(false)}>Cancel</button>
                </div>
              )}

              <div ref={logRef} className="coach-gemini-messages">
                {messages.length === 0 && (
                  <div className="coach-gemini-hint">Say hello to your coach — or use <b>+</b> for Summary / Schedule tools.</div>
                )}
                {messages.map((msg) =>
                  msg.role === "User" ? (
                    <div key={msg.id} className="cgm-row user">
                      <div className="cgm-bubble">{msg.content}</div>
                      <img src={userAvatar} alt="" className="cgm-av" />
                    </div>
                  ) : (
                    <div key={msg.id} className="cgm-row assistant">
                      <img src={assistantAvatar(activeSession)} alt="" className="cgm-av" />
                      <div className="cgm-bubble">
                        {msg.messageType === "Report" ? (
                          <>
                            <CoachMessageBody content={msg.content} variant="report" />
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyReport(msg.content)}>Copy</button>
                          </>
                        ) : (
                          <CoachMessageBody content={msg.content} />
                        )}
                        <div className="cgm-time">{formatMsgTime(msg)}</div>
                      </div>
                    </div>
                  )
                )}
                {typing && (
                  <div className="cgm-row assistant">
                    <img src={assistantAvatar(activeSession)} alt="" className="cgm-av" />
                    <div className="cgm-typing">{activeSession.profileName} is typing…</div>
                  </div>
                )}
              </div>
            </>
          )}

          <footer className="coach-gemini-composer">
            <div className="cgc-tools" ref={toolMenuRef}>
              <button
                type="button"
                className="cgc-plus"
                onClick={() => setToolMenuOpen((v) => !v)}
                title={activeSession ? "Tools" : "Start a chat first"}
                disabled={!activeSession}
              >
                +
              </button>
              {toolMenuOpen && (
                <div className="cgc-tool-menu">
                  {COACH_TOOLS.map((t) => (
                    <button key={t.id} type="button" className="cgc-tool-item" onClick={() => selectTool(t.id)}>
                      <span className="cgc-tool-icon">{t.icon}</span>
                      <span>
                        <strong>{t.label}</strong>
                        <small>{t.desc}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activeSession ? (
              <textarea
                className="cgc-input"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleComposerKey}
                placeholder="Message your coach… (Enter to send)"
                disabled={typing}
              />
            ) : (
              <button
                type="button"
                className="cgc-input"
                onClick={openProfilePicker}
                style={{ textAlign: "left", color: "#9aa0ab", cursor: "pointer", background: "transparent" }}
              >
                ＋ Start a new chat to begin →
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary cgc-send"
              onClick={sendChatMessage}
              disabled={!activeSession || typing || !draft.trim()}
            >
              Send
            </button>
          </footer>
        </div>
      </div>

      {showProfilePicker && createPortal(
        <ProfilePickerModal
          profiles={profiles}
          loading={profilesLoading}
          loadError={profilesError}
          onRetry={loadProfiles}
          onSelect={startNewChat}
          onClose={() => setShowProfilePicker(false)}
        />,
        document.body
      )}

      {sessionMenu && createPortal(
        <div
          ref={sessionMenuRef}
          className="cgs-context-menu"
          style={{ top: sessionMenu.y, left: sessionMenu.x }}
          role="menu"
        >
          <button type="button" className="cgs-context-item" onClick={() => startRenameSession(sessionMenu.session)}>
            ✎ Rename
          </button>
          <button type="button" className="cgs-context-item danger" onClick={() => startDeleteSession(sessionMenu.session)}>
            🗑 Delete
          </button>
        </div>,
        document.body
      )}

      {deleteTarget && createPortal(
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card coach-dialog-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="coach-delete-title">
            <h3 id="coach-delete-title">Delete chat?</h3>
            <p className="sub coach-dialog-sub">
              <span className="coach-dialog-highlight">「{deleteTarget.title}」</span>
              will be permanently removed. This cannot be undone.
            </p>
            <div className="coach-dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-coral" onClick={confirmDeleteSession}>Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {renameTarget && createPortal(
        <div className="modal-overlay" onClick={() => !renameSaving && setRenameTarget(null)}>
          <div className="modal-card coach-dialog-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="coach-rename-title">
            <h3 id="coach-rename-title">Rename chat</h3>
            <p className="sub coach-dialog-sub">Give this conversation a short, memorable title.</p>
            <div className="set-field">
              <label htmlFor="coach-rename-input">Title</label>
              <input
                id="coach-rename-input"
                type="text"
                className="set-input"
                value={renameDraft}
                maxLength={80}
                autoFocus
                disabled={renameSaving}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveRenameSession();
                  }
                }}
              />
            </div>
            <div className="coach-dialog-actions">
              <button type="button" className="btn btn-ghost" disabled={renameSaving} onClick={() => setRenameTarget(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={renameSaving || !renameDraft.trim()}
                onClick={saveRenameSession}
              >
                {renameSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
