import type { ReactNode } from "react";

export function Encabezado({
  titulo,
  descripcion,
  acciones,
  antetitulo,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  antetitulo?: string;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {antetitulo && (
          <p className="mb-1.5 text-xs font-semibold tracking-[0.14em] text-brand uppercase">{antetitulo}</p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{titulo}</h1>
        {descripcion && <p className="mt-1.5 max-w-2xl text-sm text-pretty text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}
