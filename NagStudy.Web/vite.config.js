import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// W5 lecture: Tailwind via the @tailwindcss/vite plugin (no tailwind.config.js)
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
