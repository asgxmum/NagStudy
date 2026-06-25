import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client"; // Import the configured Axios client

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  // State for user list
  const [users, setUsers] = useState([]);
  
  // State for dashboard statistics
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    activePercentage: 0,
    totalFocusHours: 0
  });

  function handleLogout() {
    logout();
    navigate("/"); // back to the public landing
  }

  // Fetch real users from the backend API
  const fetchUsers = async () => {
    try {
      const res = await client.get("/admin/users");
      // Filter out 'Deleted' users according to the strict state guidelines
      const activeAndBannedUsers = res.data.filter(u => u.status !== "Deleted");
      setUsers(activeAndBannedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  // Fetch real statistics from the backend API
  const fetchStats = async () => {
    try {
      const res = await client.get("/admin/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  // Fetch both users and stats once on component mount
  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  // Toggle user ban status via API
  async function toggleBan(user) {
    const newStatus = user.status === "Banned" ? "Active" : "Banned";
    try {
      await client.put(`/admin/users/${user.id}/status`, { status: newStatus });
      fetchUsers(); // Refresh the list
      fetchStats(); // Refresh the stats (Active count might have changed)
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update user status. Please try again.");
    }
  }

  // Soft delete user via API
  async function deleteUser(id) {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    try {
      await client.put(`/admin/users/${id}/status`, { status: "Deleted" });
      fetchUsers(); // Refresh the list, the deleted user should disappear
      fetchStats(); // Refresh the stats (Total and Active count might have changed)
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Failed to delete user. Please try again.");
    }
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

        {/* Dynamic Stat cards */}
        <div className="grid-stats">
          <div className="stat">
            <div className="lbl">👥 Total users</div>
            <div className="val">{stats.totalUsers}</div>
            <div className="delta flat">Registered students</div>
          </div>

          <div className="stat">
            <div className="lbl">🟢 Active accounts</div>
            <div className="val">{stats.activeUsers}</div>
            <div className="delta up">{stats.activePercentage}% of users</div>
          </div>

          <div className="stat">
            <div className="lbl">⏱️ Focus logged</div>
            <div className="val">{stats.totalFocusHours}h</div>
            <div className="delta up">▲ all-time</div>
          </div>

          <div className="stat">
            <div className="lbl">🏫 School</div>
            <div className="val" style={{ fontSize: "19px" }}>XMU Malaysia</div>
            <div className="delta flat">Single campus</div>
          </div>
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
                  <td className="nm">{u.nickname}</td>
                  <td>
                    <span className={`adm-badge ${u.status === "Banned" ? "banned" : "active"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="adm-act" onClick={() => toggleBan(u)}>
                      {u.status === "Banned" ? "Unban" : "Ban"}
                    </button>
                    <button className="adm-act danger" onClick={() => deleteUser(u.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {/* Show loading state when array is empty */}
              {users.length === 0 && (
                <tr>
                  <td colSpan="3" style={{ textAlign: "center", padding: "20px", color: "#888" }}>
                    Loading user data...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}