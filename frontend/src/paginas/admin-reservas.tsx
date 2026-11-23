import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Loader2, Pencil, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Encabezado } from "@/components/encabezado";
import { CargandoFilas, ErrorCarga, Vacio } from "@/components/estados";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { espaciosQuery, reglasQuery, reservasAdminQuery, rolesQuery, useEditarEspacio } from "@/consultas";
import { mensaje } from "@/lib/api";
import { hoyLocal } from "@/lib/fechas";
import type { Espacio } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { FilaReserva, useConfirmarCancelacion } from "@/paginas/reservas";

function DialogoEspacio({ e, alCerrar }: { e: Espacio; alCerrar: () => void }) {
  const roles = useQuery(rolesQuery);
  const editar = useEditarEspacio();
  const [ids, setIds] = useState(new Set(e.rol_ids));
  const [capacidad, setCapacidad] = useState(String(e.capacidad));
  const [error, setError] = useState<string | null>(null);

  function guardar(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    editar.mutate(
      { id: e.id, cambios: { rol_ids: [...ids], capacidad: Number(capacidad) } },
      {
        onSuccess: () => {
          toast.success(`${e.nombre} actualizado`);
          alCerrar();
        },
        onError: (err) => setError(mensaje(err)),
      },
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !editar.isPending && alCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={guardar} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{e.nombre}</DialogTitle>
            <DialogDescription>
              Elige qué roles pueden reservarlo. EGRESADOS nunca habilita reservas, aunque lo marques.
            </DialogDescription>
          </DialogHeader>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Roles que pueden reservar</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.data?.map((r) => {
                const marcado = ids.has(r.id);
                return (
                  <label
                    key={r.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                      marcado ? "border-foreground/25 bg-accent" : "hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(v) =>
                        setIds((prev) => {
                          const s = new Set(prev);
                          if (v === true) s.add(r.id);
                          else s.delete(r.id);
                          return s;
                        })
                      }
                    />
                    <span className="font-mono text-xs font-medium">{r.codigo}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="w-40 space-y-1.5">
            <Label htmlFor="capacidad">Capacidad</Label>
            <Input
              id="capacidad"
              type="number"
              min={1}
              value={capacidad}
              onChange={(x) => setCapacidad(x.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="flex gap-2 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4" /> {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={alCerrar} disabled={editar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={editar.isPending || Number(capacidad) < 1}>
              {editar.isPending && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListaEspacios() {
  const { data, isPending, error, refetch } = useQuery(espaciosQuery);
  const editar = useEditarEspacio();
  const [editando, setEditando] = useState<Espacio | null>(null);

  if (isPending) return <CargandoFilas filas={6} />;
  if (error) return <ErrorCarga error={error} reintentar={() => refetch()} />;
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2">
        {data.map((e) => (
          <li key={e.id} className={cn("tarjeta flex gap-4 p-3", !e.activo && "opacity-70")}>
            <img src={`/img/espacios/${e.codigo}.webp`} alt="" className="w-28 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold tracking-tight">{e.nombre}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3" /> {e.capacidad} · {e.ubicacion}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {e.roles_permitidos.length ? (
                  e.roles_permitidos.map((r) => (
                    <span key={r} className="rounded-md border px-1.5 py-0.5 font-mono text-[0.68rem]">
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Ningún rol puede reservarlo</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end justify-between gap-2">
              <Switch
                checked={e.activo}
                aria-label={`${e.activo ? "Deshabilitar" : "Habilitar"} ${e.nombre}`}
                onCheckedChange={(v) =>
                  editar.mutate(
                    { id: e.id, cambios: { activo: v } },
                    {
                      onSuccess: () => toast.success(`${e.nombre} ${v ? "habilitado" : "deshabilitado"}`),
                      onError: (x) => toast.error(mensaje(x)),
                    },
                  )
                }
              />
              <Button variant="ghost" size="sm" onClick={() => setEditando(e)}>
                <Pencil /> Roles
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editando && <DialogoEspacio key={editando.id} e={editando} alCerrar={() => setEditando(null)} />}
    </>
  );
}

function ListaReservas() {
  const { data, isPending, error, refetch } = useQuery(reservasAdminQuery);
  const reglas = useQuery(reglasQuery);
  const { pedir, dialogo } = useConfirmarCancelacion({ requiereMotivo: true });
  const hoy = reglas.data?.hoy ?? hoyLocal();

  if (isPending) return <CargandoFilas />;
  if (error) return <ErrorCarga error={error} reintentar={() => refetch()} />;
  const activas = data.filter((r) => r.estado === "ACTIVA");
  return (
    <>
      {activas.length === 0 ? (
        <Vacio titulo="No hay reservas próximas" descripcion="Cuando alguien reserve un espacio aparecerá aquí." />
      ) : (
        <ul className="space-y-3">
          {activas.map((r, i) => (
            <FilaReserva key={r.id} r={r} hoy={hoy} indice={i} mostrarPersona alCancelar={() => pedir(r)} />
          ))}
        </ul>
      )}
      {dialogo}
    </>
  );
}

export default function AdminReservas() {
  return (
    <>
      <Encabezado
        antetitulo="Administración"
        titulo="Reservas y espacios"
        descripcion="Todas las reservas próximas del campus y qué roles pueden usar cada espacio."
      />
      <Tabs defaultValue="reservas">
        <TabsList className="mb-5">
          <TabsTrigger value="reservas">Reservas próximas</TabsTrigger>
          <TabsTrigger value="espacios">Espacios</TabsTrigger>
        </TabsList>
        <TabsContent value="reservas">
          <ListaReservas />
        </TabsContent>
        <TabsContent value="espacios">
          <ListaEspacios />
        </TabsContent>
      </Tabs>
    </>
  );
}
