import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],

  // Dev server (local)
  server: {
    host: true,
    port: 5173,
    allowedHosts: [".onrender.com"],
  },

  // Preview server (what you're running on Render)
  preview: {
    host: true,
    allowedHosts: [".onrender.com"],
  },
});
