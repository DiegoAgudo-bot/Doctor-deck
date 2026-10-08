#!/usr/bin/env bash
# Despliegue en el VPS: lo ejecuta GitHub Actions por SSH en cada push a main
# (también se puede lanzar a mano desde la carpeta de la app).
set -euo pipefail

cd "$(dirname "$0")/.."
APP_NAME="${APP_NAME:-deck-doctor}"
BRANCH="${DEPLOY_BRANCH:-main}"

echo "→ Actualizando código ($BRANCH)"
git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "→ Dependencias"
npm ci

echo "→ Migraciones de la base de datos"
npx prisma migrate deploy

echo "→ Build"
npm run build

echo "→ Reinicio"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$APP_NAME" --update-env
  else
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
elif systemctl list-unit-files "$APP_NAME.service" >/dev/null 2>&1; then
  sudo systemctl restart "$APP_NAME"
else
  echo "No encuentro pm2 ni el servicio systemd '$APP_NAME'. Arranca la app a mano (ver DEPLOY.md)." >&2
  exit 1
fi

echo "✓ Desplegado $(git rev-parse --short HEAD)"
