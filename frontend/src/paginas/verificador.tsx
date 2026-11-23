import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleMinus, Loader2, ScanSearch, ServerCrash, ShieldX, UserCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";

import { Encabezado } from "@/components/encabezado";
import { ErrorCarga } from "@/components/estados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verificarQuery } from "@/consultas";
import type { RolAcceso, Verificacion } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const EJEMPLOS = ["pedro.funcionario", "mario.mayusculas", "luis.externo", "usuario.error"];

function Roles({ titulo, roles, vacio }: { titulo: string; roles: RolAcceso[]; vacio: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</p>
      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {roles.map((r) => (
            <li key={r.codigo} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span>
                <span className="font-mono font-medium">{r.codigo}</span>
                {r.original.trim() !== r.codigo && (
                  <span className="ml-2 font-mono text-xs whitespace-pre text-muted-foreground">«{r.original}»</span>
                )}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  r.da_acceso ? "text-success" : "text-muted-foreground",
                )}
              >
                {r.da_acceso ? <CircleCheck className="size-3.5" /> : <CircleMinus className="size-3.5" />}
                {r.motivo}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Resultado({ v }: { v: Verificacion }) {
  const servicioCaido = v.en_sistema_de_roles === null && v.activo !== false;
  const Icono = v.entraria ? UserCheck : servicioCaido ? ServerCrash : ShieldX;
  return (
    <motion.section
      key={v.usuario}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      className="tarjeta overflow-hidden"
    >
      <div
        className={cn(
          "flex items-start gap-4 p-5 sm:p-6",
          v.entraria ? "bg-success-soft" : servicioCaido ? "bg-warning/10" : "bg-destructive/[0.06]",
        )}
      >
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl",
            v.entraria
              ? "bg-success text-white"
              : servicioCaido
                ? "bg-warning text-white"
                : "bg-destructive text-white",
          )}
        >
          <Icono className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm text-muted-foreground">{v.usuario}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">
            {v.entraria ? "Entraría al portal" : servicioCaido ? "No se pudo verificar" : "No entraría"}
          </p>
          <p className="mt-1 text-sm">{v.mensaje}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="outline">{v.registrado ? "Registrado en el portal" : "Aún no registrado"}</Badge>
            {v.activo === false && <Badge variant="destructive">Desactivado</Badge>}
            {v.en_sistema_de_roles === false && <Badge variant="outline">No está en el sistema de roles</Badge>}
            {v.perfil && <Badge variant="outline">{v.perfil}</Badge>}
          </div>
        </div>
      </div>
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-2">
        <Roles
          titulo="Sistema institucional"
          roles={v.roles_institucionales}
          vacio={servicioCaido ? "El servicio de roles no respondió." : "Sin roles institucionales."}
        />
        <Roles titulo="Asignados en el portal" roles={v.roles_asignados} vacio="Ningún rol asignado." />
      </div>
    </motion.section>
  );
}

export default function Verificador() {
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState("");
  const { data, isFetching, error, refetch } = useQuery(verificarQuery(consulta));

  function enviar(e: FormEvent) {
    e.preventDefault();
    const limpio = texto.trim().toLowerCase();
    if (limpio === consulta) void refetch();
    else setConsulta(limpio);
  }

  return (
    <>
      <Encabezado
        antetitulo="Administración"
        titulo="Verificador de acceso"
        descripcion="Escribe un usuario y mira si entraría al portal y por qué, con las mismas reglas del inicio de sesión. Consulta el servicio de roles en vivo, sin contraseña y sin registrar a nadie."
      />
      <form onSubmit={enviar} className="tarjeta flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative flex-1">
          <ScanSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="nombre.apellido"
            className="h-11 pl-9 font-mono"
            autoCapitalize="none"
            spellCheck={false}
            aria-label="Usuario a verificar"
          />
        </div>
        <Button type="submit" size="lg" className="h-11" disabled={texto.trim().length < 2 || isFetching}>
          {isFetching && <Loader2 className="animate-spin" />} Verificar
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Prueba con:
        {EJEMPLOS.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => {
              setTexto(u);
              setConsulta(u);
            }}
            className="rounded-full border bg-card px-2.5 py-1 font-mono transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {u}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {error ? <ErrorCarga error={error} reintentar={() => refetch()} /> : data ? <Resultado v={data} /> : null}
        </AnimatePresence>
      </div>
    </>
  );
}
