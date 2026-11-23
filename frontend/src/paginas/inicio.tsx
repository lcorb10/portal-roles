import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CalendarPlus,
  CircleCheck,
  Megaphone,
  MapPin,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";

import { Vacio } from "@/components/estados";
import { TarjetaAviso } from "@/components/notificaciones";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { avisosQuery, espaciosQuery, misReservasQuery, reglasQuery, useMarcarAvisosLeidos } from "@/consultas";
import { sesionAtom } from "@/estado/sesion";
import { cuando, fechaLarga, hoyLocal, rangoHoras } from "@/lib/fechas";
import { cn } from "@/lib/utils";

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

const AVISOS = [
  {
    titulo: "Biblioteca con horario extendido",
    texto: "Durante la semana de parciales las salas de estudio grupal abren hasta las 9:00 p. m.",
    etiqueta: "Biblioteca",
  },
  {
    titulo: "Mantenimiento del laboratorio de cómputo 3",
    texto: "El sábado no se podrá reservar mientras se actualiza el software de ingeniería.",
    etiqueta: "Infraestructura",
  },
  {
    titulo: "¿Te cambiaron de rol?",
    texto: "Los cambios que haga un administrador se aplican de inmediato: no necesitas volver a entrar.",
    etiqueta: "Portal",
  },
];

