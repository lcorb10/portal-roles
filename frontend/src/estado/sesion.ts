import { atom } from "jotai";

import type { MiAcceso } from "@/lib/tipos";

/**
 * Estado de la sesión en el frontend (Jotai).
 *  - undefined: todavía no sabemos (se está consultando /api/auth/me)
 *  - null: no hay sesión
 *  - MiAcceso: persona dentro del portal
 * La sesión real vive en la cookie httpOnly; esto es solo lo que la interfaz necesita saber.
 */
export const sesionAtom = atom<MiAcceso | null | undefined>(undefined);

export const esAdminAtom = atom((get) => get(sesionAtom)?.perfil === "ADMINISTRADOR");

/** Motivo por el que el backend cerró la sesión, para mostrarlo en la pantalla de inicio. */
export const motivoSalidaAtom = atom<string | null>(null);
