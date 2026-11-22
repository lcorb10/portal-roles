import { useAtom } from "jotai";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ServerCrash,
  ShieldX,
  UserRound,
  UsersRound,
} from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";

import { Marca } from "@/components/marca";
import { SelectorTema } from "@/components/selector-tema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmarSesion, useLogin } from "@/consultas";
import { motivoSalidaAtom } from "@/estado/sesion";
import { ApiError, mensaje } from "@/lib/api";
import type { MiAcceso } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const PASOS = ["Validando usuario y contraseña", "Consultando tus roles institucionales", "Decidiendo tu acceso"];

/** Personas de dataMock.js. Se muestran para facilitar la evaluación (VITE_PERSONAS_PRUEBA=false las oculta). */
const PERSONAS: { usuario: string; resultado: "entra" | "no" | "error"; nota: string }[] = [
  { usuario: "admin.prueba", resultado: "entra", nota: "Administrador" },
  { usuario: "ana.estudiante", resultado: "entra", nota: "Estudiante" },
  { usuario: "carlos.profesor", resultado: "entra", nota: "Dos roles" },
  { usuario: "diana.catedratica", resultado: "entra", nota: "Rol sin tilde" },
  { usuario: "pedro.funcionario", resultado: "entra", nota: "Egresado + funcionario" },
  { usuario: "laura.egresada", resultado: "no", nota: "Solo egresada" },
  { usuario: "mario.mayusculas", resultado: "no", nota: "«  egresados »" },
  { usuario: "sofia.sinrol", resultado: "no", nota: "Sin roles" },
  { usuario: "jorge.contratista", resultado: "no", nota: "Rol fuera del catálogo" },
  { usuario: "luis.externo", resultado: "no", nota: "No está en roles" },
  { usuario: "usuario.error", resultado: "error", nota: "Servicio falla" },
];
const CONTRASENA_PRUEBA = "Prueba2026*";
const MOSTRAR_PERSONAS = import.meta.env.VITE_PERSONAS_PRUEBA !== "false";

type Resultado =
  { tipo: "concedido"; yo: MiAcceso } | { tipo: "credenciales" | "denegado" | "servicio" | "red"; mensaje: string };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clasificar(error: unknown): Resultado {
  if (error instanceof ApiError) {
    if (error.estado === 401) return { tipo: "credenciales", mensaje: error.message };
    if (error.estado === 403) return { tipo: "denegado", mensaje: error.message };
    if (error.estado === 0) return { tipo: "red", mensaje: error.message };
    if (error.estado >= 500) return { tipo: "servicio", mensaje: error.message };
  }
  return { tipo: "servicio", mensaje: mensaje(error) };
}

// ── Panel ilustrado (izquierda) ─────────────────────────────────────────────────────────

const CAPAS = [
  { rol: "FUNCIONARIOS", tono: "bg-[#cb333b]", texto: "text-white", acceso: true },
  { rol: "PROFESORES", tono: "bg-[#f4efe9]", texto: "text-[#211d1b]", acceso: true },
  { rol: "ESTUDIANTES", tono: "bg-[#e8b923]", texto: "text-[#211d1b]", acceso: true },
  {
    rol: "EGRESADOS",
    tono: "bg-white/5 border border-dashed border-white/25",
    texto: "text-white/45 line-through",
    acceso: false,
  },
];