function Seccion({
  titulo,
  Icono,
  enlace,
  children,
  className,
}: {
  titulo: string;
  Icono: typeof Bot;
  enlace?: { a: string; texto: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("tarjeta p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Icono className="size-4 text-brand" />
        <h2 className="font-semibold tracking-tight">{titulo}</h2>
        {enlace && (
          <Link
            to={enlace.a}
            viewTransition
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {enlace.texto} <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Inicio() {
  const yo = useAtomValue(sesionAtom)!;
  const reservas = useQuery(misReservasQuery);
  const espacios = useQuery(espaciosQuery);
  const reglas = useQuery(reglasQuery);
  const avisos = useQuery(avisosQuery);
  const leer = useMarcarAvisosLeidos();
  const admin = yo.perfil === "ADMINISTRADOR";
  const hoy = reglas.data?.hoy ?? hoyLocal();

  const proximas = (reservas.data ?? [])
    .filter((r) => r.estado === "ACTIVA" && r.fecha >= hoy)
    .sort((a, b) => (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio))
    .slice(0, 3);
  const disponibles = (espacios.data ?? []).filter((e) => e.puede_reservar);

  return (
    <>
      {/* Portada */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        className="relative isolate overflow-hidden rounded-3xl bg-[#1a1716] text-[#f4efe9] shadow-(--shadow-elevada)"
      >
        <img
          src="/img/marca/campus.webp"
          alt=""
          className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover object-[50%_30%] opacity-90 sm:w-[62%]"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#1a1716] via-[#1a1716]/92 to-[#1a1716]/10 sm:via-[#1a1716]/80" />
        <div className="max-w-xl px-6 py-9 sm:px-10 sm:py-12">
          <p className="text-sm font-medium text-[#f4efe9]/70 first-letter:uppercase">{fechaLarga(hoy)}</p>
          <h1 className="mt-2 text-[2rem] leading-tight font-bold tracking-[-0.03em] sm:text-[2.5rem]">
            {saludo()}, {yo.nombre.split(" ")[0]}
          </h1>
          <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-[#f4efe9]/75">
            Entras como <span className="font-semibold text-[#ffcd00]">{admin ? "administrador" : "consultante"}</span>{" "}
            por <span className="font-medium text-white">{yo.roles_con_acceso.join(", ")}</span>. Tus roles también
            deciden qué espacios del campus puedes reservar.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button asChild size="lg" className="bg-brand text-brand-foreground hover:bg-brand-strong">
              <Link to="/espacios" viewTransition>
                <CalendarPlus /> Reservar un espacio
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/asistente" viewTransition>
                <Bot /> Preguntar al asistente
              </Link>
            </Button>
          </div>
        </div>
        <div className="franja h-1" />
      </motion.section>

      {avisos.data && avisos.data.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="tarjeta mt-6 border-destructive/30 bg-destructive/[0.04] p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-semibold tracking-tight text-destructive">
              {avisos.data.length === 1
                ? "Un administrador canceló una de tus reservas"
                : `Cancelaron ${avisos.data.length} de tus reservas`}
            </p>
            <Button variant="outline" size="sm" onClick={() => leer.mutate()} disabled={leer.isPending}>
              Entendido
            </Button>
          </div>
          <ul className="space-y-3">
            {avisos.data.map((a) => (
              <li key={a.id}>
                <TarjetaAviso a={a} />
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Seccion titulo="Tus próximas reservas" Icono={CalendarClock} enlace={{ a: "/reservas", texto: "Ver todas" }}>
          {reservas.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : proximas.length === 0 ? (
            <Vacio
              ilustracion="vacio"
              titulo="No tienes reservas próximas"
              descripcion={
                disponibles.length
                  ? `Puedes reservar ${disponibles.length} ${disponibles.length === 1 ? "espacio" : "espacios"} con tus roles.`
                  : "Con tus roles actuales no hay espacios para reservar."
              }
              className="py-8"
              accion={
                disponibles.length > 0 && (
                  <Button asChild size="sm">
                    <Link to="/espacios" viewTransition>
                      Ver espacios
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {proximas.map((r) => (
                <li key={r.id} className="flex items-center gap-4 rounded-xl border bg-background/60 p-3">
                  <img
                    src={`/img/espacios/${r.espacio_codigo}.webp`}
                    alt=""
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.espacio}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{cuando(r.fecha, hoy)}</span> ·{" "}
                      {rangoHoras(r.hora_inicio, r.hora_fin)}
                    </p>
                  </div>
                  <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                    <MapPin className="size-3.5" /> {r.ubicacion}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Tu acceso" Icono={ShieldCheck} enlace={{ a: "/mi-acceso", texto: "Detalle" }}>
          <ul className="flex flex-wrap gap-2">
            {[...yo.roles_institucionales, ...yo.roles_asignados]
              .filter((r, i, todos) => todos.findIndex((x) => x.codigo === r.codigo) === i)
              .map((r) => (
                <li
                  key={r.codigo}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs",
                    r.da_acceso
                      ? "border-success/30 bg-success-soft text-success"
                      : "text-muted-foreground line-through decoration-muted-foreground/50",
                  )}
                >
                  {r.da_acceso && <CircleCheck className="size-3" />}
                  {r.codigo}
                </li>
              ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Perfil <span className="font-medium text-foreground">{yo.perfil}</span>
            {yo.perfil_por_configuracion && " (por configuración)"}.
          </p>
          {admin && (
            <div className="mt-5 grid grid-cols-2 gap-2 border-t pt-5">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link to="/admin/usuarios" viewTransition>
                  <Users /> Usuarios
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start">
                <Link to="/admin/verificador" viewTransition>
                  <ScanSearch /> Verificador
                </Link>
              </Button>
            </div>
          )}
        </Seccion>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Espacios para ti</h2>
            <p className="text-sm text-muted-foreground">Los que tus roles te permiten reservar.</p>
          </div>
          <Link
            to="/espacios"
            viewTransition
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            Todos los espacios <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {espacios.isPending ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : disponibles.length === 0 ? (
          <Vacio
            ilustracion="sin-resultados"
            titulo="Ningún espacio disponible con tus roles"
            descripcion="Si necesitas reservar, pide a un administrador que te asigne un rol."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {disponibles.slice(0, 3).map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  to={`/espacios?ver=${e.id}`}
                  viewTransition
                  className="group tarjeta block overflow-hidden transition-shadow hover:shadow-(--shadow-elevada)"
                >
                  <div className="aspect-[16/9] overflow-hidden">
                    <img
                      src={`/img/espacios/${e.codigo}.webp`}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold tracking-tight">{e.nombre}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" /> {e.ubicacion}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <Seccion titulo="Avisos del campus" Icono={Megaphone} className="mt-8">
        <ul className="grid gap-4 md:grid-cols-3">
          {AVISOS.map((a) => (
            <li key={a.titulo} className="rounded-xl border-l-[3px] border-brand bg-background/60 py-1 pr-2 pl-4">
              <p className="text-[0.68rem] font-semibold tracking-[0.1em] text-brand uppercase">{a.etiqueta}</p>
              <p className="mt-1 font-medium">{a.titulo}</p>
              <p className="mt-1 text-sm text-muted-foreground">{a.texto}</p>
            </li>
          ))}
        </ul>
      </Seccion>
    </>
  );
}
