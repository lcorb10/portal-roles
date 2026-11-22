# Unidades Quadlet (extra)

Alternativa a `levantar.sh` para un **servidor Linux con systemd**: Podman genera un servicio de systemd por
cada contenedor, que arranca con el sistema, se reinicia si falla y respeta el orden
`db` + `datamock` → `backend` → `frontend` (cada uno espera a que el anterior esté *healthy*).

| Archivo | Qué crea |
|---|---|
| `portal.network` | La red `portal-red` |
| `portal-db.volume` | El volumen `portal-db-datos` |
| `db.container`, `datamock.container`, `backend.container`, `frontend.container` | Los 4 servicios; solo `frontend` publica el 8080 |

## Uso (sin root)

```bash
./levantar.sh --bajar            # si estaba corriendo con el script
./deploy/quadlet/instalar.sh     # construye, instala en ~/.config/containers/systemd y arranca
systemctl --user status backend  # estado; journalctl --user -u backend para los registros
loginctl enable-linger $USER     # opcional: que arranque al encender el servidor sin iniciar sesión
./deploy/quadlet/instalar.sh --quitar
```

El `.env` y `dataMock.js` se copian a `~/.config/portal-roles/`. Requiere Podman 5 (por `Notify=healthy`).
Probado en la máquina de Podman (Fedora, rootless) con Podman 5.8.
