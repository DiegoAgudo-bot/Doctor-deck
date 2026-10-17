# Imagen de producción. Se construye en el VPS con `docker compose up -d --build` (scripts/deploy.sh).
# Se mantienen las devDependencies: `prisma migrate deploy` y los scripts CLI (tsx) se ejecutan dentro
# del contenedor, p. ej. `docker compose exec deck-doctor npm run scryfall:sync`.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias (postinstall = prisma generate, necesita el schema y la config)
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# URL pública para los metadatos de las páginas que se generan en el build (canónicas, vistas
# previas). docker-compose.yml la pasa desde DECK_DOCTOR_HOST; sin ella, https://doctordeck.app.
ARG BETTER_AUTH_URL
RUN npm run build

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3010
EXPOSE 3010

# data/ (SQLite + bulk de Scryfall) es un volumen: las migraciones se aplican al arrancar.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node_modules/.bin/next start"]
