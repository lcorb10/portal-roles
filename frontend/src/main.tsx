import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ApiError } from "@/lib/api";

import App from "./App";

const clienteQuery = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      // No reintentar errores que no van a cambiar (sesión, permisos, validación).
      retry: (intentos, error) =>
        !(error instanceof ApiError && error.estado >= 400 && error.estado < 500) && intentos < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
