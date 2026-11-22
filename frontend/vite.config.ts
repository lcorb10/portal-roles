import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, /api se reenvía al backend local (igual que nginx en los contenedores).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  server: {
    proxy: { "/api": "http://localhost:8000" },
  },
  build: {
    rolldownOptions: {
      output: {
        // Librerías en archivos propios: cambian poco y el navegador las guarda en caché.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\/](react|react-dom|react-router|scheduler)[\/]/ },
            { name: "datos", test: /node_modules[\/](@tanstack|jotai)[\/]/ },
            { name: "animacion", test: /node_modules[\/](motion|motion-dom|motion-utils|framer-motion)[\/]/ },
            { name: "interfaz", test: /node_modules[\/](radix-ui|@radix-ui|cmdk|sonner|lucide-react|@floating-ui)[\/]/ },
          ],
        },
      },
    },
  },
});
