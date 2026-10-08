# Despliegue en el VPS

Cada **push a `main`** lanza el workflow `.github/workflows/ci.yml`:

1. `checks`: typecheck, lint, formato, tests y build en GitHub Actions.
2. `deploy` (solo si `checks` pasa): entra por SSH al VPS y ejecuta `scripts/deploy.sh`, que hace
   `git pull --ff-only`, `npm ci`, `prisma migrate deploy`, `npm run build` y reinicia la app con
   **pm2** (o con un servicio systemd llamado `deck-doctor` si no hay pm2).

Si los secretos del VPS no están configurados, el despliegue se omite con un aviso (los checks
siguen ejecutándose).

## 1. Preparar el VPS (una sola vez)

Requisitos: Node 22+, git, pm2 (`npm i -g pm2`) y un proxy inverso (nginx/Caddy) si quieres dominio.

```bash
# Como el usuario que ejecutará la app
git clone https://github.com/DiegoAgudo-bot/Doctor-deck.git ~/apps/deck-doctor
cd ~/apps/deck-doctor
cp .env.example .env          # edita HTTP_USER_AGENT (tu email o URL) y, si quieres, DATABASE_URL
npm ci
npx prisma migrate deploy
npm run scryfall:sync         # descarga el catálogo de Scryfall (varios cientos de MB, tarda)
npm run build
pm2 start ecosystem.config.cjs && pm2 save
pm2 startup                   # sigue las instrucciones para arrancar pm2 al reiniciar el VPS
```

La app escucha en el puerto **3010** (cámbialo en `ecosystem.config.cjs` o con `PORT`). La base de
datos SQLite y los datos de Scryfall viven en `data/`, que git ignora: los despliegues no la tocan.

Catálogo de Scryfall actualizado cada noche (y precios de referencia de Cardmarket):

```cron
30 4 * * * cd ~/apps/deck-doctor && npm run scryfall:sync >> data/scryfall-sync.log 2>&1
```

Ejemplo de nginx (con certificado de Let's Encrypt aparte):

```nginx
server {
  server_name deckdoctor.example.com;
  client_max_body_size 25m;   # para subir el CSV de ManaBox
  location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> ⚠️ La app no tiene login. Si la expones a internet, cualquiera podría ver o reemplazar tu
> colección. Protégela (p. ej. `auth_basic` en nginx, Cloudflare Access o solo por VPN/Tailscale).

## 2. Clave SSH para GitHub Actions

En tu máquina (no en el VPS):

```bash
ssh-keygen -t ed25519 -C "deck-doctor-deploy" -f deck-doctor-deploy -N ""
```

- Añade `deck-doctor-deploy.pub` a `~/.ssh/authorized_keys` del usuario del VPS.
- La privada (`deck-doctor-deploy`) va al secreto `VPS_SSH_KEY` (abajo). No la subas al repo.

## 3. Secretos del repositorio

GitHub → Settings → Secrets and variables → Actions → _New repository secret_:

| Secreto                | Valor                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| `VPS_HOST`             | IP o dominio del VPS                                                 |
| `VPS_USER`             | Usuario SSH que ejecuta la app                                       |
| `VPS_SSH_KEY`          | Clave privada generada en el paso 2                                  |
| `VPS_APP_DIR`          | Carpeta de la app en el VPS, p. ej. `/home/usuario/apps/deck-doctor` |
| `VPS_PORT`             | (opcional) puerto SSH si no es 22                                    |
| `VPS_HOST_FINGERPRINT` | (opcional, recomendado) huella SHA256 de la clave de host del VPS    |

Huella del host (ejecútalo en el VPS): `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.

## Desplegar a mano

```bash
cd ~/apps/deck-doctor && bash scripts/deploy.sh
```
