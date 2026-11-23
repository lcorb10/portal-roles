import { toast } from "sonner";

const ID_AVISO = "version-nueva";
let avisado = false;

/** Consulta /version.json (nunca en caché). Si el servidor tiene otra versión, ofrece recargar. */
export async function revisarVersion(): Promise<void> {
  if (avisado || import.meta.env.DEV) return;
  try {
    const respuesta = await fetch("/version.json", { cache: "no-store" });
    if (!respuesta.ok) return;
    const { version } = (await respuesta.json()) as { version?: string };
    if (version && version !== __VERSION__) {
      avisado = true;
      toast.info("Hay una versión nueva del portal", {
        id: ID_AVISO,
        description: "Recarga para usar la última versión.",
        duration: Infinity,
        action: { label: "Recargar", onClick: () => window.location.reload() },
      });
    }
  } catch {
    /* sin red: se intentará más tarde */
  }
}

/** Si falla la descarga de una parte de la app (p. ej. tras publicar una versión nueva), recarga una vez. */
export function recargarSiFallaUnModulo(): void {
  window.addEventListener("vite:preloadError", (evento) => {
    const CLAVE = "portal-recarga-modulo";
    let ultima = 0;
    try {
      ultima = Number(sessionStorage.getItem(CLAVE)) || 0;
    } catch {
      /* sin almacenamiento */
    }
    if (Date.now() - ultima < 10_000) return; // evita un ciclo de recargas
    evento.preventDefault();
    try {
      sessionStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      /* sin almacenamiento */
    }
    window.location.reload();
  });
}

export function esErrorDeModulo(error: unknown): boolean {
  const texto = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(texto);
}
