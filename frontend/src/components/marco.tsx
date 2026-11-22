import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import {
  Bot,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { Logotipo } from "@/components/marca";
import { SelectorTema } from "@/components/selector-tema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLogout, yoQuery } from "@/consultas";
import { esAdminAtom, sesionAtom } from "@/estado/sesion";
import { iniciales } from "@/lib/formato";
import type { MiAcceso } from "@/lib/tipos";
import { cn } from "@/lib/utils";

interface Enlace {
  a: string;
  etiqueta: string;
  Icono: LucideIcon;
  fin?: boolean;
}

const PERSONAL: Enlace[] = [
  { a: "/mi-acceso", etiqueta: "Mi acceso", Icono: UserRound },
  { a: "/asistente", etiqueta: "Asistente", Icono: Bot },
];

const ADMINISTRACION: Enlace[] = [
  { a: "/admin", etiqueta: "Resumen", Icono: LayoutDashboard, fin: true },
  { a: "/admin/roles", etiqueta: "Roles", Icono: Tags },
  { a: "/admin/usuarios", etiqueta: "Usuarios", Icono: Users },
];

function Grupo({ titulo, enlaces, alNavegar }: { titulo: string; enlaces: Enlace[]; alNavegar?: () => void }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
        {titulo}
      </p>
      <ul className="space-y-0.5">
        {enlaces.map(({ a, etiqueta, Icono, fin }) => (
          <li key={a}>
            <NavLink
              to={a}
              end={fin}
              viewTransition
              onClick={alNavegar}
              className={({ isActive }) =>
                cn(
                  "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="indicador-nav"
                      className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icono className={cn("size-4", isActive && "text-brand")} />
                  {etiqueta}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Navegacion({ esAdmin, alNavegar }: { esAdmin: boolean; alNavegar?: () => void }) {
  return (
    <nav aria-label="Principal" className="space-y-6">
      <Grupo titulo="Personal" enlaces={PERSONAL} alNavegar={alNavegar} />
      {esAdmin && <Grupo titulo="Administración" enlaces={ADMINISTRACION} alNavegar={alNavegar} />}
    </nav>
  );
}

function MenuUsuario({ yo, compacto }: { yo: MiAcceso; compacto?: boolean }) {
  const navegar = useNavigate();
  const logout = useLogout();
  const salir = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        navegar("/login", { replace: true });
        toast.success("Cerraste sesión");
      },
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent/70",
            compacto && "w-auto",
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-brand-soft text-xs font-semibold text-brand">
              {iniciales(yo.nombre)}
            </AvatarFallback>
          </Avatar>
          {!compacto && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{yo.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{yo.usuario}</span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={compacto ? "bottom" : "top"} className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{yo.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">{yo.correo}</p>
          <Badge variant="outline" className="mt-2 gap-1">
            {yo.perfil === "ADMINISTRADOR" && <ShieldCheck className="size-3 text-gold" />}
            {yo.perfil}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="text-muted-foreground">Tema</span>
          <SelectorTema />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={salir} disabled={logout.isPending}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Mantiene la sesión de Jotai al día con el backend (p. ej. si un admin cambió tu perfil). */
function SincronizarSesion() {
  const setSesion = useSetAtom(sesionAtom);
  const { pathname } = useLocation();
  const { data, refetch } = useQuery({ ...yoQuery, refetchOnWindowFocus: true });
  // Cada cambio de página consulta /api/auth/me: si un admin desactivó a la persona o le quitó el
  // rol que le daba acceso, el backend responde 401 y la sesión se cierra en esa misma acción,
  // aunque la página tenga sus datos en caché.
  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);
  useEffect(() => {
    if (data) setSesion(data);
  }, [data, setSesion]);
  return null;
}

export function Marco() {
  const yo = useAtomValue(sesionAtom)!;
  const esAdmin = useAtomValue(esAdminAtom);
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <SincronizarSesion />

      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <Logotipo className="px-2" />
        <div className="mt-9 flex-1 overflow-y-auto">
          <Navegacion esAdmin={esAdmin} />
        </div>
        <div className="border-t border-sidebar-border pt-3">
          <MenuUsuario yo={yo} />
        </div>
      </aside>

      {/* Barra superior (celular y tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <Sheet open={abierto} onOpenChange={setAbierto}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menú">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar px-3">
            <SheetHeader className="px-2">
              <SheetTitle asChild>
                <div>
                  <Logotipo />
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <Navegacion esAdmin={esAdmin} alNavegar={() => setAbierto(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <Logotipo className="[&_p:last-child]:hidden" />
        <MenuUsuario yo={yo} compacto />
      </header>

      <main
        className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-8 lg:pt-12"
        style={{ viewTransitionName: "contenido" }}
      >
        <Outlet />
      </main>
    </div>
  );
}
