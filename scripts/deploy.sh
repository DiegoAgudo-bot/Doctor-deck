#!/usr/bin/env bash
# Despliegue en el VPS: lo ejecuta GitHub Actions por SSH en cada push a main
# (también se puede lanzar a mano desde la carpeta de la app).
set -euo pipefail

# Todo dentro de { …; exit; }: bash lo lee entero antes de ejecutarlo, así el `git pull` puede
# reescribir este mismo fichero sin que se ejecute a medias.
{

cd "$(dirname "$0")/.."
BRANCH="${DEPLOY_BRANCH:-main}"

echo "→ Actualizando código ($BRANCH)"
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# Secreto de las sesiones de usuario: se genera una sola vez en el propio VPS y no sale de allí.
if ! grep -qE '^BETTER_AUTH_SECRET=.{32,}' .env 2>/dev/null; then
  echo "→ Generando BETTER_AUTH_SECRET en .env"
  sed -i '/^BETTER_AUTH_SECRET=/d' .env 2>/dev/null || true
  printf '\nBETTER_AUTH_SECRET="%s"\n' "$(openssl rand -base64 32)" >> .env
fi

echo "→ Build y reinicio del contenedor (aplica migraciones al arrancar)"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

echo "✓ Desplegado $(git rev-parse --short HEAD)"
exit
}
