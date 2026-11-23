/** Utilidades de fechas para reservas (fechas como AAAA-MM-DD, sin zonas horarias de por medio). */

export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
}

const diaSemana = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "UTC" });
const diaLargo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const diaMes = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });

const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const nombreDia = (iso: string) => diaSemana.format(aFecha(iso)).replace(".", "");
export const numeroDia = (iso: string) => Number(iso.slice(8, 10));
export const fechaLarga = (iso: string) => diaLargo.format(aFecha(iso));
export const fechaCorta = (iso: string) => diaMes.format(aFecha(iso)).replace(".", "");

export function hora(h: number): string {
  const sufijo = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${sufijo}`;
}

export const rangoHoras = (inicio: number, fin: number) => `${hora(inicio)} – ${hora(fin)}`;

/** "Hoy", "Mañana" o el nombre largo del día. */
export function cuando(iso: string, hoy: string): string {
  if (iso === hoy) return "Hoy";
  if (iso === sumarDias(hoy, 1)) return "Mañana";
  return fechaLarga(iso);
}

/** Fecha local de hoy (AAAA-MM-DD), mientras llegan las reglas del backend. */
export function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const horaLocal = () => new Date().getHours();
export const anioActual = () => new Date().getFullYear();
