import { profileAvatar } from "../utils/coachProfile";

export default function ProfilePickerModal({ profiles, loading, loadError, onRetry, onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Choose Agent Profile</h3>
        <p className="sub" style={{ marginBottom: 16 }}>
          Pick a coach for this conversation. Switching profile requires a new chat.
        </p>
        {loading && (
          <p className="sub" style={{ marginBottom: 12 }}>Loading profiles…</p>
        )}
        {!loading && loadError && (
          <div style={{ marginBottom: 12 }}>
            <p className="sub" style={{ color: "var(--coral)", marginBottom: 8 }}>{loadError}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>Retry</button>
          </div>
        )}
        {!loading && !loadError && profiles.length === 0 && (
          <p className="sub" style={{ marginBottom: 12 }}>No profiles found. Make sure the API is running, then retry.</p>
        )}
        <div className="char-grid" style={{ marginBottom: 12 }}>
          {profiles.map((p) => (
              <div key={p.id} className="char-card" onClick={() => onSelect(p.id)}>
                <div className="face" style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={profileAvatar(p)} alt="" style={{ height: 56, objectFit: "contain" }} />
                </div>
                <div className="nm">{p.name}</div>
                <div className="ds">{p.description ?? ""}</div>
              </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
