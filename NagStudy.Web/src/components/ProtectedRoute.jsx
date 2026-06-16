import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Route guard (§8.1): no token → /login; wrong role → bounce to the student app.
// Mirrors the backend `[Authorize]` / `[Authorize(Roles="Admin")]` on the client side.
export default function ProtectedRoute({ children, role }) {
  const { isAuthed, user } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/app" replace />;
  return children;
}
