import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  History,
  LogIn,
  Pencil,
  Plus,
  ShieldCheck,
  Tags,
  Trash2,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { Link } from "react-router";

import { Encabezado } from "@/components/encabezado";
import { ErrorCarga, Vacio } from "@/components/estados";
import { Skeleton } from "@/components/ui/skeleton";
import { auditoriaQuery, resumenQuery } from "@/consultas";
import { haceCuanto } from "@/lib/formato";
import { cn } from "@/lib/utils";

function Contador({ valor }: { valor: number }) {
  const mv = useMotionValue(0);
  const texto = useTransform(mv, (v) => Math.round(v).toLocaleString("es-CO"));
  useEffect(() => {
    const control = animate(mv, valor, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => control.stop();
  }, [mv, valor]);
  return <motion.span className="tabular-nums">{texto}</motion.span>;
}

function Kpi({
  etiqueta,
  valor,
  detalle,
  Icono,
  acento,
  indice,
}: {
  etiqueta: string;
  valor: number;
  detalle: string;
  Icono: LucideIcon;
  acento?: "brand" | "gold";
  indice: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: indice * 0.05, duration: 0.3, ease: [0.2, 0, 0, 1] }}
      className="relative overflow-hidden rounded-2xl border bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
        <Icono
          className={cn(
            "size-4",
            acento === "brand" ? "text-brand" : acento === "gold" ? "text-gold" : "text-muted-foreground",
          )}
        />
      </div>
      <p className="mt-3 text-[2.1rem] leading-none font-semibold tracking-tight">
        <Contador valor={valor} />
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{detalle}</p>
    </motion.div>
  );
}

const ICONOS: Record<string, LucideIcon> = {
  ROL_CREADO: Plus,
  ROL_EDITADO: Pencil,
  ROL_ELIMINADO: Trash2,
  USUARIO_CREADO: Plus,
  USUARIO_EDITADO: Pencil,
  USUARIO_ELIMINADO: Trash2,
  REGISTRO_AUTOMATICO: LogIn,
  CATALOGO_INICIAL: Tags,
};

function Actividad() {
  const { data, isPending, error, refetch } = useQuery(auditoriaQuery);
  return (
    <section className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <History className="size-4 text-muted-foreground" />
        <h2 className="font-semibold">Actividad reciente</h2>
        <span className="ml-auto text-xs text-muted-foreground">Quién cambió qué y cuándo</span>
      </div>
      {isPending ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => refetch()} />
      ) : data.length === 0 ? (
        <Vacio icono={History} titulo="Sin actividad todavía" className="py-8" />
      ) : (
        <ol className="relative space-y-4 before:absolute before:inset-y-2 before:left-3.5 before:w-px before:bg-border">
          {data.map((e, i) => {
            const Icono = ICONOS[e.accion] ?? Pencil;
            const borrado = e.accion.endsWith("ELIMINADO");
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.03 }}
                className="relative flex gap-3"
              >
                <span
                  className={cn(
                    "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-card",
                    borrado && "text-destructive",
                  )}
                >
                  <Icono className="size-3.5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm text-pretty">{e.detalle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{e.actor}</span> · {haceCuanto(e.fecha)}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Atajo({
  a,
  titulo,
  descripcion,
  Icono,
}: {
  a: string;
  titulo: string;
  descripcion: string;
  Icono: LucideIcon;
}) {
  return (
    <Link
      to={a}
      viewTransition
      className="group flex items-center gap-4 rounded-2xl border bg-card p-5 transition-[border-color,transform] duration-150 hover:border-foreground/20 active:scale-[0.99]"
    >
      <div className="grid size-10 place-items-center rounded-xl bg-muted">
        <Icono className="size-4" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
      <ArrowUpRight className="size-4 text-muted-foreground transition-[color,transform] duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
    </Link>
  );
}

export default function Resumen() {
  const { data, isPending, error, refetch } = useQuery(resumenQuery);

  return (
    <>
      <Encabezado
        antetitulo="Administración"
        titulo="Resumen del portal"
        descripcion="Cómo está el portal hoy: personas registradas, administradores y catálogo de roles."
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[134px] rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            indice={0}
            etiqueta="Usuarios registrados"
            valor={data.total_usuarios}
            detalle="En la aplicación"
            Icono={Users}
          />
          <Kpi
            indice={1}
            etiqueta="Administradores"
            valor={data.total_administradores}
            detalle="Con perfil ADMINISTRADOR"
            Icono={ShieldCheck}
            acento="gold"
          />
          <Kpi
            indice={2}
            etiqueta="Usuarios activos"
            valor={data.usuarios_activos}
            detalle={`${data.total_usuarios - data.usuarios_activos} desactivados`}
            Icono={UserCheck}
          />
          <Kpi
            indice={3}
            etiqueta="Roles activos"
            valor={data.roles_activos}
            detalle={`De ${data.roles_total} en el catálogo`}
            Icono={Tags}
            acento="brand"
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Actividad />
        <div className="space-y-4">
          <Atajo a="/admin/usuarios" titulo="Usuarios" descripcion="Crear, editar, asignar roles" Icono={Users} />
          <Atajo a="/admin/roles" titulo="Roles" descripcion="Catálogo que da acceso" Icono={Tags} />
        </div>
      </div>
    </>
  );
}
