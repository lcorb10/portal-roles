import { useQuery } from "@tanstack/react-query";
import { Building2, CircleCheck, CircleMinus, Clock, Info, Mail, ShieldCheck, UserCog } from "lucide-react";
import { motion } from "motion/react";

import { Encabezado } from "@/components/encabezado";
import { ErrorCarga } from "@/components/estados";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { yoQuery } from "@/consultas";
import { fechaHora, iniciales } from "@/lib/formato";
import type { MiAcceso, RolAcceso } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export function InsigniaPerfil({ perfil, className }: { perfil: MiAcceso["perfil"]; className?: string }) {
  const admin = perfil === "ADMINISTRADOR";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        admin ? "border-gold/40 bg-gold-soft text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {admin && <ShieldCheck className="size-3 text-gold" />}
      {admin ? "Administrador" : "Consultante"}
    </Badge>
  );
}

function FilaRol({ rol, indice }: { rol: RolAcceso; indice: number }) {
  const distinto = rol.original.trim() !== rol.codigo;
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + indice * 0.04, duration: 0.2 }}
      className="flex items-center justify-between gap-4 py-3"
    >
      <div className="min-w-0">
        <p className={cn("font-mono text-sm font-medium", !rol.da_acceso && "text-muted-foreground")}>{rol.codigo}</p>
        {distinto && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Llegó como <span className="font-mono whitespace-pre">«{rol.original}»</span>
          </p>
        )}
      </div>
      {rol.da_acceso ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
          <CircleCheck className="size-3.5" /> Da acceso
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-right text-xs text-muted-foreground">
          <CircleMinus className="size-3.5 shrink-0" /> {rol.motivo}
        </span>
      )}
    </motion.li>
  );
}

function TarjetaRoles({
  titulo,
  descripcion,
  Icono,
  roles,
  vacio,
}: {
  titulo: string;
  descripcion: string;
  Icono: typeof Building2;
  roles: RolAcceso[];
  vacio: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <Icono className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{roles.length}</span>
      </div>
      {roles.length ? (
        <ul className="mt-4 divide-y">
          {roles.map((rol, i) => (
            <FilaRol key={rol.codigo} rol={rol} indice={i} />
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {vacio}
        </p>
      )}
    </section>
  );
}

function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando tu acceso">
      <Skeleton className="mb-3 h-4 w-28" />
      <Skeleton className="mb-10 h-8 w-56" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}

export default function MiAccesoPagina() {
  const { data: yo, isPending, error, refetch } = useQuery(yoQuery);

  if (isPending) return <Cargando />;
  if (error) return <ErrorCarga error={error} reintentar={() => refetch()} />;

  return (
    <>
      <Encabezado
        antetitulo="Mi acceso"
        titulo={`Hola, ${yo.nombre.split(" ")[0]}`}
        descripcion="Así decide el portal tu acceso: tus roles del sistema institucional más los que te asignó un administrador."
      />

      <section className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-brand/[0.07] blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar className="size-16 sm:size-[72px]">
            <AvatarFallback className="bg-brand-soft text-xl font-semibold text-brand">
              {iniciales(yo.nombre)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{yo.nombre}</h2>
              <InsigniaPerfil perfil={yo.perfil} />
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Usuario</dt>
                <dd className="font-mono text-xs">{yo.usuario}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                <dt className="sr-only">Correo</dt>
                <dd>{yo.correo}</dd>
              </div>
              {yo.ultimo_ingreso && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <dt className="sr-only">Último ingreso</dt>
                  <dd>Ingreso: {fechaHora(yo.ultimo_ingreso)}</dd>
                </div>
              )}
            </dl>
            {yo.perfil_por_configuracion && (
              <p className="mt-2 text-xs text-muted-foreground">
                Eres administrador por la configuración del portal (ADMIN_USERNAMES).
              </p>
            )}
          </div>
          <div className="rounded-xl bg-success-soft px-4 py-3 sm:max-w-[240px]">
            <p className="text-xs font-semibold tracking-wide text-success uppercase">Entras por</p>
            <p className="mt-1 font-mono text-sm font-medium break-words">{yo.roles_con_acceso.join(", ")}</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <TarjetaRoles
          titulo="Sistema institucional"
          descripcion="Lo que reporta el servicio de roles."
          Icono={Building2}
          roles={yo.roles_institucionales}
          vacio="El sistema institucional no reporta roles para ti."
        />
        <TarjetaRoles
          titulo="Asignados en el portal"
          descripcion="Los que te sumó un administrador."
          Icono={UserCog}
          roles={yo.roles_asignados}
          vacio="Ningún administrador te ha asignado roles."
        />
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" />
        Un rol da acceso si está en el catálogo del portal, está activo y no es EGRESADOS. Los roles se comparan sin
        importar mayúsculas, tildes ni espacios.
      </p>
    </>
  );
}
