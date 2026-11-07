# Salida a producción: lo que te toca a ti

Plan por fases para lanzar Doctor Deck (web + Google Play), **gratis y sin anuncios** por ahora.
Lo que se podía hacer desde el código ya está hecho (fase 0); lo demás necesita tus cuentas, tus
datos o tus decisiones. Cada paso dice dónde se hace y cómo comprobar que ha ido bien.

Orden recomendado: **1 → 2 y 3 a la vez → 4**. Arranca la fase 2 cuanto antes: la prueba cerrada
de Google Play dura como mínimo 14 días.

## Fase 0 · Hecho en el código ✅

- **Copias de seguridad fuera del VPS**: cada noche, cifradas y subidas a un almacenamiento S3
  (B2, R2…), 14 días. Solo falta darle las claves (fase 1). `DEPLOY.md` › Copias de seguridad.
- **Aviso si la web se cae**: workflow «¿Funciona la web?» cada 15 min; abre una issue (te llega
  por email) y la cierra al volver.
- **Email con cada error nuevo** a `ADMIN_EMAILS` (como mucho 5 por hora).
- **Enlaces que abren la app** (`/.well-known/assetlinks.json` + `autoVerify`): solo falta la
  huella del certificado de Play (fase 2).
- **Página pública para borrar la cuenta** (`/delete-account`), que Google Play exige.
- **Política de privacidad al día**: escáner (la imagen no sale del móvil), datos sociales,
  registro de errores, copias cifradas y enlace al borrado. Errata «Deck Doctor» del aviso legal.
- **Material de la ficha de Play** (`mobile/store/`): textos, icono de 512, gráfico destacado y
  las respuestas de los formularios (seguridad de los datos, clasificación, público…).
- **Subida automática a Play** desde GitHub (opcional, fase 2).

## Fase 1 · Cimientos (una tarde, antes de nada)

