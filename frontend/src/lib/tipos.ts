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
  origen: "ia" | "portal" | null;
  interpretada_como: string | null;
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

export interface Espacio {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  ubicacion: string;
  capacidad: number;
  descripcion: string;
  activo: boolean;
  roles_permitidos: string[];
  rol_ids: number[];
  puede_reservar: boolean;
  motivo: string | null;
  habilitado_por: string[];
}

export interface Reserva {
  id: number;
  espacio_id: number;
  espacio: string;
  espacio_codigo: string;
  ubicacion: string;
  usuario: string;
  nombre_usuario: string;
  fecha: string; // AAAA-MM-DD
  hora_inicio: number;
  hora_fin: number;
  motivo: string;
  asistentes: number;
  estado: "ACTIVA" | "CANCELADA";
  creada_en: string;
  cancelada_por: string | null;
}

export interface FranjaOcupada {
  hora_inicio: number;
  hora_fin: number;
  propia: boolean;
  por: string | null;
}

export interface Disponibilidad {
  fecha: string;
  ocupadas: FranjaOcupada[];
}

export interface ReglasReserva {
  hora_apertura: number;
  hora_cierre: number;
  max_horas: number;
  dias_adelante: number;
  max_reservas: number;
  hoy: string;
}

export interface Verificacion {
  usuario: string;
  entraria: boolean;
  mensaje: string;
  perfil: Perfil | null;
  registrado: boolean;
  activo: boolean | null;
  en_sistema_de_roles: boolean | null;
  roles_institucionales: RolAcceso[];
  roles_asignados: RolAcceso[];
}
