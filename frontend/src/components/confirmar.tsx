import { CircleAlert, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Confirmación de acciones destructivas. Si el backend las rechaza (p. ej. 409), el motivo se
 *  muestra aquí mismo, sin cerrar el diálogo. */
export function Confirmar({
  abierto,
  alCambiar,
  titulo,
  descripcion,
  textoAccion,
  pendiente,
  error,
  alConfirmar,
  contenido,
  bloqueado,
}: {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  titulo: string;
  descripcion: ReactNode;
  textoAccion: string;
  pendiente: boolean;
  error?: string | null;
  alConfirmar: () => void;
  /** Campos extra (p. ej. el motivo de una cancelación). */
  contenido?: ReactNode;
  /** Deshabilita la acción mientras falten datos. */
  bloqueado?: boolean;
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={(v) => !pendiente && alCambiar(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{descripcion}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {contenido}
        {error && (
          <div
            role="alert"
            className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-3 text-sm"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>{error}</p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>{error ? "Cerrar" : "Cancelar"}</AlertDialogCancel>
          {!error && (
            <Button variant="destructive" onClick={alConfirmar} disabled={pendiente || bloqueado}>
              {pendiente && <Loader2 className="animate-spin" />}
              {textoAccion}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
