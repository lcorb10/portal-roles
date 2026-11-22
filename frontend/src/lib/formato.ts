const fechaHoraFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function fechaHora(iso: string): string {
  return fechaHoraFmt.format(new Date(iso));
}

const relativoFmt = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "hace 5 minutos", "ayer"… */
export function haceCuanto(iso: string): string {
  const segundos = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unidad, tamano] of UNIDADES) {
    if (Math.abs(segundos) >= tamano) return relativoFmt.format(Math.round(segundos / tamano), unidad);
  }
  return "justo ahora";
}

/** "Andrea Gómez" → "AG" */
export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
