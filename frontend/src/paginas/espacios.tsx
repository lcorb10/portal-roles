import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2, Check, CircleAlert, Loader2, Lock, MapPin, Search, Settings2, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useAtomValue } from "jotai";
import { toast } from "sonner";

import { Encabezado } from "@/components/encabezado";
import { ErrorCarga, Vacio } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { esAdminAtom } from "@/estado/sesion";
import { disponibilidadQuery, espaciosQuery, reglasQuery, useReservar } from "@/consultas";
import { mensaje } from "@/lib/api";
import { fechaLarga, hora, horaLocal, nombreDia, numeroDia, rangoHoras, sumarDias } from "@/lib/fechas";
import { normalizar } from "@/lib/normalizar";
import type { Espacio, ReglasReserva } from "@/lib/tipos";
import { cn } from "@/lib/utils";

// ── Tarjeta ───────────────────────────────────────────────────────────────────────────────

function Tarjeta({ e, alAbrir, indice }: { e: Espacio; alAbrir: () => void; indice: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(indice * 0.04, 0.24) }}
      className={cn("group tarjeta flex flex-col overflow-hidden", !e.activo && "opacity-70")}
    >
      <button type="button" onClick={alAbrir} className="relative aspect-[16/10] overflow-hidden text-left">
        <img
          src={`/img/espacios/${e.codigo}.webp`}
          alt={`Foto de ${e.nombre}`}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span
          className={cn(
            "absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-md",
            e.puede_reservar ? "bg-white/90 text-[#1f6b45]" : "bg-[#1a1716]/80 text-white",
          )}
        >
          {e.puede_reservar ? <Check className="size-3.5" /> : <Lock className="size-3.5" />}
          {e.puede_reservar ? "Disponible para ti" : e.activo ? "No disponible con tus roles" : "Deshabilitado"}
        </span>
        <span className="absolute right-3 bottom-3 rounded-md bg-[#1a1716]/75 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-md">
          {e.tipo}
        </span>
      </button>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold tracking-tight">{e.nombre}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" /> {e.ubicacion}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {e.capacidad}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {e.roles_permitidos.map((r) => (
            <span
              key={r}
              className={cn(
                "rounded-md border px-1.5 py-0.5 font-mono text-[0.68rem]",
                e.habilitado_por.includes(r) && "border-success/40 bg-success-soft text-success",
              )}
            >
              {r}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <Button
            onClick={alAbrir}
            variant={e.puede_reservar ? "default" : "outline"}
            className="w-full"
            aria-label={`${e.puede_reservar ? "Reservar" : "Ver"} ${e.nombre}`}
          >
            {e.puede_reservar ? (
              <>
                <CalendarCheck2 /> Ver horarios y reservar
              </>
            ) : (
              "Ver horarios"
            )}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

// ── Planificador de la reserva ────────────────────────────────────────────────────────────

function Planificador({ e, reglas }: { e: Espacio; reglas: ReglasReserva }) {
  const esAdmin = useAtomValue(esAdminAtom);
  const [fecha, setFecha] = useState(reglas.hoy);
  const [inicio, setInicio] = useState<number | null>(null);
  const [fin, setFin] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [asistentes, setAsistentes] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const disp = useQuery(disponibilidadQuery(e.id, fecha));
  const reservar = useReservar();

  const dias = useMemo(() => Array.from({ length: 14 }, (_, i) => sumarDias(reglas.hoy, i)), [reglas.hoy]);
  const horas = Array.from({ length: reglas.hora_cierre - reglas.hora_apertura }, (_, i) => reglas.hora_apertura + i);
  const horaActual = horaLocal();

  const ocupada = (h: number) => disp.data?.ocupadas.find((o) => h >= o.hora_inicio && h < o.hora_fin);
  const pasada = (h: number) => fecha === reglas.hoy && h <= horaActual;
  const libre = (h: number) => !ocupada(h) && !pasada(h);

  function elegir(h: number) {
    setError(null);
    if (!e.puede_reservar || !libre(h)) return;
    if (inicio === null || fin !== null || h < inicio) {
      setInicio(h);
      setFin(null);
      return;
    }
    // segundo clic: cerrar el rango si es contiguo, libre y no supera el máximo
    const tramo = Array.from({ length: h - inicio + 1 }, (_, i) => inicio + i);
    if (tramo.length > reglas.max_horas) return setError(`Máximo ${reglas.max_horas} horas por reserva.`);
    if (!tramo.every(libre)) return setError("El rango incluye horas ocupadas.");
    setFin(h + 1);
  }

  const desde = inicio;
  const hasta = fin ?? (inicio !== null ? inicio + 1 : null);
  const enRango = (h: number) => desde !== null && hasta !== null && h >= desde && h < hasta;

  function cambiarFecha(f: string) {
    setFecha(f);
    setInicio(null);
    setFin(null);
    setError(null);
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (desde === null || hasta === null) return;
    setError(null);
    reservar.mutate(
      {
        espacio_id: e.id,
        fecha,
        hora_inicio: desde,
        hora_fin: hasta,
        motivo: motivo.trim(),
        asistentes: Number(asistentes) || 1,
      },
      {
        onSuccess: () => {
          toast.success(`Reservaste ${e.nombre}`, {
            description: `${fechaLarga(fecha)} · ${rangoHoras(desde, hasta)}`,
          });
          setInicio(null);
          setFin(null);
          setMotivo("");
        },
        onError: (err) => setError(mensaje(err)),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">Día</p>
        <div className="-mx-1 flex [scrollbar-width:thin] gap-1.5 overflow-x-auto px-1 pb-1">
          {dias.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => cambiarFecha(d)}
              className={cn(
                "flex w-12 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors",
                d === fecha
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:border-foreground/25",
              )}
            >
              <span className="text-[0.65rem] font-medium uppercase opacity-70">{nombreDia(d)}</span>
              <span className="text-base font-semibold tabular-nums">{numeroDia(d)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium first-letter:uppercase">{fechaLarga(fecha)}</p>
          {disp.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {horas.map((h) => {
            const o = ocupada(h);
            const p = pasada(h);
            const sel = enRango(h);
            return (
              <button
                key={h}
                type="button"
                disabled={!e.puede_reservar || !!o || p}
                onClick={() => elegir(h)}
                aria-pressed={sel}
                className={cn(
                  "flex h-11 flex-col items-start justify-center rounded-lg border px-2.5 text-left text-xs transition-colors",
                  sel && "border-brand bg-brand text-brand-foreground",
                  !sel && !o && !p && "bg-card hover:border-brand/50 hover:bg-brand-soft",
                  o?.propia && "border-success/40 bg-success-soft text-success",
                  o &&
                    !o.propia &&
                    "border-transparent bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)] text-muted-foreground",
                  p && !o && "text-muted-foreground/50",
                  "disabled:cursor-not-allowed",
                )}
              >
                <span className="font-semibold tabular-nums">{hora(h)}</span>
                <span className="truncate opacity-80">
                  {o
                    ? o.propia
                      ? "Tu reserva"
                      : o.por
                        ? `Ocupado · ${o.por}`
                        : "Ocupado"
                    : p
                      ? "Pasó"
                      : sel
                        ? "Elegido"
                        : "Libre"}
                </span>
              </button>
            );
          })}
        </div>
        {e.puede_reservar && (
          <p className="mt-2 text-xs text-muted-foreground">
            Toca la hora de inicio y luego la última hora que necesitas (máximo {reglas.max_horas} horas).
          </p>
        )}
      </div>

      {e.puede_reservar ? (
        <form onSubmit={enviar} className="space-y-4 rounded-2xl border bg-muted/40 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo</Label>
              <Input
                id="motivo"
                value={motivo}
                onChange={(x) => setMotivo(x.target.value)}
                placeholder="Ej.: Estudio para el parcial de cálculo"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asistentes">Personas</Label>
              <Input
                id="asistentes"
                type="number"
                min={1}
                max={e.capacidad}
                value={asistentes}
                onChange={(x) => setAsistentes(x.target.value)}
              />
            </div>
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
                className="flex items-start gap-2 overflow-hidden text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={desde === null || motivo.trim().length < 3 || reservar.isPending}
          >
            {reservar.isPending && <Loader2 className="animate-spin" />}
            {desde !== null && hasta !== null ? `Reservar ${rangoHoras(desde, hasta)}` : "Elige un horario"}
          </Button>
        </form>
      ) : (
        <div className="flex gap-3 rounded-2xl border border-dashed p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">No puedes reservar este espacio</p>
            <p className="mt-0.5 text-muted-foreground">{e.motivo}</p>
            {esAdmin && (
              <p className="mt-2 text-xs text-muted-foreground">
                El perfil de administrador no habilita reservas: lo deciden los roles. Puedes cambiar qué roles
                habilitan este espacio en{" "}
                <Link to="/admin/reservas" className="font-medium text-brand hover:underline">
                  Reservas y espacios
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detalle({ e, reglas, alCerrar }: { e: Espacio | null; reglas?: ReglasReserva; alCerrar: () => void }) {
  return (
    <Sheet open={!!e} onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent className="w-full overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        {e && (
          <>
            <div className="relative aspect-[16/8] w-full shrink-0 overflow-hidden">
              <img src={`/img/espacios/${e.codigo}.webp`} alt="" className="size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <SheetHeader className="absolute inset-x-0 bottom-0 p-5 text-white">
                <p className="text-xs font-semibold tracking-[0.12em] text-[#ffcd00] uppercase">{e.tipo}</p>
                <SheetTitle className="text-2xl font-bold tracking-tight text-white">{e.nombre}</SheetTitle>
                <SheetDescription className="flex items-center gap-3 text-white/80">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {e.ubicacion}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {e.capacidad} personas
                  </span>
                </SheetDescription>
              </SheetHeader>
            </div>
            <div className="space-y-6 p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{e.descripcion}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Lo pueden reservar:</span>
                {e.roles_permitidos.map((r) => (
                  <span
                    key={r}
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-mono text-xs",
                      e.habilitado_por.includes(r) && "border-success/40 bg-success-soft text-success",
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
              {reglas ? <Planificador e={e} reglas={reglas} /> : <Skeleton className="h-72 rounded-2xl" />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────────────────

type Filtro = "todos" | "mios";

export default function Espacios() {
  const { data, isPending, error, refetch } = useQuery(espaciosQuery);
  const reglas = useQuery(reglasQuery);
  const esAdmin = useAtomValue(esAdminAtom);
  const [params, setParams] = useSearchParams();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");

  const verId = Number(params.get("ver")) || null;
  const abierto = data?.find((e) => e.id === verId) ?? null;
  const abrir = (id: number | null) => setParams(id ? { ver: String(id) } : {}, { replace: true });

  const lista = (data ?? []).filter(
    (e) =>
      (filtro === "todos" || e.puede_reservar) &&
      (!busqueda || normalizar(`${e.nombre} ${e.tipo} ${e.ubicacion}`).includes(normalizar(busqueda))),
  );
  const cuantosMios = (data ?? []).filter((e) => e.puede_reservar).length;

  return (
    <>
      <Encabezado
        antetitulo="Espacios del campus"
        titulo="Reserva un espacio"
        acciones={
          esAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin/reservas" viewTransition>
                <Settings2 /> Gestionar espacios
              </Link>
            </Button>
          )
        }
        descripcion={
          reglas.data
            ? `Tus roles deciden qué puedes reservar. Horario de ${hora(reglas.data.hora_apertura)} a ${hora(reglas.data.hora_cierre)}, hasta ${reglas.data.max_horas} horas por reserva y ${reglas.data.dias_adelante} días adelante.`
            : "Tus roles deciden qué espacios puedes reservar."
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-xl border bg-card p-1 shadow-(--shadow-tarjeta)">
          {(
            [
              ["todos", `Todos (${data?.length ?? 0})`],
              ["mios", `Disponibles para mí (${cuantosMios})`],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filtro === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar sala, laboratorio…"
            className="bg-card pl-9"
            aria-label="Buscar espacios"
          />
        </div>
      </div>

      {isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => refetch()} />
      ) : lista.length === 0 ? (
        <Vacio
          ilustracion="sin-resultados"
          titulo={filtro === "mios" ? "Tus roles no habilitan ningún espacio" : "Ningún espacio coincide"}
          descripcion={
            filtro === "mios"
              ? "Pide a un administrador que te asigne el rol que necesitas."
              : "Prueba con otra búsqueda."
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((e, i) => (
            <Tarjeta key={e.id} e={e} indice={i} alAbrir={() => abrir(e.id)} />
          ))}
        </div>
      )}

      <Detalle e={abierto} reglas={reglas.data} alCerrar={() => abrir(null)} />
    </>
  );
}
