import { AlertTriangle, RotateCcw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mensaje } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Lista vacía: explica qué falta y, si aplica, ofrece la acción para resolverlo. */
export function Vacio({
  icono: Icono,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icono className="size-5" />
      </div>
      <p className="font-medium">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-balance text-muted-foreground">{descripcion}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

/** Algo falló al cargar: muestra el motivo y permite reintentar. */
export function ErrorCarga({
  error,
  reintentar,
  className,
}: {
  error: unknown;
  reintentar?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle className="mb-3 size-6 text-destructive" />
      <p className="font-medium">No pudimos cargar esta información</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{mensaje(error)}</p>
      {reintentar && (
        <Button variant="outline" size="sm" className="mt-5" onClick={reintentar}>
          <RotateCcw /> Reintentar
        </Button>
      )}
    </div>
  );
}

/** Esqueleto de filas mientras llegan los datos. */
export function CargandoFilas({ filas = 5, className }: { filas?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border px-4 py-3.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
