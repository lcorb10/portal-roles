import { useAtom } from "jotai";
import { Monitor, Moon, Sun } from "lucide-react";

import { temaAtom, type PreferenciaTema } from "@/estado/tema";
import { cn } from "@/lib/utils";

const OPCIONES: { valor: PreferenciaTema; etiqueta: string; Icono: typeof Sun }[] = [
  { valor: "claro", etiqueta: "Claro", Icono: Sun },
  { valor: "oscuro", etiqueta: "Oscuro", Icono: Moon },
  { valor: "sistema", etiqueta: "Sistema", Icono: Monitor },
];

/** Control segmentado claro / oscuro / sistema. */
export function SelectorTema({ className }: { className?: string }) {
  const [tema, setTema] = useAtom(temaAtom);
  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}
    >
      {OPCIONES.map(({ valor, etiqueta, Icono }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={tema === valor}
          title={etiqueta}
          onClick={() => setTema(valor)}
          className={cn(
            "grid size-7 place-items-center rounded-md text-muted-foreground transition-[color,background-color,box-shadow] duration-150 hover:text-foreground",
            tema === valor && "bg-background text-foreground shadow-sm",
          )}
        >
          <Icono className="size-3.5" />
          <span className="sr-only">{etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
