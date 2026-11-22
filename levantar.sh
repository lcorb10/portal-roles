#!/usr/bin/env bash
# Portal de Roles — levanta todo con Podman y un solo comando.
#
#   ./levantar.sh            construye las imágenes y arranca los 4 contenedores
#   ./levantar.sh --bajar    detiene y borra los contenedores (los datos de PostgreSQL se conservan)
#   ./levantar.sh --limpiar  igual que --bajar y además borra el volumen de datos
#   ./levantar.sh --estado   muestra los contenedores del portal
set -euo pipefail
cd "$(dirname "$0")"
# Git Bash en Windows convierte rutas como /var/lib/... en rutas de Windows: se desactiva.
export MSYS_NO_PATHCONV=1

RED=portal-red
VOLUMEN=portal-db-datos
PUERTO=${PUERTO:-8080}
CONTENEDORES=(frontend backend datamock db)

info() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
falla() { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

command -v podman >/dev/null || falla "No encuentro podman. Instálalo: https://podman.io (en Windows/macOS: Podman Desktop)."

bajar() {
  for c in "${CONTENEDORES[@]}"; do podman rm -f -t 5 "$c" >/dev/null 2>&1 || true; done
}

case "${1:-}" in
  --bajar)   bajar; ok "Contenedores detenidos (los datos siguen en el volumen $VOLUMEN)."; exit 0 ;;
  --limpiar) bajar; podman volume rm -f "$VOLUMEN" >/dev/null 2>&1 || true
             podman network rm -f "$RED" >/dev/null 2>&1 || true; ok "Todo borrado, incluido el volumen."; exit 0 ;;
  --estado)  podman ps -a --filter "network=$RED" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"; exit 0 ;;
  "") ;;
  *) falla "Opción desconocida: $1 (usa --bajar, --limpiar o --estado)" ;;
esac

# ── 1. Archivo .env ─────────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  info "No hay .env: lo creo a partir de .env.example con secretos aleatorios"
  cp .env.example .env
  aleatorio() { od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; }
  SECRETO=$(aleatorio 32); CLAVE_DB=$(aleatorio 12)
  sed -i.bak -e "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRETO|" \
             -e "s|cambiar-esta-clave|$CLAVE_DB|g" .env && rm -f .env.bak
fi
# Carga las variables (solo para pasarlas a cada contenedor; ninguna se escribe en las imágenes).
# shellcheck disable=SC1091
set -a; . <(tr -d '\r' < .env); set +a
[ "${SESSION_SECRET:-cambiar}" != "cambiar" ] || falla "Define SESSION_SECRET en .env (cadena larga y aleatoria)."

# ── 2. Red, volumen e imágenes ──────────────────────────────────────────────────────────
podman network exists "$RED" || { info "Creando la red $RED"; podman network create "$RED" >/dev/null; }
podman volume exists "$VOLUMEN" || { info "Creando el volumen $VOLUMEN"; podman volume create "$VOLUMEN" >/dev/null; }

info "Construyendo la imagen del backend"
podman build -q -t portal-roles-backend ./backend >/dev/null
info "Construyendo la imagen del frontend (compila React y la sirve con nginx)"
podman build -q -t portal-roles-frontend ./frontend >/dev/null

bajar

# ── 3. Contenedores (solo el frontend publica un puerto) ────────────────────────────────
info "Arrancando db (PostgreSQL 17)"
podman run -q -d --name db --network "$RED" --restart unless-stopped \
  -e POSTGRES_USER -e POSTGRES_PASSWORD -e POSTGRES_DB \
  -v "$VOLUMEN":/var/lib/postgresql/data \
  docker.io/library/postgres:17 >/dev/null

info "Arrancando datamock (Node 22 + dataMock.js sin cambios)"
# Se copia el archivo al contenedor en lugar de montarlo: funciona igual en Linux, Windows y macOS.
podman create -q --name datamock --network "$RED" --restart unless-stopped \
  -e TOKEN_VIGENCIA_SEGUNDOS="${TOKEN_VIGENCIA_SEGUNDOS:-300}" --user node -w /home/node \
  docker.io/library/node:22-alpine node dataMock.js >/dev/null
podman cp dataMock.js datamock:/home/node/dataMock.js
podman start datamock >/dev/null

esperar() { # descripción, intentos, comando...
  local que=$1 n=$2; shift 2
  for _ in $(seq "$n"); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  falla "$que no respondió a tiempo. Revisa: podman logs ${que%% *}"
}
esperar "db" 60 podman exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
esperar "datamock" 30 podman exec datamock node -e \
  "fetch('http://127.0.0.1:4000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ok "db y datamock listos"

info "Arrancando backend (FastAPI)"
podman run -d --name backend --network "$RED" --restart unless-stopped \
  -e MOCK_API_URL -e ROLES_CLIENT_ID -e ROLES_CLIENT_SECRET -e IA_API_KEY \
  -e ADMIN_USERNAMES -e SESSION_SECRET -e SESION_SOLO_HTTPS -e DATABASE_URL \
  portal-roles-backend >/dev/null
esperar "backend" 60 podman exec backend python -c \
  "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"

info "Arrancando frontend (nginx) en http://localhost:$PUERTO"
podman run -d --name frontend --network "$RED" --restart unless-stopped \
  -p "$PUERTO":8080 portal-roles-frontend >/dev/null
esperar "frontend" 30 podman exec frontend wget -q -O /dev/null http://127.0.0.1:8080/api/health

echo
ok "Portal de Roles listo → http://localhost:$PUERTO"
echo "   Personas de prueba: ver README.md (contraseña Prueba2026*)"
echo "   Detener: ./levantar.sh --bajar"
