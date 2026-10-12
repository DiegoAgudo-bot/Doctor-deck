# Despliegue en el VPS

La app corre en el VPS (`37.27.32.222`, carpeta `/doctor-deck`) como contenedor Docker
(`docker-compose.yml`), detrás del **Traefik** que ya existe allí (proyecto pulsestack: red
`pulsestack_proxy`, certificados de Let's Encrypt con el resolver `le`).

- URL: **https://doctordeck.app** (antes `deckdoctor.37.27.32.222.nip.io`, que redirige aquí). Cada persona se crea su cuenta (`/signup`,
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
DECK_DOCTOR_HOST=doctordeck.app
BETTER_AUTH_SECRET="…"   # lo genera scripts/deploy.sh si falta; no lo cambies (cerraría todas las sesiones)
# Opcional: dominio anterior que redirige al nuevo (por defecto, la dirección nip.io de antes).
# DECK_DOCTOR_OLD_HOST=deckdoctor.37.27.32.222.nip.io
```

DNS del dominio (en el registrador): registros `A` de `@` y de `www` a la IP del VPS
(`37.27.32.222`). Traefik pide los certificados de los dos solo; `www.` y el dominio antiguo
redirigen (301, con la misma ruta) al de `DECK_DOCTOR_HOST`.

`BETTER_AUTH_URL` no hace falta: `docker-compose.yml` lo pone a `https://$DECK_DOCTOR_HOST`.

Páginas legales (`/privacy` y `/legal`): sin estas dos variables salen como "pendiente".

```bash
LEGAL_OWNER="Nombre y apellidos (NIF si aplica)"
LEGAL_EMAIL="privacidad@tu-dominio"
```

Moderación de comentarios (`/admin/reports`): los emails de quien revisa las denuncias.

```bash
ADMIN_EMAILS="tu-email@ejemplo.com"
```

Tras cambiar `.env`: `docker compose up -d` (recrea el contenedor).

Sin entrar por SSH: GitHub › Actions › **Configurar el VPS** › Run workflow cambia
`DECK_DOCTOR_HOST` (entrada; antes comprueba que el DNS ya apunta al VPS y deja el dominio anterior
en `DECK_DOCTOR_OLD_HOST` para que redirija) y, si existen como secretos del repositorio
(Settings › Secrets and variables › Actions), `ADMIN_EMAILS`, `LEGAL_OWNER` y `LEGAL_EMAIL`. Guarda
una copia `.env.bak-…`, reinicia y comprueba que la web responde. El repositorio es público: los
datos personales van como secretos, nunca en el código ni como entrada del workflow.

Tareas diarias en el crontab de root (`scripts/deploy.sh` las añade solas si faltan):

```cron
15 3 * * * cd /doctor-deck && docker compose exec -T deck-doctor npm run db:backup >> data/db-backup.log 2>&1
30 4 * * * cd /doctor-deck && docker compose exec -T deck-doctor npm run scryfall:sync >> data/scryfall-sync.log 2>&1
```

## Copias de seguridad

`npm run db:backup` copia la SQLite en caliente (API `backup` de SQLite, sin parar la web),
comprueba la copia (`integrity_check`), la comprime y la deja en `data/backups/` como
`deck-doctor-AAAA-MM-DDTHHMM.db.gz`; guarda las últimas `BACKUP_KEEP` (14 por defecto).

**Están en el mismo disco que la base de datos**: protegen de errores y borrados, no de perder
el VPS. Para tenerlas fuera, copia `data/backups/` a otro sitio (p. ej. con `rclone` a un
almacenamiento externo) en otra línea del cron.

Restaurar una copia:

```bash
cd /doctor-deck
docker compose stop deck-doctor
cp data/deck-doctor.db data/deck-doctor.db.antes-de-restaurar
gunzip -c data/backups/deck-doctor-AAAA-MM-DDTHHMM.db.gz > data/deck-doctor.db
rm -f data/deck-doctor.db-wal data/deck-doctor.db-shm
docker compose start deck-doctor
```

Los demás scripts CLI se ejecutan igual, p. ej.
`docker compose exec deck-doctor npm run deck:suggest -- "https://…"`. Logs: `docker logs -f deck_doctor`.

## Usuarios

- **Login con Google (opcional).** En
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un "ID de cliente
  de OAuth" de tipo _Aplicación web_ con la URI de redirección autorizada
  `https://doctordeck.app/api/auth/callback/google` y añade al `.env`
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
