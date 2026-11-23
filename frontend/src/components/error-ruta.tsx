import { RotateCcw } from "lucide-react";
import { Link, useRouteError } from "react-router";

import { Button } from "@/components/ui/button";
import { esErrorDeModulo } from "@/lib/version";

/** Reemplaza la pantalla de error por defecto de React Router con un mensaje claro y cómo seguir. */
export function ErrorRuta() {
  const error = useRouteError();
  const actualizado = esErrorDeModulo(error);
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-5 grid size-28 place-items-center rounded-full bg-muted/70">
          <img src="/img/marca/error.webp" alt="" className="max-h-16 max-w-20 object-contain" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {actualizado ? "El portal se actualizó" : "Algo salió mal en esta página"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {actualizado
            ? "Publicamos una versión nueva mientras tenías el portal abierto. Recarga para seguir."
            : "Recarga la página. Si el problema continúa, escríbele a la mesa de ayuda."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw /> Recargar
          </Button>
          {!actualizado && (
            <Button asChild variant="outline">
              <Link to="/inicio" reloadDocument>
                Ir al inicio
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
