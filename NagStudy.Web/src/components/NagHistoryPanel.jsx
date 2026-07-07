import { useState, useEffect } from "react";
import { listNags } from "../api/coach";
import CoachMessageBody from "./CoachMessageBody";

export default function NagHistoryPanel({ onClose }) {
  const [nags, setNags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listNags()
      .then((res) => setNags(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="nag-panel">
      <div className="nag-panel-head">
        <strong>Nag history</strong>
        <span className="sub">{nags.length ? `${nags.length} total` : ""}</span>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onClose}>✕</button>
      </div>
      <div className="nag-panel-body">
        {loading && <p className="sub">Loading…</p>}
        {!loading && nags.length === 0 && (
          <p className="sub">No nags yet — your coach will pop up when you need a push.</p>
        )}
        {nags.map((n) => (
          <div key={n.id} className="nag-item">
            <div className="nag-item-meta">
              <span>{n.trigger}</span>
              <span>{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <div className="nag-item-text"><CoachMessageBody content={n.content} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
