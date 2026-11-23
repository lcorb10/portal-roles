import { Bot, CalendarCheck2, KeyRound, LifeBuoy, Mail, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

import { Encabezado } from "@/components/encabezado";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Kbd } from "@/components/ui/kbd";

const TEMAS = [
  {
    titulo: "Acceso al portal",
    Icono: KeyRound,
    preguntas: [
      [
        "¿Por qué puedo (o no) entrar?",
        "El portal suma los roles que reporta el sistema institucional y los que te asignó un administrador. Entras si al menos uno está en el catálogo del portal y activo. EGRESADOS por sí solo no da acceso; si además tienes otro rol válido, entras por ese.",
      ],
      [
        "Mi rol aparece escrito distinto, ¿importa?",
        "No. Los roles se comparan sin importar mayúsculas, tildes ni espacios: «Catedraticos» y «CATEDRÁTICOS» son el mismo rol.",
      ],
      [
        "Me sale «No pudimos verificar tus roles»",
        "El servicio de roles no respondió a tiempo o tuvo un error. Por seguridad no se deja entrar a nadie en ese caso. Intenta de nuevo en unos minutos.",
      ],
      [
        "Me desactivaron, ¿qué hago?",
        "Un usuario desactivado no entra aunque tenga roles. Habla con quien administra el portal para que te active de nuevo.",
      ],
    ],
  },
  {
    titulo: "Perfiles y roles",
    Icono: ShieldCheck,
    preguntas: [
      [
        "¿Qué diferencia hay entre administrador y consultante?",
        "El consultante ve su acceso, reserva espacios y usa el asistente. El administrador además gestiona roles, usuarios, espacios y reservas, y puede verificar el acceso de cualquier persona.",
      ],
      [
        "¿Cómo pido un rol o el perfil de administrador?",
        "Solo un administrador puede asignarte roles o cambiar tu perfil. Los cambios se aplican en tu siguiente acción, sin volver a iniciar sesión.",
      ],
    ],
  },
  {
    titulo: "Reserva de espacios",
    Icono: CalendarCheck2,
    preguntas: [
      [
        "¿Qué espacios puedo reservar?",
        "Cada espacio indica qué roles lo pueden reservar. En «Espacios» verás marcados en verde los que te habilitan tus roles.",
      ],
      [
        "¿Cuáles son las reglas?",
        "De 7:00 a. m. a 9:00 p. m., hasta 4 horas por reserva, hasta 30 días adelante y máximo 3 reservas pendientes por persona. Un horario no puede tener dos reservas y tú no puedes estar en dos lugares a la vez.",
      ],
      ["¿Cómo cancelo?", "En «Mis reservas», con el botón Cancelar. El horario queda libre de inmediato."],
    ],
  },
  {
    titulo: "Asistente",
    Icono: Bot,
    preguntas: [
      [
        "¿Qué entiende el asistente?",
        "Responde un conjunto de preguntas sobre tu acceso. Puedes escribirlas con tus palabras: un intérprete las traduce a la pregunta oficial y la respuesta siempre viene del servicio de IA. Si no entiende, no inventa nada.",
      ],
      [
        "¿Qué es el modo estricto?",
        "Con el modo estricto activo, el asistente solo responde si escribes la pregunta exactamente igual (mayúsculas, tildes y signos incluidos).",
      ],
    ],
  },
];

export default function Ayuda() {
  return (
    <>
      <Encabezado
        antetitulo="Soporte"
        titulo="Centro de ayuda"
        descripcion={
          <>
            Respuestas rápidas sobre el portal. Consejo: con <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> puedes ir a cualquier página
            o espacio.
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {TEMAS.map(({ titulo, Icono, preguntas }) => (
            <section key={titulo} className="tarjeta p-5 sm:p-6">
              <h2 className="mb-2 flex items-center gap-2 font-semibold tracking-tight">
                <Icono className="size-4 text-brand" /> {titulo}
              </h2>
              <Accordion type="single" collapsible>
                {preguntas.map(([p, r]) => (
                  <AccordionItem key={p} value={p}>
                    <AccordionTrigger className="text-[0.92rem]">{p}</AccordionTrigger>
                    <AccordionContent className="leading-relaxed text-muted-foreground">{r}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
        <aside className="space-y-4">
          <div className="tarjeta overflow-hidden">
            <div className="flex items-center gap-3 bg-header p-5 text-header-foreground">
              <img src="/img/marca/asistente.webp" alt="" className="size-12 rounded-full bg-[#f4efe9]" />
              <div>
                <p className="font-semibold">¿Prefieres preguntar?</p>
                <p className="text-sm text-header-muted">El asistente responde al instante.</p>
              </div>
            </div>
            <div className="p-4">
              <Link
                to="/asistente"
                viewTransition
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Bot className="size-4" /> Abrir el asistente
              </Link>
            </div>
          </div>
          <div className="tarjeta p-5">
            <p className="flex items-center gap-2 font-semibold tracking-tight">
              <LifeBuoy className="size-4 text-brand" /> Mesa de ayuda TI
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Lunes a viernes, 7:00 a. m. – 6:00 p. m.</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" /> mesadeayuda@ejemplo.edu.co
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" /> Ext. 4040
              </li>
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Datos de contacto ficticios (prueba técnica).</p>
          </div>
        </aside>
      </div>
    </>
  );
}
