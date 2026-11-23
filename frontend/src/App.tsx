import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom, useStore } from "jotai";
import { MotionConfig } from "motion/react";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import { ErrorRuta } from "@/components/error-ruta";
import { RequiereAdmin, RequiereSesion, SoloSinSesion } from "@/components/guardias";
import { CargandoFilas } from "@/components/estados";
import { Marco } from "@/components/marco";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { claves } from "@/consultas";
import { motivoSalidaAtom, sesionAtom } from "@/estado/sesion";
import { escucharSistema, temaAtom } from "@/estado/tema";
import { alPerderSesion, api } from "@/lib/api";
import type { MiAcceso } from "@/lib/tipos";
import { revisarVersion } from "@/lib/version";
import Login from "@/paginas/login";
import MiAccesoPagina from "@/paginas/mi-acceso";
import NoEncontrada from "@/paginas/no-encontrada";

// Páginas que no se ven al entrar: se descargan solo cuando se necesitan.
const Asistente = lazy(() => import("@/paginas/asistente"));
const Resumen = lazy(() => import("@/paginas/resumen"));
const Roles = lazy(() => import("@/paginas/roles"));
const Usuarios = lazy(() => import("@/paginas/usuarios"));
const Inicio = lazy(() => import("@/paginas/inicio"));
const Espacios = lazy(() => import("@/paginas/espacios"));
const MisReservas = lazy(() => import("@/paginas/reservas"));
const AdminReservas = lazy(() => import("@/paginas/admin-reservas"));
const Verificador = lazy(() => import("@/paginas/verificador"));
const Ayuda = lazy(() => import("@/paginas/ayuda"));

const Diferida = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<CargandoFilas className="mt-24" />}>{children}</Suspense>
);

const router = createBrowserRouter([
  {
    element: <SoloSinSesion />,
    errorElement: <ErrorRuta />,
    children: [{ path: "/login", element: <Login /> }],
  },
  {
    element: <RequiereSesion />,
    errorElement: <ErrorRuta />,
    children: [
      {
        element: <Marco />,
        children: [
          { index: true, element: <Navigate to="/inicio" replace /> },
          {
            path: "inicio",
            element: (
              <Diferida>
                <Inicio />
              </Diferida>
            ),
          },
          {
            path: "espacios",
            element: (
              <Diferida>
                <Espacios />
              </Diferida>
            ),
          },
          {
            path: "reservas",
            element: (
              <Diferida>
                <MisReservas />
              </Diferida>
            ),
          },
          {
            path: "ayuda",
            element: (
              <Diferida>
                <Ayuda />
              </Diferida>
            ),
          },
          { path: "mi-acceso", element: <MiAccesoPagina /> },
          {
            path: "asistente",
            element: (
              <Diferida>
                <Asistente />
              </Diferida>
            ),
          },
          {
            path: "admin",
            element: <RequiereAdmin />,
            children: [
              {
                index: true,
                element: (
                  <Diferida>
                    <Resumen />
                  </Diferida>
                ),
              },
              {
                path: "roles",
                element: (
                  <Diferida>
                    <Roles />
                  </Diferida>
                ),
              },
              {
                path: "usuarios",
                element: (
                  <Diferida>
                    <Usuarios />
                  </Diferida>
                ),
              },
              {
                path: "reservas",
                element: (
                  <Diferida>
                    <AdminReservas />
                  </Diferida>
                ),
              },
              {
                path: "verificador",
                element: (
                  <Diferida>
                    <Verificador />
                  </Diferida>
                ),
              },
            ],
          },
          { path: "*", element: <NoEncontrada /> },
        ],
      },
    ],
  },
]);

export default function App() {
  const setSesion = useSetAtom(sesionAtom);
  const setMotivo = useSetAtom(motivoSalidaAtom);
  const clienteQuery = useQueryClient();
  const store = useStore();

  // ¿Ya hay sesión? (la cookie es httpOnly: hay que preguntarle al backend)
  useEffect(() => {
    api<MiAcceso>("/auth/me", { silenciar401: true })
      .then((yo) => {
        clienteQuery.setQueryData(claves.yo, yo);
        setSesion(yo);
      })
      .catch(() => setSesion(null));
  }, [clienteQuery, setSesion]);

  // Si el backend cierra la sesión (desactivado, rol retirado…), volver al inicio con el motivo.
  useEffect(
    () =>
      alPerderSesion((error) => {
        if (store.get(sesionAtom)) setMotivo(error.message);
        setSesion(null);
        clienteQuery.clear();
      }),
    [clienteQuery, setMotivo, setSesion, store],
  );

  useEffect(() => escucharSistema(() => store.get(temaAtom)), [store]);

  // ¿Hay una versión nueva publicada? (al abrir, cada minuto y al volver a la pestaña)
  useEffect(() => {
    void revisarVersion();
    const id = setInterval(revisarVersion, 60_000);
    window.addEventListener("focus", revisarVersion);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", revisarVersion);
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={250}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors={false} closeButton />
      </TooltipProvider>
    </MotionConfig>
  );
}
