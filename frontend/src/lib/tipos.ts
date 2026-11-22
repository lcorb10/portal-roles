export type Perfil = "ADMINISTRADOR" | "CONSULTANTE";
export type Origen = "CREADO_POR_ADMIN" | "REGISTRO_AUTOMATICO";

export interface RolAcceso {
  codigo: string;
  original: string;
  en_catalogo: boolean;
  activo: boolean;
  da_acceso: boolean;
  motivo: string;
}

export interface MiAcceso {
  id: number;
  usuario: string;
  nombre: string;
  correo: string;
  perfil: Perfil;
  perfil_por_configuracion: boolean;
  roles_institucionales: RolAcceso[];
  roles_asignados: RolAcceso[];
  roles: string[];
  roles_con_acceso: string[];
  ultimo_ingreso: string | null;
}

export interface Rol {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  protegido: boolean;
  usuarios_asignados: number;
  da_acceso: boolean;
}

export interface RolResumen {
  id: number;
  codigo: string;
  activo: boolean;
}

export interface Usuario {
  id: number;
  usuario: string;
  nombre: string;
  correo: string;
  perfil: Perfil;
  perfil_por_configuracion: boolean;
  activo: boolean;
  origen: Origen;
  roles: RolResumen[];
  ultimo_ingreso: string | null;
  creado_en: string;
}

export interface PersonaDirectorio {
  username: string;
  nombre: string;
  correo: string;
  dependencia: string;
  ya_registrado: boolean;
}

export interface Pregunta {
  id: string;
  pregunta: string;
  perfil: "TODOS" | "ADMINISTRADOR" | string;
}

export interface RespuestaAsistente {
  pregunta: string;
  respuesta: string | null;
}

export interface EventoAuditoria {
  id: number;
  fecha: string;
  actor: string;
  accion: string;
  detalle: string;
}

export interface Resumen {
  total_usuarios: number;
  total_administradores: number;
  usuarios_activos: number;
  roles_activos: number;
  roles_total: number;
}
