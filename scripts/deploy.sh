#!/usr/bin/env bash
# Despliegue en el VPS: lo ejecuta GitHub Actions por SSH en cada push a main
# (también se puede lanzar a mano desde la carpeta de la app).
set -euo pipefail

cd "$(dirname "$0")/.."
BRANCH="${DEPLOY_BRANCH:-main}"

echo "→ Actualizando código ($BRANCH)"
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "→ Build y reinicio del contenedor (aplica migraciones al arrancar)"
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null

echo "✓ Desplegado $(git rev-parse --short HEAD)"
