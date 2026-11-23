import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Versión de esta compilación: la app la compara con /version.json para avisar si hay una nueva.
const VERSION = new Date().toISOString();
const publicarVersion = (): Plugin => ({
  name: "publicar-version",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: VERSION }) });
  },
});

// En desarrollo, /api se reenvía al backend local (igual que nginx en los contenedores).
export default defineConfig({
  plugins: [react(), tailwindcss(), publicarVersion()],
  define: { __VERSION__: JSON.stringify(VERSION) },
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
