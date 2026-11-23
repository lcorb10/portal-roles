import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { LogOut, Monitor, Moon, Search, Sun, UserRound, Warehouse } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { ADMINISTRACION, AYUDA, MI_PORTAL } from "@/components/navegacion";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { espaciosQuery, useLogout, usuariosQuery } from "@/consultas";
import { esAdminAtom } from "@/estado/sesion";
import { temaAtom } from "@/estado/tema";
import { cn } from "@/lib/utils";

/** Buscador rápido (Ctrl+K / ⌘K): ir a cualquier página, abrir un espacio o un usuario, y acciones. */
export function Buscador({ className }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const esAdmin = useAtomValue(esAdminAtom);
  const setTema = useSetAtom(temaAtom);
  const navegar = useNavigate();
  const logout = useLogout();
  const espacios = useQuery({ ...espaciosQuery, enabled: abierto });
  const usuarios = useQuery({ ...usuariosQuery, enabled: abierto && esAdmin });

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setAbierto((v) => !v);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const ir = (ruta: string) => {
    setAbierto(false);
    navegar(ruta, { viewTransition: true });
  };

  const paginas = [...MI_PORTAL, ...(esAdmin ? ADMINISTRACION : []), AYUDA];

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "group flex h-9 items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-header-muted transition-colors hover:bg-white/10 hover:text-header-foreground",
          className,
        )}
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar en el portal…</span>
        <Kbd className="hidden border-white/10 bg-white/10 text-header-muted sm:inline-flex">Ctrl K</Kbd>
      </button>

      <CommandDialog
        className="sm:max-w-xl"
        open={abierto}
        onOpenChange={setAbierto}
        title="Buscar en el portal"
        description="Páginas, espacios, usuarios y acciones"
      >
        <Command>
          <CommandInput placeholder="¿A dónde quieres ir? Escribe una página, un espacio o una persona…" />
          <CommandList>
            <CommandEmpty>No encontramos nada con ese nombre.</CommandEmpty>
            <CommandGroup heading="Páginas">
              {paginas.map(({ a, etiqueta, Icono, descripcion }) => (
                <CommandItem key={a} value={`${etiqueta} ${descripcion}`} onSelect={() => ir(a)}>
                  <Icono />
                  <span>{etiqueta}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{descripcion}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {espacios.data && espacios.data.length > 0 && (
              <CommandGroup heading="Espacios">
                {espacios.data.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`espacio ${e.nombre} ${e.tipo} ${e.ubicacion}`}
                    onSelect={() => ir(`/espacios?ver=${e.id}`)}
                  >
                    <Warehouse />
                    <span>{e.nombre}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{e.ubicacion}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {esAdmin && usuarios.data && usuarios.data.length > 0 && (
              <CommandGroup heading="Usuarios">
                {usuarios.data.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`usuario ${u.nombre} ${u.usuario} ${u.correo}`}
                    onSelect={() => ir(`/admin/usuarios?buscar=${encodeURIComponent(u.usuario)}`)}
                  >
                    <UserRound />
                    <span>{u.nombre}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{u.usuario}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading="Acciones">
              <CommandItem value="tema claro" onSelect={() => (setTema("claro"), setAbierto(false))}>
                <Sun /> Tema claro
              </CommandItem>
              <CommandItem value="tema oscuro" onSelect={() => (setTema("oscuro"), setAbierto(false))}>
                <Moon /> Tema oscuro
              </CommandItem>
              <CommandItem value="tema del sistema" onSelect={() => (setTema("sistema"), setAbierto(false))}>
                <Monitor /> Tema del sistema
              </CommandItem>
              <CommandItem
                value="cerrar sesion salir"
                onSelect={() => {
                  setAbierto(false);
                  logout.mutate(undefined, { onSettled: () => navegar("/login", { replace: true }) });
                }}
              >
                <LogOut /> Cerrar sesión
                <CommandShortcut>Salir</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
