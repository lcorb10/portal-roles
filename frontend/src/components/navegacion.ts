import {
  Bot,
  CalendarCheck2,
  CalendarRange,
  House,
  LayoutDashboard,
  LifeBuoy,
  ScanSearch,
  Tags,
  UserRound,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export interface Enlace {
  a: string;
  etiqueta: string;
  Icono: LucideIcon;
  fin?: boolean;
  descripcion: string;
}

export const MI_PORTAL: Enlace[] = [
  { a: "/inicio", etiqueta: "Inicio", Icono: House, descripcion: "Resumen de tu día en el campus" },
  { a: "/mi-acceso", etiqueta: "Mi acceso", Icono: UserRound, descripcion: "Tu perfil y tus roles" },
  { a: "/espacios", etiqueta: "Espacios", Icono: Warehouse, descripcion: "Reserva salas, laboratorios y más" },
  { a: "/reservas", etiqueta: "Mis reservas", Icono: CalendarCheck2, descripcion: "Tus reservas y su historial" },
  { a: "/asistente", etiqueta: "Asistente", Icono: Bot, descripcion: "Pregúntale al portal" },
];

export const ADMINISTRACION: Enlace[] = [
  { a: "/admin", etiqueta: "Resumen", Icono: LayoutDashboard, fin: true, descripcion: "Indicadores y actividad" },
  { a: "/admin/usuarios", etiqueta: "Usuarios", Icono: Users, descripcion: "Crear, editar y asignar roles" },
  { a: "/admin/roles", etiqueta: "Roles", Icono: Tags, descripcion: "Catálogo que da acceso" },
  {
    a: "/admin/reservas",
    etiqueta: "Reservas y espacios",
    Icono: CalendarRange,
    descripcion: "Todas las reservas y quién puede usar cada espacio",
  },
  {
    a: "/admin/verificador",
    etiqueta: "Verificador",
    Icono: ScanSearch,
    descripcion: "¿Entraría esta persona? ¿Por qué?",
  },
];

export const AYUDA: Enlace = { a: "/ayuda", etiqueta: "Ayuda", Icono: LifeBuoy, descripcion: "Preguntas frecuentes" };
