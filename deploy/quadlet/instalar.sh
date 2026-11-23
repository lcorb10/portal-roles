#!/usr/bin/env bash
# Instala el Portal de Roles como servicios de systemd del usuario (Podman Quadlet, Linux).
#   ./deploy/quadlet/instalar.sh            construye las imágenes, instala y arranca
#   ./deploy/quadlet/instalar.sh --quitar   detiene y desinstala (conserva el volumen de datos)
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
UNIDADES="${XDG_CONFIG_HOME:-$HOME/.config}/containers/systemd"
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/portal-roles"
SERVICIOS=(frontend backend datamock db)

if [ "${1:-}" = "--quitar" ]; then
  systemctl --user stop "${SERVICIOS[@]/%/.service}" 2>/dev/null || true
  rm -f "$UNIDADES"/{portal.network,portal-db.volume,db.container,datamock.container,backend.container,frontend.container}
  systemctl --user daemon-reload
  echo "Servicios quitados (el volumen portal-db-datos se conserva)."
  exit 0
fi

command -v podman >/dev/null || { echo "Falta podman"; exit 1; }
[ -f "$RAIZ/.env" ] || { echo "Falta $RAIZ/.env (ejecuta ./levantar.sh una vez o copia .env.example)"; exit 1; }

echo "▸ Construyendo imágenes"
podman build -q -t portal-roles-backend "$RAIZ/backend" >/dev/null
podman build -q -t portal-roles-frontend "$RAIZ/frontend" >/dev/null

echo "▸ Copiando configuración a $CONFIG y unidades a $UNIDADES"
mkdir -p "$UNIDADES" "$CONFIG"
install -m 600 <(tr -d '\r' < "$RAIZ/.env") "$CONFIG/.env"
install -m 644 "$RAIZ/dataMock.js" "$CONFIG/dataMock.js"
install -m 644 "$RAIZ"/deploy/quadlet/*.{network,volume,container} "$UNIDADES/"

# Si levantar.sh dejó contenedores con los mismos nombres, se quitan para que systemd los gestione.
for c in "${SERVICIOS[@]}"; do podman rm -f "$c" >/dev/null 2>&1 || true; done

echo "▸ Arrancando servicios"
systemctl --user daemon-reload
systemctl --user start frontend.service   # arrastra backend, datamock y db por las dependencias
systemctl --user --no-pager --lines=0 status db datamock backend frontend | grep -E "●|Active:"
echo "✔ Portal en http://localhost:8080 · Para que arranque sin sesión abierta: loginctl enable-linger \$USER"
