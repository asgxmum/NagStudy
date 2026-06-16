import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Pomodoro from "./pages/Pomodoro";
import Coach from "./pages/Coach";
import Ranking from "./pages/Ranking";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

// W7: BrowserRouter (in main.jsx) > Routes > Route. Student app nested under /app with the sidebar layout.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Student app — JWT-protected, shares the AppLayout sidebar */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="pomodoro" element={<Pomodoro />} />
        <Route path="coach" element={<Coach />} />
        <Route path="ranking" element={<Ranking />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Admin — role-gated (§8.1) */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="Admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
