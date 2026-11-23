/**
 * Cliente de la API del portal. El frontend solo habla con /api (mismo dominio): nginx lo
 * reenvía al backend. La sesión viaja en una cookie httpOnly; aquí no se guarda nada.
 */

export class ApiError extends Error {
  readonly estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.name = "ApiError";
    this.estado = estado;
  }
}

const MENSAJE_RED = "No hay conexión con el servidor. Revisa tu red e intenta de nuevo.";

type Oyente = (error: ApiError) => void;
const oyentesSesion = new Set<Oyente>();

/** Se llama cuando el backend cierra la sesión (401): desactivación, rol retirado, etc. */
export function alPerderSesion(oyente: Oyente): () => void {
  oyentesSesion.add(oyente);
  return () => oyentesSesion.delete(oyente);
}

const MENSAJE_VERSION_VIEJA =
  "Esta acción cambió en una actualización del portal. Recarga la página para usar la versión nueva.";

function mensajeDeError(estado: number, cuerpo: unknown): string {
  // FastAPI responde así cuando la ruta no existe: la pestaña tiene una versión vieja de la app.
  const detalle =
    cuerpo && typeof cuerpo === "object" && "detail" in cuerpo ? (cuerpo as { detail: unknown }).detail : null;
  if ((estado === 404 && detalle === "Not Found") || (estado === 405 && detalle === "Method Not Allowed")) {
    return MENSAJE_VERSION_VIEJA;
  }
  if (cuerpo && typeof cuerpo === "object" && "detail" in cuerpo) {
    const detalle = (cuerpo as { detail: unknown }).detail;
    if (typeof detalle === "string") return detalle;
    if (Array.isArray(detalle)) {
      // Errores de validación de FastAPI (422)
      const primero = detalle[0] as { msg?: string; loc?: unknown[] } | undefined;
      const campo = primero?.loc?.at(-1);
      return primero?.msg ? `Revisa ${campo ? `«${String(campo)}»` : "los datos"}: ${primero.msg}` : "Datos inválidos.";
    }
  }
  if (estado >= 500) return "El servidor tuvo un problema. Intenta más tarde.";
  return "No se pudo completar la acción.";
}

interface Opciones {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  cuerpo?: unknown;
  /** No avisar la pérdida de sesión (p. ej. en el propio login o al consultar /me). */
  silenciar401?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(
  ruta: string,
  { metodo = "GET", cuerpo, silenciar401, signal }: Opciones = {},
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, MENSAJE_RED);
  }

  if (respuesta.status === 204) return undefined as T;

  const cuerpoRespuesta: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const error = new ApiError(respuesta.status, mensajeDeError(respuesta.status, cuerpoRespuesta));
    if (respuesta.status === 401 && !silenciar401) oyentesSesion.forEach((o) => o(error));
    throw error;
  }
  return cuerpoRespuesta as T;
}

export function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}
