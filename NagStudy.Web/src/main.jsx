import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/prototype.css"; // exact prototype design (reused verbatim)
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

// W4: createRoot + StrictMode · W7: BrowserRouter wraps the app
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
