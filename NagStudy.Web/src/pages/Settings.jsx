import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import { listProfiles, updateNagProfile, updateAiNotifications } from "../api/coach";
import { useRef } from "react";
import { useTour } from "../context/useTour";
import introJs from "intro.js";
import "intro.js/introjs.css";

const PW_RULE = /^(?=.*[A-Z])(?=.*[\W_])(?=.*\d).{8,}$/;

export default function Settings() {
    const { user, updateUser } = useAuth();
    const { active, currentPage, endTour } = useTour();
    const tourStartedRef = useRef(false);
    const grid2Ref = useRef(null);

    useEffect(() => {
        if (!active || currentPage !== "settings") return;
        if (!grid2Ref.current) return;
        if (tourStartedRef.current) return;
        tourStartedRef.current = true;

        const intro = introJs();
        intro.setOptions({
            steps: [
                { element: "#settings-profiles", intro: "Update your <b>nickname</b> or change your <b>password</b> here.", title: "Profile & Password" },
                { element: "#settings-ai", intro: "Choose your <b>AI coach personality</b> and toggle automatic nag reminders.", title: "AI Coach Settings" },
            ],
            nextLabel: "Next →", prevLabel: "← Back", doneLabel: "Done! 🎉",
            skipLabel: "Skip tour", showProgress: true, showBullets: false, exitOnOverlayClick: false,
        });
        intro.oncomplete(() => endTour());
        intro.onexit(() => endTour());
        intro.start();
    }, [active, currentPage, grid2Ref.current]);

    const [profiles, setProfiles] = useState([]);
    const [nickname, setNickname] = useState(user?.nickname ?? "");
    const [nickMsg, setNickMsg] = useState({ text: "", ok: false });
    const [savingNick, setSavingNick] = useState(false);
    const [curPw, setCurPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwMsg, setPwMsg] = useState({ text: "", ok: false });
    const [savingPw, setSavingPw] = useState(false);
    const [aiMsg, setAiMsg] = useState({ text: "", ok: false });
    const [notifEnabled, setNotifEnabled] = useState(user?.aiNotificationsEnabled !== false);
    const toastRoot = typeof document !== "undefined" ? document.getElementById("toast-root") : null;

    useEffect(() => {
        listProfiles().then((r) => setProfiles(r.data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (!aiMsg.text) return;
        const t = setTimeout(() => setAiMsg({ text: "", ok: false }), 1200);
        return () => clearTimeout(t);
    }, [aiMsg]);

    async function saveNick() {
        const v = nickname.trim();
        if (!v) { setNickMsg({ text: "Please enter a nickname.", ok: false }); return; }
        setSavingNick(true);
        try {
            const { data } = await api.put("/users/me", { nickname: v });
            setNickname(data.nickname);
            updateUser({ nickname: data.nickname });
            setNickMsg({ text: `✅ Nickname saved as "${data.nickname}".`, ok: true });
        } catch (err) {
            setNickMsg({ text: err.response?.data?.message ?? "Couldn't save your nickname.", ok: false });
        } finally { setSavingNick(false); }
    }

    async function changePw() {
        if (!curPw || !newPw || !confirmPw) { setPwMsg({ text: "Please fill in every field.", ok: false }); return; }
        if (!PW_RULE.test(newPw)) { setPwMsg({ text: "New password needs 8+ characters with an uppercase letter, a number and a special character.", ok: false }); return; }
        if (newPw !== confirmPw) { setPwMsg({ text: "New passwords do not match.", ok: false }); return; }
        setSavingPw(true);
        try {
            await api.put("/users/me/password", { currentPassword: curPw, newPassword: newPw });
            setPwMsg({ text: "✅ Password changed.", ok: true });
            setCurPw(""); setNewPw(""); setConfirmPw("");
        } catch (err) {
            setPwMsg({ text: err.response?.data?.message ?? "Couldn't change your password.", ok: false });
        } finally { setSavingPw(false); }
    }

    async function setNagProfile(profileId) {
        try {
            const { data } = await updateNagProfile(profileId);
            updateUser({ nagProfileId: data.nagProfileId, nagProfileName: data.nagProfileName, nagProfileKey: data.nagProfileKey, aiTone: data.aiTone });
            setAiMsg({ text: "✅ Nag coach profile updated.", ok: true });
        } catch (err) {
            setAiMsg({ text: err.response?.data?.message ?? "Couldn't update profile.", ok: false });
        }
    }

    async function toggleNotif() {
        const next = !notifEnabled;
        setNotifEnabled(next);
        try {
            const { data } = await updateAiNotifications(next);
            updateUser({ aiNotificationsEnabled: data.aiNotificationsEnabled });
        } catch { setNotifEnabled(!next); }
    }

    return (
        <section className="view active" id="view-settings">
            <div className="view-head">
                <h2>⚙️ My Page</h2>
                <p>Profile, password, and AI coach preferences.</p>
            </div>

            <div className="grid-2" ref={grid2Ref} id="settings-profiles">
                <div className="card">
                    <h3>👤 Profile</h3>
                    <div className="set-field">
                        <label htmlFor="set-nickname">Nickname</label>
                        <div className="set-row">
                            <input id="set-nickname" className="set-input" maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />
                            <button type="button" className="btn btn-primary btn-sm" onClick={saveNick} disabled={savingNick}>{savingNick ? "Saving…" : "Save"}</button>
                        </div>
                        {nickMsg.text && <div className="set-msg" style={{ color: nickMsg.ok ? "var(--green)" : "var(--coral)" }}>{nickMsg.text}</div>}
                    </div>
                    <div className="set-field">
                        <label htmlFor="set-email">Email</label>
                        <input id="set-email" className="set-input" value={user?.email ?? ""} disabled />
                    </div>
                </div>

                <div className="card">
                    <h3>🔑 Change password</h3>
                    <div className="set-field">
                        <label htmlFor="set-curpw">Current password</label>
                        <PasswordInput id="set-curpw" className="set-input" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
                    </div>
                    <div className="set-field">
                        <label htmlFor="set-newpw">New password</label>
                        <PasswordInput id="set-newpw" className="set-input" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    </div>
                    <div className="set-field">
                        <label htmlFor="set-confirmpw">Confirm</label>
                        <PasswordInput id="set-confirmpw" className="set-input" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-primary" onClick={changePw} disabled={savingPw}>{savingPw ? "Changing…" : "Change password"}</button>
                    {pwMsg.text && <div className="set-msg" style={{ color: pwMsg.ok ? "var(--green)" : "var(--coral)" }}>{pwMsg.text}</div>}
                </div>
            </div>

            <div className="card" id="settings-ai" style={{ marginTop: 16 }}>
                <h3>🤖 AI Coach settings</h3>
                <p className="sub">Nag reminders use a global profile (separate from chat sessions).</p>
                <div className="set-field">
                    <label>Nag coach profile</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {profiles.map((p) => (
                            <button key={p.id} type="button" className={`btn btn-sm ${user?.nagProfileId === p.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setNagProfile(p.id)}>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="set-field">
                    <label>
                        <input type="checkbox" checked={notifEnabled} onChange={toggleNotif} /> Enable automatic AI nags
                    </label>
                </div>
                {aiMsg.text && toastRoot && createPortal(
                    <div className="toast" style={{ borderLeftColor: aiMsg.ok ? "var(--green)" : "var(--coral)" }}>
                        <div className="ta">{aiMsg.ok ? "✅" : "⚠️"}</div>
                        <div className="tc">
                            <div className="th"><span className="tn2" style={{ color: aiMsg.ok ? "var(--green)" : "var(--coral)" }}>{aiMsg.ok ? "Updated" : "Error"}</span></div>
                            <div className="tx">{aiMsg.text.replace(/^[✅⚠️]\s*/, "")}</div>
                        </div>
                    </div>,
                    toastRoot
                )}
            </div>
        </section>
    );
}