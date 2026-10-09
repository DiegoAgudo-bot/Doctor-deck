# Despliegue en el VPS

La app corre en el VPS (`37.27.32.222`, carpeta `/doctor-deck`) como contenedor Docker
(`docker-compose.yml`), detrás del **Traefik** que ya existe allí (proyecto pulsestack: red
`pulsestack_proxy`, certificados de Let's Encrypt con el resolver `le`).

- URL: **https://deckdoctor.37.27.32.222.nip.io**. Cada persona se crea su cuenta (`/registro`,
  email + contraseña o Google) y solo ve su colección y sus mazos.
- Datos (SQLite + bulk de Scryfall) en `/doctor-deck/data`, montado en el contenedor; los
  despliegues no lo tocan.

Cada **push a `main`** lanza el workflow `.github/workflows/ci.yml`:

1. `checks`: typecheck, lint, formato, tests y build en GitHub Actions.
2. `deploy` (solo si `checks` pasa): entra por SSH al VPS y ejecuta `scripts/deploy.sh`, que hace
   `git pull --ff-only` y `docker compose up -d --build` (el contenedor aplica las migraciones de
   Prisma al arrancar).

Si los secretos del VPS no están configurados, el despliegue se omite con un aviso (los checks
siguen ejecutándose).

## Configuración en el VPS (ya hecha)

```bash
git clone https://github.com/DiegoAgudo-bot/Doctor-deck.git /doctor-deck
cd /doctor-deck
cp .env.example .env    # HTTP_USER_AGENT + las variables de despliegue de abajo
docker compose up -d --build
docker compose exec deck-doctor npm run scryfall:sync   # catálogo de Scryfall (tarda unos minutos)
```

Variables de despliegue en `.env` (además de las de `.env.example`):

```bash
DECK_DOCTOR_HOST=deckdoctor.37.27.32.222.nip.io
BETTER_AUTH_SECRET="…"   # lo genera scripts/deploy.sh si falta; no lo cambies (cerraría todas las sesiones)
```

`BETTER_AUTH_URL` no hace falta: `docker-compose.yml` lo pone a `https://$DECK_DOCTOR_HOST`.

Tras cambiar `.env`: `docker compose up -d` (recrea el contenedor).

Catálogo de Scryfall actualizado cada noche (crontab de root):

```cron
30 4 * * * cd /doctor-deck && docker compose exec -T deck-doctor npm run scryfall:sync >> data/scryfall-sync.log 2>&1
```

Los demás scripts CLI se ejecutan igual, p. ej.
`docker compose exec deck-doctor npm run deck:suggest -- "https://…"`. Logs: `docker logs -f deck_doctor`.

## Usuarios

- **Login con Google (opcional).** En
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un "ID de cliente
  de OAuth" de tipo _Aplicación web_ con la URI de redirección autorizada
  `https://deckdoctor.37.27.32.222.nip.io/api/auth/callback/google` y añade al `.env`
  `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Sin ellas el botón de Google no aparece.
  (Google puede no aceptar dominios `nip.io`; con un dominio propio no hay problema.)
- **"He olvidado la contraseña" (opcional).** Necesita enviar emails: `SMTP_URL`
  (p. ej. `smtps://usuario:clave@smtp.tuproveedor.com:465`) y `MAIL_FROM`. Sin ellas no aparece.
- **Datos de antes de los usuarios** (colección y mazos importados cuando había una contraseña
  única): regístrate en la web y después
  `docker compose exec deck-doctor npm run users:claim -- --user "tu@email.com"`.

Tras cambiar `.env`: `docker compose up -d`.

## Clave SSH para GitHub Actions

Se usa una clave dedicada (`deck-doctor-deploy`), cuya pública está en
`/root/.ssh/authorized_keys` del VPS. Para rotarla:

```bash
ssh-keygen -t ed25519 -C "deck-doctor-deploy" -f deck-doctor-deploy -N ""
```

Añade `deck-doctor-deploy.pub` a `authorized_keys` del VPS (y quita la antigua) y pega la privada en
el secreto `VPS_SSH_KEY`. No la subas al repo.

## Secretos del repositorio

GitHub → Settings → Secrets and variables → Actions → _New repository secret_:

| Secreto                | Valor                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| `VPS_HOST`             | `37.27.32.222`                                                          |
| `VPS_SSH_KEY`          | Clave privada `deck-doctor-deploy` (completa, con las líneas BEGIN/END) |
| `VPS_HOST_FINGERPRINT` | (recomendado) huella SHA256 de la clave de host del VPS                 |
| `VPS_USER`             | (opcional) usuario SSH; por defecto `root`                              |
| `VPS_APP_DIR`          | (opcional) carpeta de la app; por defecto `/doctor-deck`                |
| `VPS_PORT`             | (opcional) puerto SSH si no es 22                                       |

Huella del host (en el VPS): `ssh-keygen -lf /etc/ssh/ssh_host_ecdsa_key.pub`. Tiene que ser la
**ECDSA**: es la que negocia `appleboy/ssh-action`; con la ED25519 falla con _host key fingerprint
mismatch_.

## Desplegar a mano

```bash
ssh root@37.27.32.222 'cd /doctor-deck && bash scripts/deploy.sh'
```
