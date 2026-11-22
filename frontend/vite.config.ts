import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, /api se reenvía al backend local (igual que nginx en los contenedores).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
});
