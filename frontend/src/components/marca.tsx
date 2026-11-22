import { cn } from "@/lib/utils";

/** Marca del portal: tres capas (roles que se suman). Colores inspirados en Uninorte. */
export function Marca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-[#211d1b] dark:fill-[#2b2624]" />
      <path d="M16 6.5 25 11l-9 4.5L7 11z" fill="#cb333b" />
      <path
        d="m7 15.6 9 4.5 9-4.5"
        fill="none"
        stroke="#f4efe9"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m7 20.4 9 4.5 9-4.5"
        fill="none"
        stroke="#e8b923"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logotipo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Marca />
      <div className="leading-tight">
        <p className="text-[0.95rem] font-semibold tracking-tight">Portal de Roles</p>
        <p className="text-xs text-muted-foreground">Acceso institucional</p>
      </div>
    </div>
  );
}
