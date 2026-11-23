"""Protección contra bots en el inicio de sesión (autoalojada, sin servicios externos).

Funciona como Cloudflare Turnstile o ALTCHA, pero sin depender de internet:

1. **Prueba de trabajo (proof of work)**: antes de iniciar sesión, el navegador pide un reto firmado y
   busca un número (nonce) tal que SHA-256(reto + nonce) empiece con N bits en cero. A una persona le
   cuesta milisegundos y no lo nota; a un bot que intenta miles de contraseñas le cuesta muchísimo.
   El reto está firmado con SESSION_SECRET, vence en 2 minutos y solo se puede usar una vez.
2. **Dificultad adaptativa**: tras varios intentos fallidos desde una IP, el reto es más difícil.
3. **Límite de intentos**: demasiados fallos desde una IP o contra un mismo usuario → 429 por unos minutos.
4. **Campo trampa (honeypot)**: un campo invisible que solo rellenan los bots.

Los contadores viven en memoria (un solo proceso de backend); en producción con varias réplicas irían
en Redis. Además nginx limita la frecuencia de peticiones a /api/auth/ (ver frontend/nginx.conf).
"""

import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque

DIFICULTAD_BASE = 16  # bits en cero: ~65 mil intentos en promedio (milisegundos en un navegador)
DIFICULTAD_ALTA = 19  # tras varios fallos desde la misma IP (~8 veces más trabajo)
VIGENCIA_RETO = 120  # segundos
VENTANA = 10 * 60  # segundos en los que se cuentan los fallos
FALLOS_PARA_ENDURECER = 3
MAX_FALLOS_IP = 10
MAX_FALLOS_USUARIO = 5
BLOQUEO = 5 * 60  # segundos

MSG_DEMASIADOS = "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo."
MSG_VERIFICACION = "No pudimos verificar que eres una persona. Recarga la página e intenta de nuevo."


def _bits_en_cero(digest: bytes) -> int:
    bits = 0
    for byte in digest:
        if byte == 0:
            bits += 8
            continue
        return bits + (8 - byte.bit_length())
    return bits


class Proteccion:
    def __init__(self, secreto: str) -> None:
        self._clave = hashlib.sha256(("proteccion:" + secreto).encode()).digest()
        self._fallos: dict[str, deque[float]] = defaultdict(deque)
        self._bloqueados: dict[str, float] = {}
        self._usados: dict[str, float] = {}

    # ── Retos ────────────────────────────────────────────────────────────────────────────

    def _firmar(self, texto: str) -> str:
        return hmac.new(self._clave, texto.encode(), hashlib.sha256).hexdigest()[:32]

    def nuevo_reto(self, ip: str) -> dict[str, object]:
        dificultad = DIFICULTAD_ALTA if self._contar(f"ip:{ip}") >= FALLOS_PARA_ENDURECER else DIFICULTAD_BASE
        vence = int(time.time()) + VIGENCIA_RETO
        cuerpo = f"{secrets.token_hex(12)}.{dificultad}.{vence}"
        return {"reto": f"{cuerpo}.{self._firmar(cuerpo)}", "dificultad": dificultad, "vence": vence}

    def verificar(self, reto: str, nonce: str) -> bool:
        partes = reto.split(".")
        if len(partes) != 4 or not nonce or len(nonce) > 32:
            return False
        sal, dificultad, vence, firma = partes
        cuerpo = f"{sal}.{dificultad}.{vence}"
        if not hmac.compare_digest(firma, self._firmar(cuerpo)):
            return False
        ahora = time.time()
        if not vence.isdigit() or int(vence) < ahora or not dificultad.isdigit():
            return False
        self._usados = {r: v for r, v in self._usados.items() if v > ahora}
        if reto in self._usados:  # un reto solo sirve una vez
            return False
        if _bits_en_cero(hashlib.sha256(f"{reto}{nonce}".encode()).digest()) < int(dificultad):
            return False
        self._usados[reto] = int(vence)
        return True

    # ── Intentos fallidos ────────────────────────────────────────────────────────────────

    def _contar(self, clave: str) -> int:
        cola = self._fallos[clave]
        limite = time.time() - VENTANA
        while cola and cola[0] < limite:
            cola.popleft()
        return len(cola)

    def bloqueado(self, ip: str, usuario: str) -> bool:
        ahora = time.time()
        return any(self._bloqueados.get(c, 0) > ahora for c in (f"ip:{ip}", f"u:{usuario}"))

    def registrar_fallo(self, ip: str, usuario: str) -> None:
        ahora = time.time()
        for clave, maximo in ((f"ip:{ip}", MAX_FALLOS_IP), (f"u:{usuario}", MAX_FALLOS_USUARIO)):
            self._fallos[clave].append(ahora)
            if self._contar(clave) >= maximo:
                self._bloqueados[clave] = ahora + BLOQUEO

    def registrar_exito(self, ip: str, usuario: str) -> None:
        self._fallos.pop(f"u:{usuario}", None)
