import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import {
  BookUser,
  Check,
  CircleAlert,
  Loader2,
  Lock,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Confirmar } from "@/components/confirmar";
import { Encabezado } from "@/components/encabezado";
import { CargandoFilas, ErrorCarga, Vacio } from "@/components/estados";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  personasQuery,
  rolesQuery,
  useCrearUsuario,
  useEditarUsuario,
  useEliminarUsuario,
  usuariosQuery,
} from "@/consultas";
import { sesionAtom } from "@/estado/sesion";
import { mensaje } from "@/lib/api";
import { haceCuanto, iniciales } from "@/lib/formato";
import { normalizar } from "@/lib/normalizar";
import type { Perfil, PersonaDirectorio, Usuario } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { InsigniaPerfil } from "@/paginas/mi-acceso";

function useRetrasado<T>(valor: T, ms = 250): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return v;
}

// ── Búsqueda en el directorio institucional (GET /personas) ─────────────────────────────

function BuscarDirectorio({ alElegir }: { alElegir: (p: PersonaDirectorio) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const retrasado = useRetrasado(texto);
  const { data, isFetching, error } = useQuery(personasQuery(retrasado));
  const listo = retrasado.trim().length >= 2;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal text-muted-foreground">
          <BookUser /> Buscar en el directorio institucional…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nombre o usuario (mín. 2 letras)" value={texto} onValueChange={setTexto} />
          <CommandList>
            {!listo ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Escribe al menos 2 letras.</p>
            ) : error ? (
              <p className="px-3 py-6 text-center text-sm text-destructive">{mensaje(error)}</p>
            ) : (
              <>
                {isFetching && !data && (
                  <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Buscando…
                  </p>
                )}
                {data && <CommandEmpty>Nadie coincide con «{retrasado}».</CommandEmpty>}
                <CommandGroup>
                  {data?.map((p) => (
                    <CommandItem
                      key={p.username}
                      value={p.username}
                      disabled={p.ya_registrado}
                      onSelect={() => {
                        alElegir(p);
                        setAbierto(false);
                      }}
                      className="items-start"
                    >
                      <Avatar className="mt-0.5 size-7">
                        <AvatarFallback className="text-[0.65rem]">{iniciales(p.nombre)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{p.username}</span> · {p.dependencia}
                        </p>
                      </div>
                      {p.ya_registrado && <span className="text-xs text-muted-foreground">Ya registrado</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Diálogo crear / editar ──────────────────────────────────────────────────────────────

function DialogoUsuario({
  usuario,
  usuarios,
  miId,
  alCerrar,
}: {
  usuario: Usuario | null;
  usuarios: Usuario[];
  miId: number;
  alCerrar: () => void;
}) {
  const roles = useQuery(rolesQuery);
  const crear = useCrearUsuario();
  const editar = useEditarUsuario();
  const [nombreUsuario, setNombreUsuario] = useState(usuario?.usuario ?? "");
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [correo, setCorreo] = useState(usuario?.correo ?? "");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "CONSULTANTE");
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const [rolIds, setRolIds] = useState<Set<number>>(new Set(usuario?.roles.map((r) => r.id)));
  const [error, setError] = useState<string | null>(null);

  const soyYo = usuario?.id === miId;
  const perfilFijo = !!usuario?.perfil_por_configuracion || soyYo;
  const pendiente = crear.isPending || editar.isPending;
  const usuarioLimpio = nombreUsuario.trim().toLowerCase();
  const repetido = !usuario && usuarios.some((u) => u.usuario === usuarioLimpio);
  const usuarioValido = /^[a-z0-9._-]{3,60}$/.test(usuarioLimpio);
  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
  const valido = (usuario || (usuarioValido && !repetido)) && nombre.trim().length >= 2 && correoValido;

  function elegirPersona(p: PersonaDirectorio) {
    setNombreUsuario(p.username);
    setNombre(p.nombre);
    setCorreo(p.correo);
  }

  function alternarRol(id: number, marcado: boolean) {
    setRolIds((prev) => {
      const siguiente = new Set(prev);
      if (marcado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setError(null);
    const datos = { nombre: nombre.trim(), correo: correo.trim(), perfil, activo, rol_ids: [...rolIds] };
    const fin = {
      onSuccess: () => {
        toast.success(usuario ? `Cambios guardados para ${usuario.usuario}` : `Usuario ${usuarioLimpio} creado`);
        alCerrar();
      },
      onError: (err: unknown) => setError(mensaje(err)),
    };
    if (usuario) editar.mutate({ id: usuario.id, cambios: datos }, fin);
    else crear.mutate({ ...datos, usuario: usuarioLimpio }, fin);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !pendiente && alCerrar()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={guardar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{usuario ? `Editar a ${usuario.nombre}` : "Nuevo usuario"}</DialogTitle>
            <DialogDescription>
              Los roles que marques se suman a los que entrega el sistema institucional.
            </DialogDescription>
          </DialogHeader>

          {!usuario && <BuscarDirectorio alElegir={elegirPersona} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-usuario">Usuario</Label>
              {usuario ? (
                <div className="flex h-9 items-center gap-2 rounded-md border bg-muted px-3 font-mono text-sm text-muted-foreground">
                  <Lock className="size-3.5" /> {usuario.usuario}
                </div>
              ) : (
                <>
                  <Input
                    id="u-usuario"
                    value={nombreUsuario}
                    onChange={(e) => setNombreUsuario(e.target.value)}
                    placeholder="nombre.apellido"
                    className="font-mono"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={repetido || (!!nombreUsuario && !usuarioValido) || undefined}
                  />
                  {(repetido || (nombreUsuario && !usuarioValido)) && (
                    <p className="text-xs text-destructive">
                      {repetido ? "Ese usuario ya existe." : "Solo minúsculas, números, punto, guion (3 a 60)."}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-perfil">Perfil</Label>
              <Select value={perfil} onValueChange={(v) => setPerfil(v as Perfil)} disabled={perfilFijo}>
                <SelectTrigger id="u-perfil" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSULTANTE">Consultante</SelectItem>
                  <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {perfilFijo && (
                <p className="text-xs text-muted-foreground">
                  {usuario?.perfil_por_configuracion
                    ? "Administrador por configuración (ADMIN_USERNAMES)."
                    : "No puedes cambiar tu propio perfil."}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-nombre">Nombre</Label>
              <Input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-correo">Correo</Label>
              <Input
                id="u-correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                aria-invalid={(!!correo && !correoValido) || undefined}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Roles asignados en el portal</legend>
            {roles.isPending ? (
              <p className="text-sm text-muted-foreground">Cargando roles…</p>
            ) : roles.error ? (
              <p className="text-sm text-destructive">{mensaje(roles.error)}</p>
            ) : roles.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay roles en el catálogo.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {roles.data.map((rol) => {
                  const marcado = rolIds.has(rol.id);
                  return (
                    <label
                      key={rol.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                        marcado ? "border-foreground/25 bg-accent" : "hover:bg-muted/50",
                      )}
                    >
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(v) => alternarRol(rol.id, v === true)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-medium">{rol.codigo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {rol.protegido ? "No da acceso" : rol.activo ? rol.nombre : "Inactivo: no da acceso"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3.5">
            <span>
              <span className="block text-sm font-medium">Activo</span>
              <span className="block text-xs text-muted-foreground">
                {soyYo ? "No puedes desactivarte a ti mismo." : "Un usuario desactivado no entra aunque tenga roles."}
              </span>
            </span>
            <Switch checked={activo} onCheckedChange={setActivo} disabled={soyYo} />
          </label>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={alCerrar} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valido || pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              {usuario ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────────────────

function Origen({ origen }: { origen: Usuario["origen"] }) {
  return origen === "CREADO_POR_ADMIN" ? (
    <Badge variant="secondary">Creado por admin</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Registrado al entrar
    </Badge>
  );
}

function RolesChips({ usuario }: { usuario: Usuario }) {
  if (!usuario.roles.length) return <span className="text-xs text-muted-foreground">Sin roles asignados</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {usuario.roles.map((r) => (
        <span
          key={r.id}
          className={cn(
            "rounded-md border px-1.5 py-0.5 font-mono text-[0.7rem]",
            !r.activo && "text-muted-foreground line-through",
          )}
        >
          {r.codigo}
        </span>
      ))}
    </div>
  );
}

type FiltroPerfil = "todos" | Perfil;
type FiltroEstado = "todos" | "activos" | "inactivos";

export default function Usuarios() {
  const yo = useAtomValue(sesionAtom)!;
  const { data: usuarios, isPending, error, refetch } = useQuery(usuariosQuery);
  const editar = useEditarUsuario();
  const eliminar = useEliminarUsuario();
  const [busqueda, setBusqueda] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<FiltroPerfil>("todos");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [dialogo, setDialogo] = useState<{ usuario: Usuario | null; clave: number } | null>(null);
  const [aEliminar, setAEliminar] = useState<Usuario | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return (usuarios ?? []).filter(
      (u) =>
        (!q ||
          normalizar(u.usuario).includes(q) ||
          normalizar(u.nombre).includes(q) ||
          normalizar(u.correo).includes(q)) &&
        (filtroPerfil === "todos" || u.perfil === filtroPerfil) &&
        (filtroEstado === "todos" || (filtroEstado === "activos") === u.activo),
    );
  }, [usuarios, busqueda, filtroPerfil, filtroEstado]);

  const cambiarActivo = (u: Usuario, activo: boolean) =>
    editar.mutate(
      { id: u.id, cambios: { activo } },
      {
        onSuccess: () => toast.success(`${u.usuario} ${activo ? "activado" : "desactivado"}`),
        onError: (e) => toast.error(mensaje(e)),
      },
    );

  const abrir = (usuario: Usuario | null) => setDialogo({ usuario, clave: Date.now() });
  const pedirEliminar = (u: Usuario) => {
    setErrorEliminar(null);
    setAEliminar(u);
  };

  const Activo = ({ u }: { u: Usuario }) => {
    const interruptor = (
      <Switch
        checked={u.activo}
        onCheckedChange={(v) => cambiarActivo(u, v)}
        disabled={u.id === yo.id}
        aria-label={`${u.activo ? "Desactivar" : "Activar"} a ${u.usuario}`}
      />
    );
    return u.id === yo.id ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{interruptor}</span>
        </TooltipTrigger>
        <TooltipContent>No puedes desactivarte a ti mismo</TooltipContent>
      </Tooltip>
    ) : (
      interruptor
    );
  };

  const Acciones = ({ u }: { u: Usuario }) => (
    <div className="flex justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => abrir(u)}
            aria-label={`Editar a ${u.usuario}`}
          >
            <Pencil />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={u.id === yo.id ? 0 : -1}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-destructive"
              onClick={() => pedirEliminar(u)}
              disabled={u.id === yo.id}
              aria-label={`Eliminar a ${u.usuario}`}
            >
              <Trash2 />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{u.id === yo.id ? "No puedes eliminarte a ti mismo" : "Eliminar"}</TooltipContent>
      </Tooltip>
    </div>
  );

  const Persona = ({ u }: { u: Usuario }) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9">
        <AvatarFallback className={cn("text-xs font-semibold", u.perfil === "ADMINISTRADOR" && "bg-gold-soft")}>
          {iniciales(u.nombre)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate font-medium">
          {u.nombre}
          {u.id === yo.id && <span className="text-xs font-normal text-muted-foreground">(tú)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{u.usuario}</span> · {u.correo}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Encabezado
        antetitulo="Administración"
        titulo="Usuarios"
        descripcion="Personas del portal: las que creó un administrador y las que se registraron al entrar."
        acciones={
          <Button onClick={() => abrir(null)}>
            <UserPlus /> Nuevo usuario
          </Button>
        }
      />

      {isPending ? (
        <CargandoFilas />
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => refetch()} />
      ) : usuarios.length === 0 ? (
        <Vacio
          icono={Users}
          titulo="Todavía no hay usuarios"
          descripcion="Aparecen aquí al crearlos o cuando alguien entra por primera vez."
          accion={
            <Button onClick={() => abrir(null)}>
              <UserPlus /> Nuevo usuario
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, usuario o correo"
                className="pl-9"
                aria-label="Buscar usuarios"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filtroPerfil} onValueChange={(v) => setFiltroPerfil(v as FiltroPerfil)}>
                <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filtrar por perfil">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los perfiles</SelectItem>
                  <SelectItem value="ADMINISTRADOR">Administradores</SelectItem>
                  <SelectItem value="CONSULTANTE">Consultantes</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as FiltroEstado)}>
                <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filtrar por estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="activos">Activos</SelectItem>
                  <SelectItem value="inactivos">Desactivados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <Vacio icono={Search} titulo="Nadie coincide con los filtros" />
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl border bg-card lg:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Persona</th>
                      <th className="px-4 py-3 font-medium">Perfil</th>
                      <th className="px-4 py-3 font-medium">Roles asignados</th>
                      <th className="px-4 py-3 font-medium">Activo</th>
                      <th className="px-4 py-3 font-medium">Origen</th>
                      <th className="px-4 py-3 font-medium">Último ingreso</th>
                      <th className="px-4 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtrados.map((u) => (
                      <tr key={u.id} className={cn("transition-colors hover:bg-muted/30", !u.activo && "opacity-60")}>
                        <td className="max-w-[280px] px-5 py-3">
                          <Persona u={u} />
                        </td>
                        <td className="px-4 py-3">
                          <InsigniaPerfil perfil={u.perfil} />
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <RolesChips usuario={u} />
                        </td>
                        <td className="px-4 py-3">
                          <Activo u={u} />
                        </td>
                        <td className="px-4 py-3">
                          <Origen origen={u.origen} />
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                          {u.ultimo_ingreso ? haceCuanto(u.ultimo_ingreso) : "Nunca"}
                        </td>
                        <td className="px-4 py-3">
                          <Acciones u={u} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 lg:hidden">
                {filtrados.map((u) => (
                  <li key={u.id} className={cn("rounded-xl border bg-card p-4", !u.activo && "opacity-70")}>
                    <div className="flex items-start justify-between gap-2">
                      <Persona u={u} />
                      <Acciones u={u} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <InsigniaPerfil perfil={u.perfil} />
                      <Origen origen={u.origen} />
                    </div>
                    <div className="mt-3">
                      <RolesChips usuario={u} />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                      <span className="flex items-center gap-2.5">
                        <Activo u={u} /> {u.activo ? "Activo" : "Desactivado"}
                      </span>
                      <span className="text-muted-foreground">
                        {u.ultimo_ingreso ? `Ingresó ${haceCuanto(u.ultimo_ingreso)}` : "Nunca ha ingresado"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3.5" /> {filtrados.length} de {usuarios.length} usuarios
                <ShieldCheck className="ml-3 size-3.5 text-gold" />{" "}
                {(() => {
                  const n = usuarios.filter((u) => u.perfil === "ADMINISTRADOR").length;
                  return `${n} ${n === 1 ? "administrador" : "administradores"}`;
                })()}
              </p>
            </>
          )}
        </>
      )}

      {dialogo && (
        <DialogoUsuario
          key={dialogo.clave}
          usuario={dialogo.usuario}
          usuarios={usuarios ?? []}
          miId={yo.id}
          alCerrar={() => setDialogo(null)}
        />
      )}

      <Confirmar
        abierto={!!aEliminar}
        alCambiar={(v) => !v && setAEliminar(null)}
        titulo={`¿Eliminar a ${aEliminar?.nombre ?? ""}?`}
        descripcion={
          <p>
            Se borran su perfil y sus roles asignados en el portal. Si vuelve a entrar y tiene un rol con acceso,
            quedará registrado otra vez como consultante.
          </p>
        }
        textoAccion="Eliminar usuario"
        pendiente={eliminar.isPending}
        error={errorEliminar}
        alConfirmar={() =>
          aEliminar &&
          eliminar.mutate(aEliminar.id, {
            onSuccess: () => {
              toast.success(`${aEliminar.usuario} eliminado`);
              setAEliminar(null);
            },
            onError: (e) => setErrorEliminar(mensaje(e)),
          })
        }
      />
    </>
  );
}
