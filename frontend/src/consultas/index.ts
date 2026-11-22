import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

import { sesionAtom } from "@/estado/sesion";
import { api } from "@/lib/api";
import type {
  EventoAuditoria,
  MiAcceso,
  PersonaDirectorio,
  Pregunta,
  RespuestaAsistente,
  Resumen,
  Rol,
  Usuario,
} from "@/lib/tipos";

export const claves = {
  yo: ["yo"] as const,
  roles: ["admin", "roles"] as const,
  usuarios: ["admin", "usuarios"] as const,
  resumen: ["admin", "resumen"] as const,
  auditoria: ["admin", "auditoria"] as const,
  personas: (texto: string) => ["admin", "personas", texto] as const,
  preguntas: (perfil: string) => ["asistente", "preguntas", perfil] as const,
};

// ── Consultas ───────────────────────────────────────────────────────────────────────────

export const yoQuery = queryOptions({
  queryKey: claves.yo,
  queryFn: () => api<MiAcceso>("/auth/me"),
});

export const rolesQuery = queryOptions({
  queryKey: claves.roles,
  queryFn: () => api<Rol[]>("/admin/roles"),
});

export const usuariosQuery = queryOptions({
  queryKey: claves.usuarios,
  queryFn: () => api<Usuario[]>("/admin/usuarios"),
});

export const resumenQuery = queryOptions({
  queryKey: claves.resumen,
  queryFn: () => api<Resumen>("/admin/resumen"),
});

export const auditoriaQuery = queryOptions({
  queryKey: claves.auditoria,
  queryFn: () => api<EventoAuditoria[]>("/admin/auditoria?limite=12"),
});

export const personasQuery = (texto: string) =>
  queryOptions({
    queryKey: claves.personas(texto),
    queryFn: ({ signal }) =>
      api<PersonaDirectorio[]>(`/admin/personas?buscar=${encodeURIComponent(texto)}`, { signal }),
    enabled: texto.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

export const preguntasQuery = (perfil: string) =>
  queryOptions({
    queryKey: claves.preguntas(perfil),
    queryFn: () => api<Pregunta[]>("/asistente/preguntas"),
    staleTime: 5 * 60_000,
  });

// ── Sesión ──────────────────────────────────────────────────────────────────────────────

/** Inicia sesión. La sesión de la interfaz se confirma aparte (ver useConfirmarSesion) para que
 *  la pantalla de inicio alcance a mostrar el veredicto antes de cambiar de página. */
export function useLogin() {
  return useMutation({
    mutationFn: (datos: { usuario: string; contrasena: string }) =>
      api<MiAcceso>("/auth/login", { metodo: "POST", cuerpo: datos, silenciar401: true }),
  });
}

export function useConfirmarSesion() {
  const setSesion = useSetAtom(sesionAtom);
  const cliente = useQueryClient();
  return (yo: MiAcceso) => {
    cliente.clear();
    cliente.setQueryData(claves.yo, yo);
    setSesion(yo);
  };
}

export function useLogout() {
  const setSesion = useSetAtom(sesionAtom);
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { metodo: "POST", silenciar401: true }),
    onSettled: () => {
      setSesion(null);
      cliente.clear();
    },
  });
}

// ── Administración ──────────────────────────────────────────────────────────────────────

/** Tras cualquier cambio de administración se refrescan las vistas que dependen de él. */
function useRefrescarAdmin() {
  const cliente = useQueryClient();
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: ["admin"] }),
      cliente.invalidateQueries({ queryKey: claves.yo }),
    ]);
}

export interface RolNuevo {
  codigo: string;
  nombre: string;
  descripcion: string;
}
export type RolCambios = Partial<Pick<Rol, "nombre" | "descripcion" | "activo">>;

export function useCrearRol() {
  const refrescar = useRefrescarAdmin();
  return useMutation({
    mutationFn: (datos: RolNuevo) => api<Rol>("/admin/roles", { metodo: "POST", cuerpo: datos }),
    onSuccess: refrescar,
  });
}

export function useEditarRol() {
  const refrescar = useRefrescarAdmin();
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: number; cambios: RolCambios }) =>
      api<Rol>(`/admin/roles/${id}`, { metodo: "PUT", cuerpo: cambios }),
    // Actualización optimista: el interruptor de "activo" responde al instante.
    onMutate: async ({ id, cambios }) => {
      await cliente.cancelQueries({ queryKey: claves.roles });
      const antes = cliente.getQueryData<Rol[]>(claves.roles);
      cliente.setQueryData<Rol[]>(claves.roles, (roles) =>
        roles?.map((r) =>
          r.id === id ? { ...r, ...cambios, da_acceso: (cambios.activo ?? r.activo) && !r.protegido } : r,
        ),
      );
      return { antes };
    },
    onError: (_e, _v, contexto) => contexto?.antes && cliente.setQueryData(claves.roles, contexto.antes),
    onSettled: refrescar,
  });
}

export function useEliminarRol() {
  const refrescar = useRefrescarAdmin();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/roles/${id}`, { metodo: "DELETE" }),
    onSuccess: refrescar,
  });
}

export interface UsuarioNuevo {
  usuario: string;
  nombre: string;
  correo: string;
  perfil: "ADMINISTRADOR" | "CONSULTANTE";
  activo: boolean;
  rol_ids: number[];
}
export type UsuarioCambios = Partial<Omit<UsuarioNuevo, "usuario">>;

export function useCrearUsuario() {
  const refrescar = useRefrescarAdmin();
  return useMutation({
    mutationFn: (datos: UsuarioNuevo) => api<Usuario>("/admin/usuarios", { metodo: "POST", cuerpo: datos }),
    onSuccess: refrescar,
  });
}

export function useEditarUsuario() {
  const refrescar = useRefrescarAdmin();
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: number; cambios: UsuarioCambios }) =>
      api<Usuario>(`/admin/usuarios/${id}`, { metodo: "PUT", cuerpo: cambios }),
    onMutate: async ({ id, cambios }) => {
      if (cambios.activo === undefined) return {};
      await cliente.cancelQueries({ queryKey: claves.usuarios });
      const antes = cliente.getQueryData<Usuario[]>(claves.usuarios);
      cliente.setQueryData<Usuario[]>(claves.usuarios, (lista) =>
        lista?.map((u) => (u.id === id ? { ...u, activo: cambios.activo! } : u)),
      );
      return { antes };
    },
    onError: (_e, _v, contexto) => contexto?.antes && cliente.setQueryData(claves.usuarios, contexto.antes),
    onSettled: refrescar,
  });
}

export function useEliminarUsuario() {
  const refrescar = useRefrescarAdmin();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/admin/usuarios/${id}`, { metodo: "DELETE" }),
    onSuccess: refrescar,
  });
}

// ── Asistente ───────────────────────────────────────────────────────────────────────────

export function usePreguntar() {
  return useMutation({
    mutationFn: (pregunta: string) => api<RespuestaAsistente>("/asistente", { metodo: "POST", cuerpo: { pregunta } }),
  });
}
