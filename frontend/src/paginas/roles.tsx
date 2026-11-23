import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Loader2, Lock, Pencil, Plus, Search, Tags, Trash2, Users } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Confirmar } from "@/components/confirmar";
import { Encabezado } from "@/components/encabezado";
import { CargandoFilas, ErrorCarga, Vacio } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { rolesQuery, useCrearRol, useEditarRol, useEliminarRol } from "@/consultas";
import { mensaje } from "@/lib/api";
import { normalizar } from "@/lib/normalizar";
import type { Rol } from "@/lib/tipos";
import { cn } from "@/lib/utils";

// ── Diálogo crear / editar ──────────────────────────────────────────────────────────────

function DialogoRol({
  rol,
  roles,
  abierto,
  alCambiar,
}: {
  rol: Rol | null; // null = crear
  roles: Rol[];
  abierto: boolean;
  alCambiar: (v: boolean) => void;
}) {
  const crear = useCrearRol();
  const editar = useEditarRol();
  const [codigo, setCodigo] = useState(rol?.codigo ?? "");
  const [nombre, setNombre] = useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? "");
  const [activo, setActivo] = useState(rol?.activo ?? true);
  const [error, setError] = useState<string | null>(null);

  const pendiente = crear.isPending || editar.isPending;
  const duplicado = !rol && codigo.trim() ? roles.find((r) => normalizar(r.codigo) === normalizar(codigo)) : undefined;
  const valido = (rol || codigo.trim().length >= 2) && nombre.trim().length >= 2 && !duplicado;

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!valido) return;
    setError(null);
    const fin = {
      onSuccess: () => {
        toast.success(rol ? `Rol ${rol.codigo} actualizado` : `Rol ${codigo.trim().toUpperCase()} creado`);
        alCambiar(false);
      },
      onError: (err: unknown) => setError(mensaje(err)),
    };
    if (rol) {
      editar.mutate({ id: rol.id, cambios: { nombre: nombre.trim(), descripcion: descripcion.trim(), activo } }, fin);
    } else {
      crear.mutate({ codigo: codigo.trim(), nombre: nombre.trim(), descripcion: descripcion.trim() }, fin);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !pendiente && alCambiar(v)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={guardar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{rol ? "Editar rol" : "Nuevo rol"}</DialogTitle>
            <DialogDescription>
              {rol ? "El código no se puede cambiar después de creado." : "El código es único y no se podrá cambiar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            {rol ? (
              <div className="flex h-9 items-center gap-2 rounded-md border bg-muted px-3 font-mono text-sm text-muted-foreground">
                <Lock className="size-3.5" /> {rol.codigo}
              </div>
            ) : (
              <>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="INVESTIGADORES"
                  className="font-mono uppercase"
                  maxLength={60}
                  autoFocus
                  aria-invalid={!!duplicado || undefined}
                  aria-describedby="codigo-ayuda"
                />
                <p
                  id="codigo-ayuda"
                  className={cn("text-xs", duplicado ? "text-destructive" : "text-muted-foreground")}
                >
                  {duplicado
                    ? `Ya existe ${duplicado.codigo}: no se distinguen mayúsculas, tildes ni espacios.`
                    : codigo.trim()
                      ? `Se guardará como ${codigo.trim().toUpperCase()}`
                      : "Sin importar mayúsculas, tildes ni espacios, no puede repetirse."}
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre-rol">Nombre</Label>
            <Input
              id="nombre-rol"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Investigadores"
              maxLength={120}
              autoFocus={!!rol}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion-rol">
              Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="descripcion-rol"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Para qué sirve este rol…"
              maxLength={500}
              rows={3}
            />
          </div>

          {rol && (
            <label className="flex items-center justify-between gap-4 rounded-lg border p-3.5">
              <span>
                <span className="block text-sm font-medium">Activo</span>
                <span className="block text-xs text-muted-foreground">
                  {rol.protegido ? "EGRESADOS nunca da acceso, aunque esté activo." : "Un rol inactivo no da acceso."}
                </span>
              </span>
              <Switch checked={activo} onCheckedChange={setActivo} />
            </label>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => alCambiar(false)} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valido || pendiente}>
              {pendiente && <Loader2 className="animate-spin" />}
              {rol ? "Guardar cambios" : "Crear rol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────────────────

function EstadoAcceso({ rol }: { rol: Rol }) {
  if (rol.protegido) return <span className="text-xs text-muted-foreground">Nunca da acceso</span>;
  return (
    <span className={cn("text-xs", rol.da_acceso ? "text-success" : "text-muted-foreground")}>
      {rol.da_acceso ? "Da acceso" : "No da acceso"}
    </span>
  );
}

function Acciones({ rol, alEditar, alEliminar }: { rol: Rol; alEditar: () => void; alEliminar: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" onClick={alEditar} aria-label={`Editar ${rol.codigo}`}>
            <Pencil />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={rol.protegido ? 0 : -1}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-destructive"
              onClick={alEliminar}
              disabled={rol.protegido}
              aria-label={`Eliminar ${rol.codigo}`}
            >
              <Trash2 />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{rol.protegido ? "EGRESADOS no se puede eliminar" : "Eliminar"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function Roles() {
  const { data: roles, isPending, error, refetch } = useQuery(rolesQuery);
  const editar = useEditarRol();
  const eliminar = useEliminarRol();
  const [busqueda, setBusqueda] = useState("");
  const [dialogo, setDialogo] = useState<{ rol: Rol | null; clave: number } | null>(null);
  const [aEliminar, setAEliminar] = useState<Rol | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return (roles ?? []).filter(
      (r) =>
        !q ||
        normalizar(r.codigo).includes(q) ||
        normalizar(r.nombre).includes(q) ||
        normalizar(r.descripcion).includes(q),
    );
  }, [roles, busqueda]);

  const cambiarActivo = (rol: Rol, activo: boolean) =>
    editar.mutate(
      { id: rol.id, cambios: { activo } },
      {
        onSuccess: () => toast.success(`${rol.codigo} ${activo ? "activado" : "desactivado"}`),
        onError: (e) => toast.error(mensaje(e)),
      },
    );

  const confirmarEliminar = () => {
    if (!aEliminar) return;
    eliminar.mutate(aEliminar.id, {
      onSuccess: () => {
        toast.success(`Rol ${aEliminar.codigo} eliminado`);
        setAEliminar(null);
      },
      onError: (e) => setErrorEliminar(mensaje(e)),
    });
  };

  const abrirNuevo = () => setDialogo({ rol: null, clave: Date.now() });

  return (
    <>
      <Encabezado
        antetitulo="Administración"
        titulo="Roles"
        descripcion="Catálogo de roles del portal. Un rol da acceso si está activo y no es EGRESADOS."
        acciones={
          <Button onClick={abrirNuevo}>
            <Plus /> Nuevo rol
          </Button>
        }
      />

      {isPending ? (
        <CargandoFilas />
      ) : error ? (
        <ErrorCarga error={error} reintentar={() => refetch()} />
      ) : roles.length === 0 ? (
        <Vacio
          icono={Tags}
          titulo="El catálogo está vacío"
          descripcion="Crea el primer rol para que las personas puedan entrar al portal."
          accion={
            <Button onClick={abrirNuevo}>
              <Plus /> Nuevo rol
            </Button>
          }
        />
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, nombre o descripción"
              className="pl-9"
              aria-label="Buscar roles"
            />
          </div>

          {filtrados.length === 0 ? (
            <Vacio icono={Search} titulo="Ningún rol coincide con la búsqueda" />
          ) : (
            <>
              {/* Escritorio */}
              <div className="tarjeta hidden overflow-hidden md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Código</th>
                      <th className="px-5 py-3 font-medium">Nombre y descripción</th>
                      <th className="px-5 py-3 font-medium">Usuarios</th>
                      <th className="px-5 py-3 font-medium">Activo</th>
                      <th className="px-5 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtrados.map((rol) => (
                      <tr key={rol.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[0.8rem] font-medium">
                            {rol.codigo}
                            {rol.protegido && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Lock className="size-3.5 text-gold" aria-label="Protegido" />
                                </TooltipTrigger>
                                <TooltipContent>Regla fija: nunca da acceso y no se puede eliminar</TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </td>
                        <td className="max-w-md px-5 py-3.5">
                          <p className="font-medium">{rol.nombre}</p>
                          {rol.descripcion && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{rol.descripcion}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                            <Users className="size-3.5" /> {rol.usuarios_asignados}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Switch
                              checked={rol.activo}
                              onCheckedChange={(v) => cambiarActivo(rol, v)}
                              aria-label={`${rol.activo ? "Desactivar" : "Activar"} ${rol.codigo}`}
                            />
                            <EstadoAcceso rol={rol} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Acciones
                            rol={rol}
                            alEditar={() => setDialogo({ rol, clave: Date.now() })}
                            alEliminar={() => {
                              setErrorEliminar(null);
                              setAEliminar(rol);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Celular */}
              <ul className="space-y-3 md:hidden">
                {filtrados.map((rol) => (
                  <li key={rol.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="inline-flex items-center gap-1.5 font-mono text-sm font-medium">
                          {rol.codigo}
                          {rol.protegido && <Lock className="size-3.5 text-gold" />}
                        </p>
                        <p className="mt-0.5 text-sm">{rol.nombre}</p>
                        {rol.descripcion && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{rol.descripcion}</p>
                        )}
                      </div>
                      <Acciones
                        rol={rol}
                        alEditar={() => setDialogo({ rol, clave: Date.now() })}
                        alEliminar={() => {
                          setErrorEliminar(null);
                          setAEliminar(rol);
                        }}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-2.5">
                        <Switch checked={rol.activo} onCheckedChange={(v) => cambiarActivo(rol, v)} />
                        <EstadoAcceso rol={rol} />
                      </div>
                      <Badge variant="secondary" className="gap-1 tabular-nums">
                        <Users className="size-3" /> {rol.usuarios_asignados}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {dialogo && (
        <DialogoRol
          key={dialogo.clave}
          rol={dialogo.rol}
          roles={roles ?? []}
          abierto
          alCambiar={(v) => !v && setDialogo(null)}
        />
      )}

      <Confirmar
        abierto={!!aEliminar}
        alCambiar={(v) => !v && setAEliminar(null)}
        titulo={`¿Eliminar el rol ${aEliminar?.codigo ?? ""}?`}
        descripcion={
          aEliminar && aEliminar.usuarios_asignados > 0 ? (
            <p>
              Este rol está asignado a <strong>{aEliminar.usuarios_asignados}</strong>{" "}
              {aEliminar.usuarios_asignados === 1 ? "usuario" : "usuarios"}. El portal no permite eliminar roles
              asignados.
            </p>
          ) : (
            <p>
              Esta acción no se puede deshacer. Las personas que entraban solo por este rol dejarán de tener acceso.
            </p>
          )
        }
        textoAccion="Eliminar rol"
        pendiente={eliminar.isPending}
        error={errorEliminar}
        alConfirmar={confirmarEliminar}
      />
    </>
  );
}
