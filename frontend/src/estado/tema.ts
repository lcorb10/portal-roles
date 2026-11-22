import { atom } from "jotai";

export type PreferenciaTema = "claro" | "oscuro" | "sistema";

const CLAVE = "portal-tema";
const consulta = () => window.matchMedia("(prefers-color-scheme: dark)");

function leer(): PreferenciaTema {
  try {
    const valor = localStorage.getItem(CLAVE);
    if (valor === "claro" || valor === "oscuro") return valor;
  } catch {
    /* almacenamiento bloqueado: se usa el del sistema */
  }
  return "sistema";
}

export function aplicarTema(preferencia: PreferenciaTema) {
  const oscuro = preferencia === "oscuro" || (preferencia === "sistema" && consulta().matches);
  const raiz = document.documentElement;
  raiz.classList.toggle("dark", oscuro);
  raiz.style.colorScheme = oscuro ? "dark" : "light";
}

const base = atom<PreferenciaTema>(leer());

export const temaAtom = atom(
  (get) => get(base),
  (_get, set, valor: PreferenciaTema) => {
    set(base, valor);
    try {
      if (valor === "sistema") localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, valor);
    } catch {
      /* sin almacenamiento: solo dura esta visita */
    }
    aplicarTema(valor);
  },
);

/** Sigue los cambios del sistema mientras la preferencia sea "sistema". */
export function escucharSistema(obtener: () => PreferenciaTema): () => void {
  const mq = consulta();
  const alCambiar = () => obtener() === "sistema" && aplicarTema("sistema");
  mq.addEventListener("change", alCambiar);
  return () => mq.removeEventListener("change", alCambiar);
}

export function esOscuroAhora(): boolean {
  return document.documentElement.classList.contains("dark");
}
