"""Intérprete local del asistente: un "modelo de lenguaje" muy pequeño basado en reglas.

No genera respuestas. Solo reconoce la intención de un mensaje escrito con libertad ("qué roles tengo",
"soy admin?", "cuántos usuarios hay") y lo traduce a la pregunta OFICIAL de la IA de dataMock más
parecida, que es la única que responde. Además reconoce saludos, agradecimientos y pedidos de ayuda,
que el portal contesta con mensajes fijos (marcados como del portal, no de la IA).

Con el modo estricto (el que pide el enunciado) el intérprete no se usa: la pregunta va tal cual."""

import re
import unicodedata
from dataclasses import dataclass


def limpiar(texto: str) -> str:
    """minúsculas, sin tildes, sin signos y con espacios simples."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9ñ ]", " ", sin_tildes)).strip()


# Orden importante: de lo más específico a lo más general.
INTENCIONES: list[tuple[str, re.Pattern[str]]] = [
    ("total-administradores", re.compile(r"\bcuant[oa]s?\b.*\badmin")),
    ("total-usuarios", re.compile(r"\bcuant[oa]s?\b.*\b(usuari|persona|gente|registrad|inscrit)")),
    ("egresados", re.compile(r"\begresad")),
    (
        "pedir-admin",
        re.compile(
            r"\b(pid[oe]|pedir|solicit\w*|obten\w*|ser|volverme|convertirme|hacerme|quiero ser|cambiar mi perfil)\b"
            r".*\badmin|\b(acceso|permisos?|perfil) de admin"
        ),
    ),
    ("asignar-rol", re.compile(r"\b(asign|agreg|anad|sum|dar\b|doy\b|pon)\w*\b.*\brol")),
    (
        "roles-con-acceso",
        re.compile(
            r"\broles?\b.*\b(dan|da|tienen|permiten|sirven|validos|permitidos)\b"
            r"|\bquien(es)? (puede|pueden|tiene|tienen) (entrar|ingresar|acceder|acceso)"
            r"|\b(que|cuales) (roles )?(dan|permiten) (el )?(acceso|entrar)"
        ),
    ),
    ("mi-perfil", re.compile(r"\bperfil\b|\bsoy (yo )?(un |una )?(admin\w*|consultante)\b|\bque soy\b")),
    (
        "mis-roles",
        re.compile(
            r"\b(mis|mi) roles?\b|\broles?\b.*\b(tengo|mios|tienes de mi)\b|^roles?$|\bque rol(es)? tengo"
        ),
    ),
]

SALUDO = re.compile(r"^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal|saludos|ey)\b")
GRACIAS = re.compile(r"\b(gracias|te agradezco|muy amable|genial|perfecto|excelente|listo|ok|vale)\b")
DESPEDIDA = re.compile(r"\b(chao|adios|hasta luego|nos vemos|bye)\b")
AYUDA = re.compile(
    r"\b(ayuda|ayudame|que puedes hacer|que sabes|que preguntas|opciones|como funcionas|help)\b"
)
RESERVAS = re.compile(r"\b(reserv\w*|espacios?|salon(es)?|salas?|auditorio|laboratorio|coliseo|cancha)\b")


@dataclass(frozen=True)
class Interpretacion:
    tipo: str  # "oficial" | "charla" | "nada"
    intencion: str | None = None  # id de la pregunta oficial, o tipo de charla


def interpretar(texto: str) -> Interpretacion:
    limpio = limpiar(texto)
    if not limpio:
        return Interpretacion("nada")
    for intencion, patron in INTENCIONES:
        if patron.search(limpio):
            return Interpretacion("oficial", intencion)
    if RESERVAS.search(limpio):
        return Interpretacion("charla", "reservas")
    if AYUDA.search(limpio):
        return Interpretacion("charla", "ayuda")
    if SALUDO.search(limpio):
        return Interpretacion("charla", "saludo")
    if DESPEDIDA.search(limpio):
        return Interpretacion("charla", "despedida")
    if GRACIAS.search(limpio) and len(limpio.split()) <= 5:
        return Interpretacion("charla", "gracias")
    return Interpretacion("nada")


def respuesta_de_charla(tipo: str, nombre: str, preguntas: list[str]) -> str:
    primer_nombre = nombre.split()[0] if nombre else ""
    sugeridas = "; ".join(f"«{p}»" for p in preguntas[:3])
    return {
        "saludo": f"¡Hola, {primer_nombre}! Soy el asistente del portal. Puedo contarte tus roles, tu perfil y "
        f"quién puede entrar. Prueba con {sugeridas}.",
        "gracias": "¡Con gusto! Si necesitas algo más, aquí estoy.",
        "despedida": f"¡Hasta pronto, {primer_nombre}!",
        "ayuda": "Puedo responder sobre tu acceso al portal. Estas son las preguntas que conozco: "
        + "; ".join(f"«{p}»" for p in preguntas)
        + ". Puedes escribirlas con tus palabras.",
        "reservas": "Para reservar un espacio entra a «Espacios»: ahí ves cuáles te habilitan tus roles, los horarios "
        "libres de cada uno y tus reservas.",
    }[tipo]
