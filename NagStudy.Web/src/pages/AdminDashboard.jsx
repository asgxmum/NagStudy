import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { adminUsers as seedUsers } from "../data/mock";

// Ported from NagStudy.html #screen-admin + renderAdmUsers()/admBan()/admDel().
// Standalone full-screen — role-gated by ProtectedRoute role="Admin" (§8.1).
// Single school: no university/domain management. TODO: api/admin.

const STATS = [
  { label: "👥 Total users", value: "1,284", delta: "▲ +63 this week", deltaCls: "up" },
  { label: "🟢 Active this week", value: "812", delta: "63% of users", deltaCls: "flat" },
  { label: "⏱️ Focus logged", value: "9,940h", delta: "▲ all-time", deltaCls: "up" },
  { label: "🏫 School", value: "XMU Malaysia", delta: "single campus", deltaCls: "flat", small: true },
];

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState(seedUsers);

  function handleLogout() {
    logout();
    navigate("/"); // back to the public landing (it shows the logged-out nav)
  }

  // Ban <-> Unban toggle. TODO: api/admin — PATCH /api/admin/users/{id}/status
  function toggleBan(id) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "Banned" ? "Active" : "Banned" } : u
      )
    );
  }

  // Remove the account. TODO: api/admin — DELETE /api/admin/users/{id}
  function deleteUser(id) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="screen ap active" id="screen-admin">
      <header className="admin-top">
        <div className="admin-brand" title="Log out" onClick={handleLogout}>
          <span className="nag">Nag</span>Study <b>ADMIN</b>
        </div>
        <div className="admin-who">
          👑 swe310admin@nagstudy.app
          <button className="admin-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="admin-main">
        <div className="view-head">
          <h2>Admin dashboard</h2>
          <p>Operate the platform — stats and users.</p>
        </div>

        {/* Stat cards */}
        <div className="grid-stats">
          {STATS.map((s) => (
            <div className="stat" key={s.label}>
              <div className="lbl">{s.label}</div>
              <div className="val" style={s.small ? { fontSize: "19px" } : undefined}>
                {s.value}
              </div>
              <div className={`delta ${s.deltaCls}`}>{s.delta}</div>
            </div>
          ))}
        </div>

        {/* User management */}
        <div className="card">
          <h3>
            👤 User management <span className="sub">ban or remove accounts</span>
          </h3>
          <table className="sess-table adm-table">
            <thead>
              <tr>
                <th>Nickname</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="admUsers">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="nm">{u.nick}</td>
                  <td>
                    <span className={`adm-badge ${u.status === "Banned" ? "banned" : "active"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="adm-act" onClick={() => toggleBan(u.id)}>
                      {u.status === "Banned" ? "Unban" : "Ban"}
                    </button>
                    <button className="adm-act danger" onClick={() => deleteUser(u.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
