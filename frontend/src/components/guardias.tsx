import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { toast } from "sonner";

import { Marca } from "@/components/marca";
import { esAdminAtom, sesionAtom } from "@/estado/sesion";

export function PantallaCarga() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <Marca className="size-10 animate-pulse" />
        <p className="text-sm text-muted-foreground">Cargando el portal…</p>
      </div>
    </div>
  );
}

/** Solo con sesión. Sin sesión → inicio de sesión (recordando a dónde quería ir). */
export function RequiereSesion() {
  const sesion = useAtomValue(sesionAtom);
  const ubicacion = useLocation();
  if (sesion === undefined) return <PantallaCarga />;
  if (sesion === null) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  return <Outlet />;
}

/** Solo ADMINISTRADOR. Un CONSULTANTE que escribe la ruta vuelve a Mi acceso.
 *  (Esto es solo comodidad: el backend responde 403 de todas formas.) */
export function RequiereAdmin() {
  const esAdmin = useAtomValue(esAdminAtom);
  useEffect(() => {
    if (!esAdmin) toast.info("Esa sección es solo para administradores. Te llevamos a Mi acceso.");
  }, [esAdmin]);
  if (!esAdmin) return <Navigate to="/mi-acceso" replace />;
  return <Outlet />;
}

/** Quien ya tiene sesión no necesita ver el inicio de sesión. */
export function SoloSinSesion() {
  const sesion = useAtomValue(sesionAtom);
  if (sesion === undefined) return <PantallaCarga />;
  if (sesion) return <Navigate to="/inicio" replace />;
  return <Outlet />;
}
