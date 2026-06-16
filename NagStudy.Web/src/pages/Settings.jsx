import { useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";

// My Page — nickname + password, wired to /api/users/me (email + school are locked).

// Same policy as registration: 8+ chars with an uppercase letter, a digit and a special character.
const PW_RULE = /^(?=.*[A-Z])(?=.*[\W_])(?=.*\d).{8,}$/;

export default function Settings() {
  const { user, updateUser } = useAuth();

  // Profile — nickname is editable, email + school are locked.
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [nickMsg, setNickMsg] = useState({ text: "", ok: false });
  const [savingNick, setSavingNick] = useState(false);

  // Password change form.
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });
  const [savingPw, setSavingPw] = useState(false);

  async function saveNick() {
    const v = nickname.trim();
    if (!v) {
      setNickMsg({ text: "Please enter a nickname.", ok: false });
      return;
    }
    setSavingNick(true);
    try {
      const { data } = await api.put("/users/me", { nickname: v });
      setNickname(data.nickname);
      updateUser({ nickname: data.nickname }); // refresh the navbar / ranking name
      setNickMsg({ text: `✅ Nickname saved as "${data.nickname}".`, ok: true });
    } catch (err) {
      setNickMsg({ text: err.response?.data?.message ?? "Couldn't save your nickname.", ok: false });
    } finally {
      setSavingNick(false);
    }
  }

  async function changePw() {
    if (!curPw || !newPw || !confirmPw) {
      setPwMsg({ text: "Please fill in every field.", ok: false });
      return;
    }
    if (!PW_RULE.test(newPw)) {
      setPwMsg({ text: "New password needs 8+ characters with an uppercase letter, a number and a special character.", ok: false });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: "New passwords do not match.", ok: false });
      return;
    }
    setSavingPw(true);
    try {
      await api.put("/users/me/password", { currentPassword: curPw, newPassword: newPw });
      setPwMsg({ text: "✅ Password changed.", ok: true });
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwMsg({ text: err.response?.data?.message ?? "Couldn't change your password.", ok: false });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <section className="view active" id="view-settings">
      <div className="view-head">
        <h2>⚙️ My Page</h2>
        <p>Change your nickname and password. Your email is locked because it's your school login ID.</p>
      </div>

      <div className="grid-2">
        {/* Profile card */}
        <div className="card">
          <h3>👤 Profile</h3>

          <div className="set-field">
            <label htmlFor="set-nickname">
              Nickname <span className="set-mini">(shown on the ranking)</span>
            </label>
            <div className="set-row">
              <input
                id="set-nickname"
                className="set-input"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={saveNick} disabled={savingNick}>
                {savingNick ? "Saving…" : "Save"}
              </button>
            </div>
            {nickMsg.text && (
              <div className="set-msg" style={{ color: nickMsg.ok ? "var(--green)" : "var(--coral)" }}>
                {nickMsg.text}
              </div>
            )}
          </div>

          <div className="set-field">
            <label htmlFor="set-email">
              Email <span className="set-lock">🔒 locked</span>
            </label>
            <input id="set-email" className="set-input" value={user?.email ?? ""} disabled />
            <p className="set-note">
              🔒 email is your <b>school + login ID</b> — can't change. Contact an admin if you need it updated.
            </p>
          </div>

          <div className="set-field">
            <label>School</label>
            <div className="set-input" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--txt2)" }}>
              <img src="/Xiamen_University_logo.svg" alt="Xiamen University Malaysia" style={{ height: 24, width: "auto" }} />
              Xiamen University Malaysia
            </div>
          </div>
        </div>

        {/* Password card */}
        <div className="card">
          <h3>🔑 Change password</h3>

          <div className="set-field">
            <label htmlFor="set-curpw">Current password</label>
            <PasswordInput
              id="set-curpw"
              className="set-input"
              placeholder="••••••••"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
            />
          </div>
          <div className="set-field">
            <label htmlFor="set-newpw">New password</label>
            <PasswordInput
              id="set-newpw"
              className="set-input"
              placeholder="8+ chars, 1 uppercase, 1 number, 1 symbol"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </div>
          <div className="set-field">
            <label htmlFor="set-confirmpw">Confirm new password</label>
            <PasswordInput
              id="set-confirmpw"
              className="set-input"
              placeholder="Re-enter your password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={changePw} disabled={savingPw}>
            {savingPw ? "Changing…" : "Change password"}
          </button>

          {pwMsg.text && (
            <div className="set-msg" style={{ color: pwMsg.ok ? "var(--green)" : "var(--coral)" }}>
              {pwMsg.text}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
