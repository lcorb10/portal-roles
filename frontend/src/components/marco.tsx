import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, LifeBuoy, LogOut, Menu, ShieldCheck, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { Buscador } from "@/components/buscador";
import { Logotipo } from "@/components/marca";
import { Notificaciones } from "@/components/notificaciones";
import { ADMINISTRACION, AYUDA, MI_PORTAL, type Enlace } from "@/components/navegacion";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLogout, yoQuery } from "@/consultas";
import { esAdminAtom, sesionAtom } from "@/estado/sesion";
import { anioActual } from "@/lib/fechas";
import { iniciales } from "@/lib/formato";
import type { MiAcceso } from "@/lib/tipos";
import { cn } from "@/lib/utils";

function Grupo({ titulo, enlaces, alNavegar }: { titulo: string; enlaces: Enlace[]; alNavegar?: () => void }) {
  return (
    <div>
      <p className="mb-2 px-3 text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
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
                  "relative flex h-9 items-center gap-3 rounded-lg px-3 text-[0.875rem] font-medium transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
                  <Icono className={cn("size-[1.05rem]", isActive && "text-brand")} />
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
    <nav aria-label="Principal" className="space-y-7">
      <Grupo titulo="Mi portal" enlaces={MI_PORTAL} alNavegar={alNavegar} />
      {esAdmin && <Grupo titulo="Administración" enlaces={ADMINISTRACION} alNavegar={alNavegar} />}
      <Grupo titulo="Soporte" enlaces={[AYUDA]} alNavegar={alNavegar} />
    </nav>
  );
}

function MenuUsuario({ yo }: { yo: MiAcceso }) {
  const navegar = useNavigate();
  const logout = useLogout();
  const salir = () =>
    logout.mutate(undefined, {
      onSettled: () => {
        navegar("/login", { replace: true });
        toast.success("Cerraste sesión");
      },
    });
  const admin = yo.perfil === "ADMINISTRADOR";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-white/10"
        >
          <Avatar className="size-8 ring-2 ring-white/15">
            <AvatarFallback className="bg-brand text-xs font-semibold text-brand-foreground">
              {iniciales(yo.nombre)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-medium text-header-foreground">{yo.nombre}</span>
            <span className="block text-[0.7rem] text-header-muted">{admin ? "Administrador" : "Consultante"}</span>
          </span>
          <ChevronDown className="hidden size-4 text-header-muted md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{yo.nombre}</p>
          <p className="truncate text-xs text-muted-foreground">{yo.correo}</p>
          <Badge variant="outline" className="mt-2 gap-1">
            {admin && <ShieldCheck className="size-3 text-gold" />}
            {yo.perfil}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/mi-acceso" viewTransition>
            <UserRound /> Mi acceso
          </Link>
        </DropdownMenuItem>
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
    <div className="min-h-dvh">
      <SincronizarSesion />

      {/* Barra superior institucional */}
      <header className="sticky top-0 z-40 bg-header text-header-foreground">
        <div className="flex h-15 items-center gap-3 px-3 sm:px-5">
          <Sheet open={abierto} onOpenChange={setAbierto}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Abrir menú"
                className="text-header-foreground hover:bg-white/10 hover:text-header-foreground lg:hidden"
              >
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
              <div className="mt-2 overflow-y-auto">
                <Navegacion esAdmin={esAdmin} alNavegar={() => setAbierto(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Link to="/inicio" viewTransition className="rounded-md text-header-foreground lg:w-[226px]">
            <Logotipo compacto />
          </Link>

          <Buscador className="mx-auto hidden w-full max-w-md md:flex" />

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Notificaciones />
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/ayuda"
                  viewTransition
                  aria-label="Ayuda"
                  className="grid size-9 place-items-center rounded-lg text-header-muted transition-colors hover:bg-white/10 hover:text-header-foreground"
                >
                  <LifeBuoy className="size-[1.1rem]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Ayuda y preguntas frecuentes</TooltipContent>
            </Tooltip>
            <MenuUsuario yo={yo} />
          </div>
        </div>
        <div className="franja h-[3px]" />
      </header>

      <div className="lg:grid lg:grid-cols-[250px_1fr]">
        <aside className="sticky top-[63px] hidden h-[calc(100dvh-63px)] flex-col border-r border-sidebar-border bg-sidebar/90 px-3 pt-6 pb-4 backdrop-blur lg:flex">
          <div className="flex-1 overflow-y-auto">
            <Navegacion esAdmin={esAdmin} />
          </div>
          <p className="px-3 pt-4 text-[0.7rem] leading-relaxed text-muted-foreground/80">
            Servicios institucionales simulados.
            <br />
            Prueba técnica · {anioActual()}
          </p>
        </aside>

        <main
          className="mx-auto w-full max-w-6xl px-4 pt-7 pb-16 sm:px-8 lg:pt-10"
          style={{ viewTransitionName: "contenido" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
