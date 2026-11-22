/** Igual que en el backend: sin tildes, minúsculas y sin espacios en los extremos.
 *  Solo sirve para avisar antes de enviar; quien decide es el backend. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}
