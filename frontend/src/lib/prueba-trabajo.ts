import { api } from "@/lib/api";

export interface PruebaResuelta {
  reto: string;
  nonce: string;
  intentos: number;
  ms: number;
}

/** Pide un reto al backend y lo resuelve en un Web Worker (protección contra bots, invisible). */
export async function resolverPrueba(): Promise<PruebaResuelta> {
  const { reto, dificultad } = await api<{ reto: string; dificultad: number }>("/auth/reto", { silenciar401: true });
  const trabajador = new Worker(new URL("./prueba-trabajo.worker.ts", import.meta.url), { type: "module" });
  try {
    const resultado = await new Promise<{ nonce: string; intentos: number; ms: number }>((resolve, reject) => {
      trabajador.onmessage = (e) => resolve(e.data);
      trabajador.onerror = () => reject(new Error("No se pudo completar la verificación de seguridad."));
      trabajador.postMessage({ reto, dificultad });
    });
    return { reto, ...resultado };
  } finally {
    trabajador.terminate();
  }
}
