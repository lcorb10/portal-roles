import { useQuery } from "@tanstack/react-query";
import { atom, useAtom, useAtomValue } from "jotai";
import { ArrowUp, Eraser, Info, Landmark, ShieldCheck, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Encabezado } from "@/components/encabezado";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { preguntasQuery, usePreguntar } from "@/consultas";
import { sesionAtom } from "@/estado/sesion";
import { mensaje as mensajeError } from "@/lib/api";
import { iniciales } from "@/lib/formato";
import type { Pregunta } from "@/lib/tipos";
import { cn } from "@/lib/utils";

interface Mensaje {
  id: number;
  autor: "persona" | "asistente" | "sistema";
  texto: string;
  tono?: "aviso" | "error";
  /** Pregunta oficial a la que el intérprete tradujo el mensaje. */
  interpretada?: string | null;
  /** Mensaje fijo del portal (saludo, ayuda…), no de la IA. */
  delPortal?: boolean;
}

/** La conversación sobrevive al cambiar de página, pero es de cada persona. */
const conversacionAtom = atom<{ usuarioId: number | null; mensajes: Mensaje[] }>({ usuarioId: null, mensajes: [] });
let siguienteId = 1;
const SIN_RESPUESTA =
  "No entendí esa pregunta y el asistente no responde lo que no sabe. Prueba con tus palabras sobre tus roles, tu perfil o el acceso, o escribe «ayuda».";

function Escribiendo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      className="flex items-end gap-2.5"
      role="status"
      aria-label="El asistente está escribiendo"
    >
      <AvatarAsistente />
      <div className="flex h-10 items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/70"
            animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function AvatarAsistente({ grande }: { grande?: boolean }) {
  return (
    <img
      src="/img/marca/asistente.webp"
      alt=""
      className={cn("shrink-0 rounded-full bg-[#f4efe9] ring-1 ring-black/5", grande ? "size-16" : "size-8")}
    />
  );
}

function Burbuja({ m, nombre }: { m: Mensaje; nombre: string }) {
  if (m.autor === "sistema") {
    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "mx-auto flex max-w-md items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs",
          m.tono === "error"
            ? "border-destructive/25 bg-destructive/5 text-foreground"
            : "border-dashed text-muted-foreground",
        )}
      >
        {m.tono === "error" ? (
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-destructive" />
        ) : (
          <Info className="mt-px size-3.5 shrink-0" />
        )}
        {m.texto}
      </motion.div>
    );
  }
  const propio = m.autor === "persona";
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn("flex items-end gap-2.5", propio && "flex-row-reverse")}
    >
      {propio ? (
        <Avatar className="size-8">
          <AvatarFallback className="bg-brand-soft text-xs font-semibold text-brand">
            {iniciales(nombre)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <AvatarAsistente />
      )}
      <div className={cn("flex max-w-[min(80%,34rem)] flex-col gap-1", propio ? "items-end" : "items-start")}>
        {!propio && (m.interpretada || m.delPortal) && (
          <span className="inline-flex items-center gap-1 px-1 text-[0.7rem] text-muted-foreground">
            {m.delPortal ? (
              <>
                <Landmark className="size-3" /> Mensaje del portal
              </>
            ) : (
              <>
                <Wand2 className="size-3" /> Entendí: «{m.interpretada}»
              </>
            )}
          </span>
        )}
        <p
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-pretty",
            propio ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted",
            m.delPortal && "border border-dashed bg-transparent",
          )}
        >
          {m.texto}
        </p>
      </div>
    </motion.div>
  );
}

