import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarX2, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { avisosQuery, useMarcarAvisosLeidos } from "@/consultas";
import type { Aviso } from "@/lib/tipos";

export function TarjetaAviso({ a }: { a: Aviso }) {
  return (
    <div className="flex gap-3">
      <div className="relative shrink-0">
        <img src={`/img/espacios/${a.espacio_codigo}.webp`} alt="" className="size-11 rounded-lg object-cover" />
        <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-destructive text-white ring-2 ring-popover">
          <CalendarX2 className="size-3" />
        </span>
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{a.titulo}</p>
        <p className="text-muted-foreground">{a.detalle}</p>
        {a.motivo && (
          <p className="mt-1.5 rounded-md bg-muted px-2 py-1.5 text-xs">
            <span className="font-medium">Motivo:</span> {a.motivo}
            {a.por && <span className="text-muted-foreground"> — {a.por}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

/** Campanita de la barra superior: avisos de reservas canceladas por un administrador. */
export function Notificaciones() {
  const { data } = useQuery(avisosQuery);
  const leer = useMarcarAvisosLeidos();
  const navegar = useNavigate();
  const vistos = useRef<Set<number> | null>(null);
  const avisos = data ?? [];

  // Aviso emergente cuando llega uno nuevo (no en la primera carga si ya estaban).
  useEffect(() => {
    if (!data) return;
    if (vistos.current === null) {
      vistos.current = new Set(data.map((a) => a.id));
      if (data.length)
        toast.warning(
          data.length === 1
            ? "Un administrador canceló una de tus reservas"
            : `Cancelaron ${data.length} de tus reservas`,
          {
            description: "Revisa el motivo en las notificaciones.",
            action: { label: "Ver", onClick: () => navegar("/reservas") },
          },
        );
      return;
    }
    for (const a of data) {
      if (!vistos.current.has(a.id)) {
        vistos.current.add(a.id);
        toast.warning(a.titulo, { description: a.motivo ?? a.detalle });
      }
    }
  }, [data, navegar]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={avisos.length ? `Notificaciones: ${avisos.length} sin leer` : "Notificaciones"}
          className="relative grid size-9 place-items-center rounded-lg text-header-muted transition-colors hover:bg-white/10 hover:text-header-foreground"
        >
          <Bell className="size-[1.1rem]" />
          <AnimatePresence>
            {avisos.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.62rem] font-bold text-white ring-2 ring-header"
              >
                {avisos.length}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">Notificaciones</p>
          {avisos.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => leer.mutate()} disabled={leer.isPending}>
              <Check /> Entendido
            </Button>
          )}
        </div>
        {avisos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No tienes notificaciones nuevas.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {avisos.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <TarjetaAviso a={a} />
              </li>
            ))}
          </ul>
        )}
        <div className="border-t px-4 py-2.5">
          <Link to="/reservas" viewTransition className="text-sm font-medium text-brand hover:underline">
            Ver mis reservas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
