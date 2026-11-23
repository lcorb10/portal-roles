import { RotateCcw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mensaje } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Ilustraciones de estados (generadas con Gemini, fondo transparente). */
export type Ilustracion = "vacio" | "sin-resultados" | "error" | "no-encontrada";

function Dibujo({ nombre, className }: { nombre: Ilustracion; className?: string }) {
  return (
    <div
      className={cn("mb-5 grid size-28 place-items-center rounded-full bg-muted/70 dark:bg-white/[0.06]", className)}
    >
      <img src={`/img/marca/${nombre}.webp`} alt="" className="max-h-16 max-w-20 object-contain" loading="lazy" />
    </div>
  );
}

/** Lista vacía: explica qué falta y, si aplica, ofrece la acción para resolverlo. */
export function Vacio({
  icono: Icono,
  ilustracion = "vacio",
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono?: LucideIcon;
  ilustracion?: Ilustracion;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center",
        className,
      )}
    >
      {Icono ? (
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icono className="size-5" />
        </div>
      ) : (
        <Dibujo nombre={ilustracion} />
      )}
      <p className="font-semibold tracking-tight">{titulo}</p>
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
        "flex flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/[0.04] px-6 py-10 text-center",
        className,
      )}
    >
      <Dibujo nombre="error" className="bg-destructive/[0.07]" />
      <p className="font-semibold tracking-tight">No pudimos cargar esta información</p>
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
        <div key={i} className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5">
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
