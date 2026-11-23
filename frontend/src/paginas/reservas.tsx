import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock, MapPin, Users, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Confirmar } from "@/components/confirmar";
import { Encabezado } from "@/components/encabezado";
import { CargandoFilas, ErrorCarga, Vacio } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { misReservasQuery, reglasQuery, useCancelarReserva } from "@/consultas";
import { mensaje } from "@/lib/api";
import { cuando, hoyLocal, nombreDia, numeroDia, rangoHoras } from "@/lib/fechas";
import type { Reserva } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function FilaReserva({
  r,
  hoy,
  alCancelar,
  mostrarPersona,
  indice = 0,
}: {
  r: Reserva;
  hoy: string;
  alCancelar?: () => void;
  mostrarPersona?: boolean;
  indice?: number;
}) {
  const cancelada = r.estado === "CANCELADA";
  const pasada = r.fecha < hoy;
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(indice * 0.03, 0.2) }}
      className={cn("tarjeta flex items-stretch gap-4 overflow-hidden p-3 pr-4", (cancelada || pasada) && "opacity-70")}
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted">
        <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase">{nombreDia(r.fecha)}</span>
        <span className="text-xl font-bold tabular-nums">{numeroDia(r.fecha)}</span>
      </div>
      <img
        src={`/img/espacios/${r.espacio_codigo}.webp`}
        alt=""
        className="hidden w-24 shrink-0 rounded-xl object-cover sm:block"
      />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("font-semibold tracking-tight", cancelada && "line-through")}>{r.espacio}</p>
          {cancelada ? (
            <Badge variant="outline" className="text-muted-foreground">
              Cancelada{r.cancelada_por && r.cancelada_por !== r.usuario ? ` por ${r.cancelada_por}` : ""}
            </Badge>
          ) : pasada ? (
            <Badge variant="secondary">Realizada</Badge>
          ) : (
            <Badge className="bg-success-soft text-success">{cuando(r.fecha, hoy)}</Badge>
          )}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {rangoHoras(r.hora_inicio, r.hora_fin)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {r.ubicacion}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {r.asistentes}
          </span>
        </p>
        <p className="mt-1 truncate text-sm">
          {mostrarPersona && (
            <span className="mr-1.5 font-medium">
              {r.nombre_usuario} <span className="font-mono text-xs text-muted-foreground">({r.usuario})</span> ·
            </span>
          )}
          <span className="text-muted-foreground">{r.motivo}</span>
        </p>
      </div>
      {alCancelar && !cancelada && !pasada && (
        <Button
          variant="ghost"
          size="sm"
          onClick={alCancelar}
          className="self-center text-muted-foreground hover:text-destructive"
          aria-label={`Cancelar reserva de ${r.espacio}`}
        >
          <X /> <span className="hidden sm:inline">Cancelar</span>
        </Button>
      )}
    </motion.li>
  );
}

export function useConfirmarCancelacion() {
  const cancelar = useCancelarReserva();
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogo = (
    <Confirmar
      abierto={!!reserva}
      alCambiar={(v) => !v && setReserva(null)}
      titulo="¿Cancelar la reserva?"
      descripcion={
        reserva && (
          <p>
            {reserva.espacio}, {rangoHoras(reserva.hora_inicio, reserva.hora_fin)}. El horario queda libre para otras
            personas.
          </p>
        )
      }
      textoAccion="Cancelar reserva"
      pendiente={cancelar.isPending}
      error={error}
      alConfirmar={() =>
        reserva &&
        cancelar.mutate(reserva.id, {
          onSuccess: () => {
            toast.success("Reserva cancelada");
            setReserva(null);
          },
          onError: (e) => setError(mensaje(e)),
        })
      }
    />
  );
  return {
    pedir: (r: Reserva) => {
      setError(null);
      setReserva(r);
    },
    dialogo,
  };
}

export default function MisReservas() {
  const { data, isPending, error, refetch } = useQuery(misReservasQuery);
  const reglas = useQuery(reglasQuery);
  const { pedir, dialogo } = useConfirmarCancelacion();
  const hoy = reglas.data?.hoy ?? hoyLocal();

  const proximas = (data ?? [])
    .filter((r) => r.estado === "ACTIVA" && r.fecha >= hoy)
    .sort((a, b) =>
      (a.fecha + String(a.hora_inicio).padStart(2, "0")).localeCompare(
        b.fecha + String(b.hora_inicio).padStart(2, "0"),
      ),
    );
  const historial = (data ?? []).filter((r) => !proximas.includes(r));

  return (
    <>
      <Encabezado
        antetitulo="Espacios del campus"
        titulo="Mis reservas"
        descripcion={
          reglas.data
            ? `Puedes tener hasta ${reglas.data.max_reservas} reservas pendientes. Cancela las que no vayas a usar para liberar el horario.`
            : undefined
        }
        acciones={
          <Button asChild>
            <Link to="/espacios" viewTransition>
              <CalendarPlus /> Nueva reserva
            </Link>
          </Button>
        }
      />

      {isPending ? (
        <CargandoFilas filas={3} />
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => refetch()} />
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Próximas · {proximas.length}
          </h2>
          {proximas.length === 0 ? (
            <Vacio
              titulo="No tienes reservas pendientes"
              descripcion="Reserva una sala, un laboratorio o el coliseo según tus roles."
              accion={
                <Button asChild>
                  <Link to="/espacios" viewTransition>
                    Ver espacios
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {proximas.map((r, i) => (
                <FilaReserva key={r.id} r={r} hoy={hoy} indice={i} alCancelar={() => pedir(r)} />
              ))}
            </ul>
          )}

          {historial.length > 0 && (
            <>
              <h2 className="mt-10 mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Historial
              </h2>
              <ul className="space-y-3">
                {historial.map((r, i) => (
                  <FilaReserva key={r.id} r={r} hoy={hoy} indice={i} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {dialogo}
    </>
  );
}