- [ ] **Fusionar la PR** de estos cambios en `main` (se despliega sola).
- [ ] **Copias externas** (~20 min, gratis hasta 10 GB):
  1. Crea una cuenta en [Backblaze B2](https://www.backblaze.com/cloud-storage) eligiendo la
     región **EU Central** (los datos se quedan en la UE).
  2. Crea un bucket **privado** (p. ej. `doctordeck-backups`) y una _Application Key_ solo con
     acceso a ese bucket.
  3. Inventa una contraseña larga para cifrar (solo letras y números) y **guárdala en tu gestor de
     contraseñas**: sin ella las copias no sirven.
  4. GitHub › Settings › Secrets › Actions: `BACKUP_S3_ENDPOINT` (el _Endpoint_ del bucket, p. ej.
     `https://s3.eu-central-003.backblazeb2.com`), `BACKUP_S3_REGION` (`eu-central-003`),
     `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID` (_keyID_), `BACKUP_S3_SECRET_ACCESS_KEY`
     (_applicationKey_) y `BACKUP_PASSPHRASE`.
  5. Actions › **Configurar el VPS** › Run workflow. Al final hace una copia de prueba: en el log
     debe salir «Copia externa cifrada: …» y el fichero en el bucket.
- [ ] **Recibir los avisos de caídas**: en el repositorio, _Watch_ › _Custom_ › marca **Issues**.
      (Opcional, de respaldo: [UptimeRobot](https://uptimerobot.com) gratis contra
      `https://doctordeck.app/api/status`, con aviso al móvil.)
- [ ] **Comprueba** que `ADMIN_EMAILS` es tu email y que está **verificado** en tu cuenta de la web
      (sin eso no entras a `/admin`). Los avisos de errores nuevos llegan a esos emails.
- [ ] **Notificaciones push** (ahora están apagadas en el servidor): sigue
      `mobile/README.md` › Notificaciones push (Firebase): `GOOGLE_SERVICES_JSON_B64` y
      `FCM_SERVICE_ACCOUNT_B64`, y después Configurar el VPS. Comprueba: `https://doctordeck.app/api/app`
      debe decir `"push":true`.
- [ ] **Cuenta de prueba para Google**: regístrate en la web con un email aparte (p. ej.
      `revision@…`), importa una colección pequeña y crea dos mazos. Los revisores de Play la usan
      para entrar.

## Fase 2 · Google Play (empieza ya: 2–4 semanas por la prueba cerrada)

- [ ] **Mira qué tipo de cuenta tienes** (Play Console › Configuración › Cuenta de desarrollador).
      Si es **personal y creada después del 13/11/2023**, Google exige una **prueba cerrada con al
      menos 12 testers durante 14 días seguidos** antes de dejarte publicar. Ve juntando ya a 15–20
      personas (tu grupo de juego, amigos, un Discord) con cuenta de Google y Android.
- [ ] **Clave de subida** (una sola vez; si la pierdes, Google tiene que restablecerla):
      `mobile/README.md` › Compilar e instalar. Guarda el `.jks` y sus contraseñas en tu gestor y mete
      los secretos `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y
      `ANDROID_KEY_PASSWORD`.
- [ ] Actions › **App móvil** › Run workflow (en `main`) y descarga el artefacto: el `.aab` es lo que
      se sube a Play.
- [ ] **Crear la app** en Play Console: nombre «Doctor Deck: mazos Commander», idioma español
      (España), _App_, **Gratis**. Ojo: una app publicada como gratis **no puede pasar a ser de
      pago**; sí podrías añadir más adelante compras dentro de la app o suscripciones.
- [ ] **Contenido de la app** (Política › Contenido de la app): rellénalo con las respuestas de
      `mobile/store/README.md` (privacidad, anuncios: no, acceso con la cuenta de prueba, público
      16+, borrado de cuenta, clasificación y seguridad de los datos).
- [ ] **Ficha de Play Store**: textos, `mobile/store/icon-512.png`,
      `mobile/store/feature-graphic.png` y **4–8 capturas del móvil** en vertical (colección en
      rejilla, un mazo con cambios sugeridos, el escáner, el contador de vidas, intercambios).
- [ ] **Prueba interna** (sin revisión, instantánea): sube el `.aab`, añádete como tester e instala
      desde el enlace de Play. Revisa que entra, que escanea y que abre bien los enlaces.
- [ ] **Firma de apps de Play**: al subir la primera versión, Play Console › Integridad de la app ›
      Firma de apps. Copia la huella **SHA-256** del certificado de firma de apps (y la del de
      subida) al secreto `ANDROID_CERT_SHA256` (separadas por comas) y lanza Configurar el VPS.
      Comprueba `https://doctordeck.app/.well-known/assetlinks.json`.
- [ ] **Prueba cerrada**: crea la pista, sube la misma versión, añade la lista de testers (emails o
      un Grupo de Google) y pásales el enlace para unirse. Que la tengan instalada y la abran de vez
      en cuando los 14 días; Google pregunta luego qué te han dicho.
- [ ] **Solicitar acceso a producción** (Panel de Play Console) tras los 14 días, contestar el
      cuestionario y publicar en **producción** con lanzamiento escalonado (p. ej. 20 % → 100 %).
- [ ] (Opcional) **Subida automática**: `mobile/store/README.md` › Subida automática. Después de
      publicar, pon la variable del repo `PLAY_RELEASE_STATUS` = `completed`.
- [ ] Cuando la app de la tienda esté en uso, sube `MOBILE_MIN_VERSION` si quieres obligar a
      actualizar a quien tenga el APK antiguo instalado a mano.

## Fase 3 · Que te encuentren los buscadores (en paralelo con la fase 2)

La web ya tiene sitemap (30 000 páginas), `robots.txt`, canónicas, datos estructurados e imágenes
para compartir. Falta decírselo a los buscadores:

- [ ] **Google Search Console** (search.google.com/search-console): propiedad de tipo **Dominio**
      `doctordeck.app`, verificada con el registro **TXT** que te da Google en el DNS de tu
      registrador (cubre también `www.`).
- [ ] Sitemaps › enviar `https://doctordeck.app/sitemap.xml`.
- [ ] Inspección de URLs › pide la indexación de la portada, `/cards`, `/community` y un par de
      mazos públicos buenos.
- [ ] **Bing Webmaster Tools** (bing.com/webmasters): «Importar desde Google Search Console». Bing
      alimenta también DuckDuckGo, Yahoo y los buscadores de varios asistentes de IA.
- [ ] [Prueba de resultados enriquecidos](https://search.google.com/test/rich-results) con la
      portada (preguntas frecuentes) y una carta.
- [ ] A las 2–4 semanas: Search Console › Páginas. Si muchas cartas salen «Rastreada: actualmente
      sin indexar», es normal al principio; lo que más ayuda son los enlaces desde fuera (fase 4).

## Fase 4 · Darse a conocer (cuando la app esté en producción)

- [ ] **Mazos públicos de ejemplo**: 5–10 mazos buenos y bien nombrados en tu perfil (la portada
      enseña los últimos de la comunidad y cada mazo es una página que Google indexa).
- [ ] **Comunidades en español** (con capturas y preguntando qué mejorarían, no solo «mirad mi
      app»; lee antes las normas de autopromoción): subreddits de Magic y de Commander, servidores de
      Discord, grupos de Telegram y WhatsApp de Commander de tu zona.
- [ ] **Tiendas y ligas locales**: un cartel con QR a la web y a Play. Los grupos de juego, el
      contador y los préstamos son justo para eso.
- [ ] **Creadores de contenido** en español (YouTube, Twitch, TikTok) de Commander: ofrece la
      herramienta para analizar mazos de su audiencia en directo.
- [ ] Una cuenta en Bluesky / X / Instagram con capturas y novedades.
- [ ] Pide a los testers que dejen **reseña en Play** cuando ya esté publicada.
- [ ] **Mide**: Search Console (búsquedas), Play Console (instalaciones, fallos ANR) y
      `/admin/errors`.

## Decisiones pendientes (sin prisa, pero antes de crecer)

- **Fuentes de datos**: las recomendaciones salen de EDHREC (sin API oficial) y los combos de
  Commander Spellbook. Aunque sea gratis, conviene **escribirles** antes de darle publicidad,
  contarles el proyecto y preguntar si quieren una mención o condiciones de uso. Hoy no se les
  nombra en la web (regla de la casa); si piden atribución, se añade.
- **Edad mínima**: en España hay que tener 14 años para dar el consentimiento propio (LOPDGDD).
  En Play se ha propuesto público de 16+. Decide la edad y la añado al aviso legal y al registro.
- **Marca**: antes de invertir en difusión, busca «Doctor Deck» en
  [EUIPO](https://euipo.europa.eu/eSearch/) y [OEPM](https://www.oepm.es) por si choca con algo
  registrado en juegos o software.
- **Versión en inglés**: la mayoría de jugadores de Commander buscan en inglés. Es el cambio que
  más alcance daría (web con `/en` + ficha de Play en inglés). Dímelo cuando quieras empezarla.
- **Analítica de visitas**: ahora no hay ninguna (ni cookies). Search Console y Play Console dan
  lo básico. Si quieres más, lo propio sería una analítica sin cookies alojada en el VPS (y
  actualizar la privacidad).
- **Dinero, más adelante**: la Política de contenido de fans de Wizards no deja cobrar por
  acceder al contenido de Magic. Encajan las donaciones con ventajas no esenciales y los enlaces
  de afiliado de tiendas; nunca poner de pago lo que hoy es gratis.
- **iOS**: necesita la cuenta de Apple Developer (99 $/año).