function Ilustracion() {
  return (
    <div className="relative mx-auto h-72 w-full max-w-sm [perspective:900px]" aria-hidden="true">
      {CAPAS.map((capa, i) => (
        <motion.div
          key={capa.rol}
          initial={{ opacity: 0, y: 30, rotateX: 58, rotateZ: -38 }}
          animate={{ opacity: 1, y: 0, rotateX: 58, rotateZ: -38 }}
          transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 120, damping: 18 }}
          className="absolute inset-x-6 h-36 [transform-style:preserve-3d]"
          style={{ top: `${i * 52}px`, zIndex: CAPAS.length - i }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
            className={cn(
              "flex h-full w-full items-end justify-between rounded-2xl p-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]",
              capa.tono,
            )}
          >
            <span className={cn("font-mono text-xs font-semibold tracking-wider", capa.texto)}>{capa.rol}</span>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

function PanelMarca() {
  return (
    <section className="relative hidden overflow-hidden bg-[#1a1716] text-[#f4efe9] lg:flex lg:flex-col">
      {/* Retícula y halo de color */}
      <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:44px_44px] opacity-[0.07]" />
      <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-[#cb333b]/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-48 -left-24 size-[420px] rounded-full bg-[#e8b923]/12 blur-[110px]" />

      <div className="relative flex items-center gap-2.5 px-12 pt-10">
        <Marca />
        <span className="font-semibold tracking-tight">Portal de Roles</span>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-12">
        <Ilustracion />
        <h2 className="mt-14 max-w-md text-[2.1rem] leading-[1.1] font-semibold tracking-tight text-balance">
          Tu acceso, decidido por tus roles.
        </h2>
        <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-[#f4efe9]/65">
          Sumamos los roles del sistema institucional y los que te asigna un administrador. Con uno que dé acceso,
          entras. <span className="text-[#e8b923]">EGRESADOS</span> por sí solo no da acceso.
        </p>
      </div>

      <p className="relative px-12 pb-8 text-xs text-[#f4efe9]/40">
        Servicios institucionales simulados · Prueba técnica
      </p>
    </section>
  );
}

// ── Veredicto ───────────────────────────────────────────────────────────────────────────

function CheckAnimado() {
  return (
    <motion.svg viewBox="0 0 52 52" className="size-16" initial="oculto" animate="visible">
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        strokeWidth="2.5"
        className="stroke-success"
        variants={{ oculto: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1 } }}
        transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.path
        d="M15 27l7 7 15-16"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-success"
        variants={{ oculto: { pathLength: 0 }, visible: { pathLength: 1 } }}
        transition={{ delay: 0.35, duration: 0.35, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

function Concedido({ yo }: { yo: MiAcceso }) {
  return (
    <motion.div
      key="concedido"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col items-center py-6 text-center"
      role="status"
    >
      <CheckAnimado />
      <p className="mt-5 text-xl font-semibold tracking-tight">Acceso concedido</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Hola, {yo.nombre.split(" ")[0]}. Entras como <span className="font-medium text-foreground">{yo.perfil}</span>
        {yo.roles_con_acceso.length > 0 && (
          <>
            {" "}
            por <span className="font-medium text-foreground">{yo.roles_con_acceso.join(", ")}</span>
          </>
        )}
        .
      </p>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full bg-success"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.1, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

function AvisoRechazo({ resultado }: { resultado: Exclude<Resultado, { tipo: "concedido" }> }) {
  const config = {
    credenciales: { Icono: CircleAlert, titulo: "No pudimos iniciar tu sesión", tono: "destructive" },
    denegado: { Icono: ShieldX, titulo: "Acceso denegado", tono: "destructive" },
    servicio: { Icono: ServerCrash, titulo: "Servicio no disponible", tono: "warning" },
    red: { Icono: ServerCrash, titulo: "Sin conexión", tono: "warning" },
  }[resultado.tipo];
  const { Icono } = config;
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      className="overflow-hidden"
    >
      <div
        className={cn(
          "flex gap-3 rounded-xl border p-3.5 text-sm",
          config.tono === "destructive"
            ? "border-destructive/25 bg-destructive/[0.06]"
            : "border-warning/30 bg-warning/[0.08]",
        )}
      >
        <Icono
          className={cn("mt-0.5 size-4 shrink-0", config.tono === "destructive" ? "text-destructive" : "text-warning")}
        />
        <div>
          <p className="font-medium">{config.titulo}</p>
          <p className="mt-0.5 text-muted-foreground">{resultado.mensaje}</p>
        </div>
      </div>
    </motion.div>
  );
}

function Progreso({ paso }: { paso: number }) {
  return (
    <motion.ol
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-2 overflow-hidden"
      aria-live="polite"
    >
      {PASOS.map((texto, i) => {
        const hecho = i < paso;
        const actual = i === paso;
        return (
          <li key={texto} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border transition-colors duration-200",
                hecho && "border-success bg-success text-white",
                actual && "border-brand",
              )}
            >
              {hecho ? (
                <Check className="size-3" />
              ) : actual ? (
                <Loader2 className="size-3 animate-spin text-brand" />
              ) : null}
            </span>
            <span className={cn("transition-colors", hecho || actual ? "text-foreground" : "text-muted-foreground/60")}>
              {texto}
            </span>
          </li>
        );
      })}
    </motion.ol>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────────────────

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [paso, setPaso] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [motivoSalida, setMotivoSalida] = useAtom(motivoSalidaAtom);
  const [alcance, animar] = useAnimate();
  const usuarioRef = useRef<HTMLInputElement>(null);

  const login = useLogin();
  const confirmar = useConfirmarSesion();
  const navegar = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;

  // No basta con login.isPending: tras la respuesta se espera un instante para que el progreso
  // se alcance a leer, y durante esa espera el formulario debe seguir en "verificando".
  const [verificando, setVerificando] = useState(false);
  const concedido = resultado?.tipo === "concedido";

  useEffect(() => {
    if (!verificando) return;
    const id = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 420);
    return () => clearInterval(id);
  }, [verificando]);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (verificando || concedido) return;
    setResultado(null);
    setMotivoSalida(null);
    setPaso(0);
    setVerificando(true);
    const inicio = Date.now();
    try {
      const yo = await login.mutateAsync({ usuario: usuario.trim(), contrasena });
      await esperar(Math.max(0, 1100 - (Date.now() - inicio)));
      setPaso(PASOS.length);
      await esperar(250);
      setVerificando(false);
      setResultado({ tipo: "concedido", yo });
      await esperar(1200);
      confirmar(yo);
      navegar(desde && desde !== "/login" ? desde : "/mi-acceso", { replace: true });
    } catch (error) {
      await esperar(Math.max(0, 800 - (Date.now() - inicio)));
      setVerificando(false);
      const r = clasificar(error);
      setResultado(r);
      if (alcance.current) animar(alcance.current, { x: [0, -8, 8, -5, 5, -2, 0] }, { duration: 0.42 });
      if (r.tipo === "credenciales") setContrasena("");
    }
  }

  function elegirPersona(nombre: string) {
    setUsuario(nombre);
    setContrasena(CONTRASENA_PRUEBA);
    setResultado(null);
    setMotivoSalida(null);
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <PanelMarca />

      <section className="relative flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <Marca />
            <span className="font-semibold tracking-tight">Portal de Roles</span>
          </div>
          <SelectorTema />
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <AnimatePresence mode="wait" initial={false}>
            {resultado?.tipo === "concedido" ? (
              <Concedido yo={resultado.yo} />
            ) : (
              <motion.div key="formulario" exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15 }}>
                <h1 className="text-[1.75rem] font-semibold tracking-tight">Inicia sesión</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Usa tu usuario y contraseña institucionales.</p>

                <AnimatePresence>
                  {motivoSalida && !resultado && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-6 flex gap-3 rounded-xl border border-warning/30 bg-warning/[0.08] p-3.5 text-sm">
                        <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                        <div>
                          <p className="font-medium">Tu sesión terminó</p>
                          <p className="mt-0.5 text-muted-foreground">{motivoSalida}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form ref={alcance} onSubmit={enviar} className="mt-8 space-y-5" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="usuario">Usuario</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={usuarioRef}
                        id="usuario"
                        name="username"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="nombre.apellido"
                        className="h-11 pl-9"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        disabled={verificando}
                        aria-invalid={resultado?.tipo === "credenciales" || undefined}
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contrasena">Contraseña</Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="contrasena"
                        name="password"
                        type={verClave ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Tu contraseña"
                        className="h-11 pr-11 pl-9"
                        value={contrasena}
                        onChange={(e) => setContrasena(e.target.value)}
                        disabled={verificando}
                        aria-invalid={resultado?.tipo === "credenciales" || undefined}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setVerClave((v) => !v)}
                        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {verificando && <Progreso key="progreso" paso={paso} />}
                    {resultado && !verificando && <AvisoRechazo key="aviso" resultado={resultado} />}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 w-full text-[0.95rem] active:scale-[0.985]"
                    disabled={verificando || !usuario.trim() || !contrasena}
                  >
                    {verificando ? (
                      <>
                        <Loader2 className="animate-spin" /> Verificando…
                      </>
                    ) : (
                      <>
                        Entrar <ArrowRight />
                      </>
                    )}
                  </Button>
                </form>

                {MOSTRAR_PERSONAS && (
                  <details className="group mt-10 rounded-xl border">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <UsersRound className="size-4" />
                      Personas de prueba
                      <span className="ml-auto text-xs font-normal text-muted-foreground/70">
                        contraseña {CONTRASENA_PRUEBA}
                      </span>
                    </summary>
                    <ul className="grid gap-1 border-t p-2 sm:grid-cols-2">
                      {PERSONAS.map((p) => (
                        <li key={p.usuario}>
                          <button
                            type="button"
                            onClick={() => {
                              elegirPersona(p.usuario);
                              usuarioRef.current?.focus();
                            }}
                            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
                          >
                            <span
                              className={cn(
                                "mt-1.5 size-2 shrink-0 rounded-full",
                                p.resultado === "entra" && "bg-success",
                                p.resultado === "no" && "bg-destructive",
                                p.resultado === "error" && "bg-warning",
                              )}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-xs">{p.usuario}</span>
                              <span className="block truncate text-xs text-muted-foreground">{p.nota}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
