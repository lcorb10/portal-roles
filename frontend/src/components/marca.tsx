import { cn } from "@/lib/utils";

/**
 * Isotipo del portal: tres carnés superpuestos (los roles que se suman). Concepto elegido entre las
 * propuestas generadas con Gemini y redibujado en SVG. La carta del medio usa currentColor para
 * verse tanto en fondo claro como oscuro.
 */
export function Marca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <g transform="rotate(-14 24 24)">
        <rect x="13" y="7" width="29" height="19.5" rx="3.6" fill="#FFCD00" />
        <rect x="9.5" y="11.5" width="29" height="19.5" rx="3.6" fill="currentColor" />
        <rect x="6" y="16" width="29" height="19.5" rx="3.6" fill="#CB333B" />
        <circle cx="12.6" cy="25.8" r="3.1" fill="#fff" />
        <rect x="18.2" y="22.6" width="12.4" height="2.6" rx="1.3" fill="#fff" />
        <rect x="18.2" y="27.6" width="8" height="2.6" rx="1.3" fill="#fff" opacity=".75" />
      </g>
    </svg>
  );
}

export function Logotipo({ className, compacto }: { className?: string; compacto?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Marca className="size-9" />
      <div className="leading-none">
        <p className="text-[0.98rem] font-bold tracking-[-0.02em]">Portal de Roles</p>
        {!compacto && (
          <p className="mt-1 text-[0.68rem] font-medium tracking-[0.08em] uppercase opacity-60">Campus · Acceso</p>
        )}
      </div>
    </div>
  );
}