function Sugerencias({
  preguntas,
  alElegir,
  deshabilitado,
  grande,
}: {
  preguntas: Pregunta[];
  alElegir: (p: string) => void;
  deshabilitado: boolean;
  grande?: boolean;
}) {
  return (
    <div
      className={cn(
        grande
          ? "grid gap-2 sm:grid-cols-2"
          : "-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto [mask-image:linear-gradient(90deg,black_92%,transparent)] px-1 pb-1",
      )}
    >
      {preguntas.map((p, i) => {
        const soloAdmin = p.perfil === "ADMINISTRADOR";
        return (
          <motion.button
            key={p.id}
            type="button"
            initial={grande ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: grande ? i * 0.035 : 0 }}
            disabled={deshabilitado}
            onClick={() => alElegir(p.pregunta)}
            className={cn(
              "group flex items-center gap-2 border bg-card text-left text-sm transition-[background-color,border-color,transform] duration-150 hover:border-foreground/20 hover:bg-accent active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
              grande ? "rounded-xl px-4 py-3" : "shrink-0 rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap",
            )}
          >
            {soloAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldCheck className="size-3.5 shrink-0 text-gold" aria-label="Solo administradores" />
                </TooltipTrigger>
                <TooltipContent>Solo para administradores</TooltipContent>
              </Tooltip>
            )}
            <span className="flex-1">{p.pregunta}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default function Asistente() {
  const yo = useAtomValue(sesionAtom)!;
  const [conversacion, setConversacion] = useAtom(conversacionAtom);
  const [texto, setTexto] = useState("");
  const preguntar = usePreguntar();
  const preguntas = useQuery(preguntasQuery(yo.perfil));
  const finRef = useRef<HTMLDivElement>(null);
  const entradaRef = useRef<HTMLInputElement>(null);

  const mensajes = conversacion.usuarioId === yo.id ? conversacion.mensajes : [];
  const agregar = (m: Omit<Mensaje, "id">) =>
    setConversacion((c) => ({
      usuarioId: yo.id,
      mensajes: [...(c.usuarioId === yo.id ? c.mensajes : []), { ...m, id: siguienteId++ }],
    }));

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes.length, preguntar.isPending]);

  function enviar(pregunta: string) {
    if (!pregunta.trim() || preguntar.isPending) return;
    agregar({ autor: "persona", texto: pregunta });
    setTexto("");
    preguntar.mutate(
      // El intérprete traduce el mensaje a la pregunta oficial; la respuesta siempre viene de la IA.
      { pregunta, estricto: false },
      {
        onSuccess: (r) =>
          r.respuesta
            ? agregar({
                autor: "asistente",
                texto: r.respuesta,
                interpretada: r.interpretada_como,
                delPortal: r.origen === "portal",
              })
            : agregar({ autor: "sistema", texto: SIN_RESPUESTA, tono: "aviso" }),
        onError: (e) => agregar({ autor: "sistema", texto: mensajeError(e), tono: "error" }),
        onSettled: () => entradaRef.current?.focus(),
      },
    );
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    enviar(texto);
  }

  const vacio = mensajes.length === 0;

  return (
    <>
      <Encabezado
        antetitulo="Asistente"
        titulo="Pregúntale al portal"
        descripcion="Escríbele con tus palabras: entiende tu intención y la respuesta siempre viene del servicio de IA."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {!vacio && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConversacion({ usuarioId: yo.id, mensajes: [] })}
                disabled={preguntar.isPending}
              >
                <Eraser /> Nueva conversación
              </Button>
            )}
          </div>
        }
      />

      <section className="tarjeta flex min-h-[560px] flex-col overflow-hidden lg:h-[calc(100dvh-16rem)]">
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {vacio ? (
            <div className="mx-auto flex max-w-2xl flex-col items-center py-6 text-center">
              <AvatarAsistente grande />
              <h2 className="mt-4 text-lg font-semibold tracking-tight">
                Hola, {yo.nombre.split(" ")[0]}. ¿En qué te ayudo?
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Sparkles className="size-3.5 text-brand" />
                Elige una pregunta o escríbela como te salga.
              </p>
              <div className="mt-7 w-full">
                {preguntas.isPending ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-12 rounded-xl" />
                    ))}
                  </div>
                ) : preguntas.error ? (
                  <p className="text-sm text-destructive">{mensajeError(preguntas.error)}</p>
                ) : preguntas.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay preguntas disponibles para tu perfil.</p>
                ) : (
                  <Sugerencias
                    preguntas={preguntas.data}
                    alElegir={enviar}
                    deshabilitado={preguntar.isPending}
                    grande
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4" aria-live="polite">
              {mensajes.map((m) => (
                <Burbuja key={m.id} m={m} nombre={yo.nombre} />
              ))}
              <AnimatePresence>{preguntar.isPending && <Escribiendo />}</AnimatePresence>
              <div ref={finRef} />
            </div>
          )}
        </div>

        <div className="border-t bg-background/40 px-4 py-3 sm:px-6">
          {!vacio && preguntas.data && preguntas.data.length > 0 && (
            <div className="mx-auto mb-3 max-w-3xl">
              <Sugerencias preguntas={preguntas.data} alElegir={enviar} deshabilitado={preguntar.isPending} />
            </div>
          )}
          <form onSubmit={alEnviar} className="relative mx-auto max-w-3xl">
            <label htmlFor="pregunta" className="sr-only">
              Escribe tu pregunta
            </label>
            <input
              ref={entradaRef}
              id="pregunta"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={500}
              autoComplete="off"
              placeholder="Escribe lo que quieras saber, p. ej.: ¿soy admin?"
              className="h-12 w-full rounded-xl border bg-background pr-14 pl-4 text-sm transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar pregunta"
              disabled={!texto.trim() || preguntar.isPending}
              className="absolute top-1/2 right-1.5 size-9 -translate-y-1/2 rounded-lg active:scale-95"
            >
              <ArrowUp />
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
