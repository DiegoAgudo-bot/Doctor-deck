# Deck Doctor

App web que sugiere mejoras 1×1 ("quita X → mete Y") para mazos de Commander usando
recomendaciones de EDHREC, priorizando cartas de la colección del usuario (export de ManaBox).

@AGENTS.md

## Comandos

| Comando                                                                                           | Qué hace                                                                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm install`                                                                                     | Instala dependencias y genera el cliente Prisma (`postinstall`)           |
| `cp .env.example .env`                                                                            | Configuración local (nunca se sube `.env`)                                |
| `npm run db:migrate`                                                                              | Aplica/crea migraciones de Prisma sobre SQLite (`data/deck-doctor.db`)    |
| `npm run dev`                                                                                     | Servidor de desarrollo                                                    |
| `npm test` / `npm run test:watch` / `npm run test:coverage`                                       | Vitest                                                                    |
| `npm run typecheck`                                                                               | `next typegen` + `tsc --noEmit`                                           |
| `npm run lint`                                                                                    | ESLint (incluye la regla de capas)                                        |
| `npm run format` / `format:check`                                                                 | Prettier                                                                  |
| `npm run build`                                                                                   | Build de producción                                                       |
| `npm run scryfall:sync [-- --force \| --skip-download]`                                           | Descarga los bulk de Scryfall (si hay versión nueva) y los vuelca a la BD |
| `npm run symbols:sync`                                                                            | Descarga los símbolos de maná de Scryfall a `public/symbols/`             |
| `npm run collection:import -- "export.csv" [--user email]`                                        | Importa un CSV de ManaBox (a la cuenta indicada) y muestra el resumen     |
| `npm run users:claim -- --user email`                                                             | Pasa a esa cuenta la colección y los mazos de antes de haber usuarios     |
| `npm run deck:check -- "lista.txt" \| "https://…"`                                                | Parsea y resuelve una lista de mazo contra el catálogo                    |
| `npm run edhrec:fetch -- "Comandante" [--theme x] [--partner "B"] [--save f.json]`                | Pide recomendaciones a EDHREC (con caché) y muestra un resumen            |
| `npm run deck:suggest -- "lista.txt" [--theme x] [--lock "Carta"] [--commander "C"]`              | Analiza un mazo y muestra los cambios sugeridos                           |
| `… deck:suggest -- … [--deck-id uuid] [--ignore-other-decks] [--buy N --max-price 1 --budget 10]` | Igual, con mazo guardado / sin descontar otros mazos / modo compra        |

Antes de cada commit: `npm run typecheck && npm run lint && npm run format:check && npm test`.

**CI/CD**: `.github/workflows/ci.yml` ejecuta esos checks + build en cada push/PR; en push a `main`
despliega en el VPS (`root@37.27.32.222:/doctor-deck`) por SSH (`scripts/deploy.sh`: pull +
`docker compose up -d --build`; el contenedor aplica `prisma migrate deploy` al arrancar). La app va
detrás del Traefik de pulsestack en `https://deckdoctor.37.27.32.222.nip.io`.
Configuración del VPS y secretos en `DEPLOY.md`.

## Stack

Next.js 16 (App Router) · TypeScript estricto (`strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`) · Prisma 7 + SQLite (driver adapter `better-sqlite3`, cliente
generado en `src/generated/prisma`, config en `prisma.config.ts`) · Tailwind 4 · Vitest · zod.
Gestor de paquetes: npm. Node ≥ 22.

> Next 16 y Prisma 7 tienen cambios importantes respecto a versiones anteriores: consulta
> `node_modules/next/dist/docs/` y la doc de Prisma 7 antes de usar APIs que no conozcas.

## Arquitectura (capas; las dependencias solo apuntan hacia dentro)

```
src/
  domain/        TS puro: tipos, parsers, normalizador, clasificador de roles, motor de sugerencias.
                 Sin fetch, fs, Prisma, Next ni React (lo impone ESLint).
    cards/ deck/ collection/ roles/ suggestions/
    ports/       Interfaces que implementan los adaptadores: CardRepository, CollectionRepository,
                 RecommendationSource, DeckSource, RoleClassifier, Cache.
  application/   Casos de uso (importCollection, analyzeDeck…). Unen puertos + dominio. Sin UI.
  adapters/      I/O. scryfall/ (bulk + mapeo) edhrec/ deck-sources/ http/ (UA + rate limit) db/ (Prisma)
  config/        Carga de .env con zod (env.ts) y parámetros por defecto (pesos, mínimos por rol).
  app/           Next App Router: páginas y Route Handlers /api/* (la UI y la futura app móvil
                 consumen la misma API JSON; no se usan Server Actions para la lógica).
  components/    Componentes React.
  server/        Raíz de composición (container.ts): env + adaptadores concretos. Solo servidor/scripts.
  generated/     Cliente Prisma (gitignored).
scripts/         Tareas CLI (p. ej. sincronizar bulk de Scryfall).
tests/           setup.ts (bloquea la red), helpers/ (makeCard, fixtures de Scryfall, BD temporal)
                 y fixtures/ (ver fixtures/README.md).
data/            (gitignored) SQLite, bulk de Scryfall.
```

Tests unitarios junto al código (`*.test.ts`). **Los tests nunca llaman a la red**:
`tests/setup.ts` sustituye `fetch` por uno que lanza error; inyecta clientes falsos o usa fixtures.
Los tests de repositorios y casos de uso usan una SQLite temporal con las migraciones aplicadas
(`tests/helpers/test-db.ts`).

### Flujo de datos

- **Catálogo**: `ensureBulkFile` (descarga) → `readJsonArray` (streaming) → `safeMappers` (zod →
  `Card`/`Printing`) → `syncScryfallCatalog` → `PrismaCardRepository`. Las búsquedas por nombre usan
  las columnas `nameKey`/`frontFaceKey` (ver `domain/cards/names.ts`).
- **Resolver cosas contra el catálogo**: `application/card-index-loader.ts` carga del repositorio solo
  las cartas necesarias en un `InMemoryCardIndex` (dominio, síncrono); el dominio trabaja contra la
  interfaz `CardIndex`. El índice prefiere cartas jugables frente a tokens/art series homónimos.
- **Colección**: `parseManaboxCsv` → `matchCollection` (id → set+nº → nombre) → `replaceCollection`.
  Además, cartas sueltas (`addToCollection`, `application/collection-cards.ts`): se resuelven por
  `oracleId` (buscador web), `scryfallId` (lo que dará el escáner de la app móvil) o nombre, y se
  guardan con `matchMethod = "manual"`; reimportar el CSV **no** las borra. `collectionView` agrupa
  la colección por carta con catálogo, precio, roles y mazos que la usan; `browseMyCollection` filtra,
  ordena y pagina en el servidor (`domain/collection/browse.ts`; la web pide 48 por página).
  `summary.totalCards` = copias identificadas (sin las filas sin emparejar). Sin cuenta, todo vive
  en el navegador (`local-collection.ts`: `{import, added}`) y se manda como pares
  `[oracleId, copias]`.
- **Recomendaciones**: `EdhrecClient` (puerto `RecommendationSource`) → caché `ResponseCache`
  (`PrismaResponseCache`, tabla `HttpCache`) → `parseEdhrecPage` (zod, único sitio que conoce el
  JSON de EDHREC) → `CommanderRecommendations` (synergy e inclusión como fracciones 0..1, cartas
  repetidas en varias listas unidas con sus categorías) → `loadRecommendations` las resuelve a
  cartas del catálogo y devuelve aparte los nombres no encontrados.
  Errores: siempre `EdhrecError` con `code` (`not_found`, `blocked` [403/429, sin reintentos],
  `unavailable`, `format`, `invalid_query`). Si EDHREC falla y hay copia caducada, se devuelve con
  `stale: true` y un `warning` para mostrar al usuario. Las respuestas con formato inesperado no se
  cachean. Slugs: nombre sin tildes/apóstrofos, cara frontal, parejas en orden alfabético unidas
  con `-` (pendiente de verificar contra EDHREC real).
- **Sugerencias** (`application/analyze-deck.ts`): `loadDeck` → (`chooseCommanders` si el usuario
  eligió; si no hay comandante → `status: "needs_commander"`) → `loadRecommendations` →
  `ownedQuantities` + `decks.usage(deckId)` → `suggestSwaps` (dominio) + `manaCurve` +
  `validateDeck`; con `buy` además `findMinPrices` → `suggestPurchases`.
  También `deckOwnership` (`domain/deck/ownership.ts`): carta a carta, si la tengo libre, está en
  otros mazos, me falta (con precio de lo que hay que comprar) o es básica; pestaña "Qué me falta"
  (lista de compra para Cardmarket). Al abrir el mazo público de otro se abre en esa pestaña.
- **Mazos guardados** (Fase 6): tablas `Deck` (`publicId` uuid para URL y API)/`DeckCard` (por oracleId; comandantes con
  `isCommander`, bloqueadas con `locked`; `input` original, `source`, `theme`, `excluded`).
  `PrismaDeckRepository.usage(excludeDeckId)` suma las copias usadas en los demás mazos (comandantes
  incluidos). En el motor, copias libres = tengo − usadas en otros mazos; solo entran cartas con
  copias libres y las que están todas ocupadas se devuelven en `unavailableCandidates`. Se puede
  desactivar con `useOtherDecks: false`. `saveDeck` resuelve el mazo y exige comandante.
- **Modo compra** (Fase 7, `suggestPurchases`): candidatas = recomendadas que pueden entrar y que
  no tengo libres, con precio ≤ `maxPrice`. Mismo emparejado voraz (`pairGreedy`) con tope de
  `maxCards` y `budget` total. Precio = `prices.eur` de Scryfall (tendencia de Cardmarket) de la
  impresión más barata (`Printing.priceEur`, se actualiza con `scryfall:sync`). No se consulta
  Cardmarket directamente: la UI solo enlaza a su buscador.
- **Motor** (`domain/suggestions/engine.ts`):
  - Candidatos a entrar: recomendadas ∩ colección, fuera del mazo, legales, no básicas, no
    descartadas por el usuario y **siempre dentro de la identidad de color del comandante** (sin
    comandante no se propone nada). Candidatos a salir: las 99 sin básicas ni bloqueadas. Orden: primero
    las que tienen problema (`offColor` fuera de identidad, `notLegal` prohibida; salen aunque dejen un
    rol bajo mínimo), luego las que no están en EDHREC, luego de peor a mejor score.
  - `score(carta) = a·synergy + b·inclusion` (lo que falta = 0).
    `score(cambio) = score(entra) − score(sale) + c·bonus_rol`, con bonus_rol = 1 si comparten rol
    principal, 0.5 si comparten algún rol, +0.5 si la que entra cubre un rol bajo mínimo.
  - Solo se propone si `score(entra) − score(sale) > minImprovement`. Emparejado voraz: en cada paso
    el mejor par válido; un par es inválido si deja algún rol por debajo de su mínimo.
  - Pesos, mínimos, umbral y nº máximo en `src/config/engine.ts` (defaults en
    `domain/suggestions/config.ts`). Motivos en español en `domain/suggestions/reason.ts`.
- **Roles** (`domain/roles`): `HeuristicRoleClassifier` con regex sobre el oracle text (sin
  reminder text, nombre propio → "this") y el tipo de la cara frontal. Roles: land, ramp, draw,
  removal, wipe, counterspell, tutor, protection, synergy (= lo que no es nada de lo anterior).
  Una carta cuenta en todos sus roles; el principal sale de un orden de prioridad. Limitaciones
  conocidas: overload/escalate no cuentan como wipe; "protection" exige conceder a otros.
- **UI** (`src/app`, `src/components`): páginas `/` (estado), `/coleccion` (subir CSV) y `/mazo`
  (pegar lista → curva, roles, cambios con aceptar/descartar, candados, exportar). Son componentes de
  cliente que solo hablan con la API JSON:
  - `GET /api/status`, `POST /api/collection` (cuerpo = texto del CSV), `POST /api/collection/cards`
    (`{cards: [{oracleId|scryfallId|name, quantity, foil?}]}`, máx. 500), `DELETE
/api/collection/cards/{id}` (solo las añadidas a mano), `POST /api/collection/view`
    (`{collection?, filters, sort, offset, limit}`; `limit: 0` = solo totales), `GET /api/collection/cards`
    (las añadidas a mano), `GET /api/cards/search?q=&limit=`, `POST /api/analyze`
    (`{input, theme?, commanders?, locked?, excluded?, deckId?, useOtherDecks?, buy?: {maxCards,
maxPrice?, budget?}}`, validado con zod), `GET|POST /api/decks`, `GET|DELETE /api/decks/[id]`.
  - Páginas: `/mazos` (lista, borrar) y `/decks/{publicId}` (un mazo guardado; exigen sesión). Los
    mazos se identifican fuera de la BD solo por `Deck.publicId` (uuid): API `/api/decks/{uuid}`,
    `deckId` de `/api/analyze`; el `id` numérico es interno. Rutas en grupos `(app)` (con barras) y
    `(cuenta)` (entrar, registro…, sin barras). Con Cache Components, `usePathname`/`useParams` se
    leen dentro de `<Suspense>` (si no, falla el build en rutas dinámicas).
  - Tipos y mapeadores de la API en `src/server/dto.ts` (los componentes solo hacen `import type`);
    errores → JSON `{error: {code, message}}` en `src/server/http.ts`.
  - Las rutas GET llaman a `await connection()` (better-sqlite3 es síncrono y si no, Next las
    prerenderiza). El container es un singleton (`getContainer`).
  - Estado del mazo (lista, tema, bloqueadas, descartadas) en `localStorage` del navegador.
    "Aplicar cambios y recalcular" reescribe la lista con `applySwaps` + `exportDecklist`
    (`domain/deck/export.ts`) y vuelve a analizar excluyendo las cartas descartadas.
- **Usuarios** (Fase 8, Better Auth, `src/server/auth.ts`): email + contraseña (scrypt, mínimo 8)
  y Google si hay `GOOGLE_CLIENT_ID/SECRET`; "olvidé mi contraseña" solo si hay `SMTP_URL`
  (`adapters/mail`). Sesiones en BD (tablas `user`, `session`, `account`, `verification`) con cookie
  httpOnly; rutas en `/api/auth/[...all]`. Si alguien entra con Google con el mismo email que una
  cuenta existente, se vinculan (`accountLinking`).
  - `CollectionEntry` y `Deck` tienen `userId`. Los repositorios se crean **por usuario**
    (`container.collectionFor(userId)`, `decksFor(userId)`) y filtran todas sus consultas por él; el
    catálogo y la caché de EDHREC son globales. Dominio y casos de uso no saben de usuarios.
  - Cada ruta de la API llama a `requireUser(request)` (`src/server/session.ts`) → 401 si no hay
    sesión; `/api/status` funciona sin sesión. `src/proxy.ts` redirige a `/entrar?next=…` las páginas
    privadas si no hay cookie (comprobación optimista; la real es `requireUser`).
  - UI: `/entrar`, `/registro`, `/recuperar`, `/restablecer`; `UserMenu` en la cabecera. Tras entrar
    se navega con recarga completa (la caché del router puede tener la redirección de antes).
  - Filas con `userId` vacío = datos de antes de los usuarios → `npm run users:claim`.
  - En producción `loadEnv` exige `BETTER_AUTH_SECRET`; `BETTER_AUTH_URL` debe ser la URL pública.
    En el VPS, `scripts/deploy.sh` genera el secreto en `.env` si falta y `docker-compose.yml` pone
    `BETTER_AUTH_URL=https://$DECK_DOCTOR_HOST`. `/login` (el antiguo login de contraseña única)
    redirige a `/entrar`.
- **Social** (Fase 9, `application/social.ts`, puertos en `domain/ports/social.ts`, adaptador
  `PrismaSocialRepository`): `User.username` (perfil `/u/{username}`; `ensureUsername` lo genera
  la primera vez desde el nombre o el email, reglas en `domain/social/username.ts`) y
  `User.collectionPublic` (por defecto privada). `Deck.visibility` (`domain/deck/visibility.ts`):
  `public` (por defecto; perfil, Comunidad y avisos), `unlisted` (oculto: solo con el enlace) o
  `private`. Los públicos y ocultos los ve cualquiera, también sin cuenta (`PrismaPublicDecks.find`); abrir el de otro lo
  analiza con TU colección y "Guardar una copia" crea uno tuyo. Nunca se expone el email.
  `Follow` (seguir) y `Notification` (fan-out al escribir): `announceNewDeck` al crear un mazo
  público y `announceBigCards` al añadir cartas de ≥ `socialConfig.bigCardEur` (20 €) si la
  colección es pública (`src/config/social.ts`). Solo avisos en la web (campana, cada minuto).
  Rutas: `/comunidad`, `/u/[username]`, `/notificaciones`, `/ajustes`; API `GET|PATCH
/api/me/profile`, `GET /api/users?q=`, `GET /api/users/{u}`, `POST|DELETE /api/users/{u}/follow`,
  `GET /api/notifications`, `POST /api/notifications/read`, `POST /api/community/decks`,
  `PATCH /api/decks/{id}` (`{visibility}`), `POST /api/collection/view` con `username`.
- **Crear mazos** (`application/new-deck.ts`, página `/mazos/nuevo`): eliges el comandante
  (buscador con `commander=1`) y `newDeckFromCommander` monta el **mazo medio de EDHREC**
  (`EdhrecClient.getAverageDeck`, `/average-decks/{slug}[/{tema}]`, parser en
  `adapters/edhrec/average-deck.ts`; mismas reglas de caché y errores) o un mazo **vacío** para
  montarlo desde cero. Devuelve la lista en texto, que se guarda con `saveDeck` como cualquier otra.
  Nombre propuesto (`domain/deck/naming.ts`): "<colores> - <de qué va>", p. ej. "Jund -
  Aristócratas" (combinaciones Boros/Jund/… y temas de EDHREC traducidos). API: `GET
/api/commanders?ids=` (temas y nombre) y `POST /api/decks/new` (con sesión guarda y devuelve
  `id`; sin ella devuelve la lista para abrirla en `/mazo?analizar=1`).
  Editor: en la pestaña Lista de un mazo propio o sin guardar, "Añadir cartas" (buscador con
  `identity=` de los colores del comandante y recomendadas de tu colección) y −/+ en la tabla;
  cada cambio (`changeCard` en `domain/deck/export.ts`) reanaliza y, si es un mazo guardado, lo
  guarda. "Mis mazos" es el gestor: nuevo, importar, renombrar (`PATCH /api/decks/{id}` con
  `name`), duplicar (copia privada), público/privado y borrar.
- **Exportar** (`exportDeck` en `domain/deck/export.ts`): `text` (Moxfield/Archidekt/ManaBox),
  `arena` (split con `///`, dos caras solo la frontal) y `mtgo` (comandante en el banquillo, split
  con `/`). Por eso `CardDTO` lleva `layout`.
- **Mano inicial** (`domain/deck/draw-odds.ts`, pestaña Estadísticas): hipergeométrica sobre las
  99 (P de 2–4 tierras, caídas de tierra, ramp, robo; en multijugador se roba en el turno 1) y
  manos de muestra con mulligan (el primero gratis).
- **Bracket** (`domain/deck/bracket.ts`): `estimateBracket` da el bracket MÍNIMO (2, 3 o 4) por
  game changers (`Card.gameChanger`, campo `game_changer` de Scryfall; 1–3 → 3, ≥4 → 4),
  destrucción masiva de tierras (regex sobre el texto: "destroy all lands", "each player
  sacrifices N lands", Blood Moon, Winter Orb…; sacrificar tus tierras como coste no cuenta) y ≥3
  cartas de turno extra (→ 4). Tutores solo informativos; combos pendientes (fase 16). Sale en
  `analyze` (`bracket`), en la cabecera y en Estadísticas. `Deck.targetBracket` (opcional): el
  motor no propone game changers por encima del límite (0 hasta el 2, 3 en el 3, contando los que
  salen) ni destrucción masiva por debajo del 4. `PATCH /api/decks/{id}` acepta `targetBracket`.
- **Comunidad** (Fase 13, `application/community.ts`): `browseCommunity` busca los mazos públicos
  (`PublicDecks.search`, como mucho los 500 últimos que cumplen los filtros: texto en nombre o
  comandantes, identidad exacta `colors`, `bracket`, `following`, `username`), calcula para cada uno
  cuánto tengo (`summarizeOwnership` → `ownershipTotals`, mismos totales que `deckOwnership`; % =
  copias libres / cartas sin básicas) y el coste de lo que falta, ordena (`recent` | `likes` |
  `owned`) y pagina. Filtrar sin cargar cartas: `Deck.colorIdentity` y `Deck.bracket`
  (`deckFacts`), calculados al guardar; si faltan se rellenan al buscar y `scryfall:sync` los
  recalcula todos (`refreshDeckFacts`; con SQL directo para no tocar `updatedAt`). API `POST
/api/community/decks` (`{filters, sort, offset, limit, collection?}`; sin sesión, la colección
  del navegador). "Me gusta": tabla `DeckLike`, `POST|DELETE /api/decks/{id}/like` (no a los
  propios ni a los privados); `GET /api/decks/{id}` devuelve `likes` y `liked`. Los perfiles de
  otros piden lo mismo con `username` para enseñar el % en cada mazo.
- **Precios** (Fase 14): `scryfall:sync` guarda cada día (`recordPriceSnapshot`, fecha UTC) en
  `PriceSnapshot` el precio más barato de las cartas que están en alguna colección o mazo, y después
  lanza `notifyPriceDrops`: a cada usuario con `User.priceAlertPercent` (15 % por defecto, null =
  no), las cartas que le faltan para sus mazos guardados (`decks.usage()` − colección, sin básicas)
  cuyo precio de hoy baja ese % respecto al máximo de los 30 días anteriores → `Notification`
  `price_drop` (`price`, `prevPrice`, `deckId` del primer mazo que la usa); como mucho una por
  carta cada 7 días; si no hay precio de hoy no se compara. Cálculos en `domain/prices/history.ts`
  (`priceChange`, `priceMovers` por valor de mis copias, `collectionValueSeries` arrastrando el
  último precio conocido, `priceDrop`). API: `GET /api/cards/{oracleId}/prices?days=` (pública),
  `POST /api/collection/prices` (`{days, collection?}`: valor día a día y lo que más sube/baja),
  `PATCH /api/me/profile` con `priceAlertPercent`. UI: pulsar un precio (colección, "Qué me falta")
  abre el histórico (`CardPriceDialog`, gráfica `PriceChart`), pestaña "Precios" en la colección y
  el ajuste en `/ajustes`.
- **Sin depender de Scryfall/Cloudflare en el navegador** (en España se bloquean IPs de Cloudflare
  durante los partidos de LaLiga): el navegador solo habla con nuestro servidor. Los símbolos de
  maná están en `public/symbols/` (`npm run symbols:sync`, se suben al repo) y las imágenes de
  cartas se sirven desde `/img/<ruta de Scryfall>`: `cardDTO` reescribe `imageUrl`
  (`localImageUrl`, `domain/cards/images.ts`) y `FileImageCache` las guarda en `IMAGE_CACHE_DIR` la
  primera vez (tope `IMAGE_CACHE_MAX_MB`; lleno, se sirven sin guardar). Solo acepta rutas con la
  forma de las de Scryfall.
- **Mazo**: `DeckSource.load` → `parseDecklist` → `resolveDecklist` (agrupa por oracleId, detecta
  comandante: marcado → único candidato o pareja válida → si no, `commanderCandidates` para que
  elija el usuario con `chooseCommanders`) → `validateDeck`.

## Decisiones

- **Identidad de carta = `oracle_id` de Scryfall.** Todas las impresiones cuentan como la misma carta.
  Cartas de dos caras / split: emparejar por nombre completo (`A // B`) y por nombre de la primera cara.
- **Scryfall**: fuente de verdad. Bulk `oracle_cards` + `default_cards` descargados a
  `SCRYFALL_DATA_DIR` (Scryfall los sirve como JSON Lines con gzip, `jsonl_download_uri`; se
  guardan como `.jsonl.gz`; `readBulkFile` también lee el formato antiguo de array JSON), leídos en _streaming_ y volcados a SQLite solo con los campos necesarios.
  API solo cuando haga falta: User-Agent propio (`HTTP_USER_AGENT`) y ≥ 100 ms entre peticiones.
- **EDHREC**: sin API oficial. Solo `json.edhrec.com/pages/commanders/{slug}.json` y
  `/{slug}/{tema}.json`, todo detrás de `EdhrecClient` (adapters/edhrec): caché en BD (`HttpCache`,
  TTL `EDHREC_CACHE_TTL_HOURS`, 24 h), rate limit (`EDHREC_MIN_INTERVAL_MS`), User-Agent
  identificable, y validación con zod de la forma del JSON. Si la estructura cambia, solo se rompe el
  adaptador y devuelve un error tipado. **Si algo de EDHREC/Moxfield falla, avisar al usuario; no
  buscar formas de saltárselo.**
- **Colección ManaBox**: CSV con cabecera (ver abajo). Emparejar por `Scryfall ID`; si falta, por
  set + número de coleccionista; si no, por nombre. Lo no emparejado queda como `unmatched`.
- **Mazos**: interfaz `DeckSource`, se usa la primera que acepte la entrada (Archidekt → Moxfield →
  texto). Texto pegado (`1 Sol Ring`, `1x Sol Ring (C21) 263`, secciones de comandante) o links:
  - Archidekt: endpoint JSON público `archidekt.com/api/decks/{id}/`. La categoría "Commander" marca
    el comandante; las cartas cuya categoría principal no se incluye en el mazo se ignoran.
  - Moxfield: **sin API oficial**, `api2.moxfield.com/v3/decks/all/{id}` (también se acepta la
    forma v2). Solo cuentan `mainboard` y `commanders`.
  - Errores: `DeckSourceError` (`not_found`, `blocked` [401/403/429, sin reintentos], `unavailable`,
    `format`), siempre sugiriendo exportar la lista como texto. Rate limit
    `DECK_SOURCES_MIN_INTERVAL_MS`. Sin caché (los mazos cambian). Esquemas zod tolerantes; los
    fixtures están escritos a mano (verificar con `deck:check -- <link>`).
  - Las entradas de mazo pueden traer `scryfallId`; al resolver se prueba id → set+nº → nombre.
- **Clasificador de roles** intercambiable (`RoleClassifier`): primero heurísticas sobre oracle text
  y tipo; más adelante `otag:` de Scryfall. Una carta puede tener varios roles.
- **Scoring**: `score = a·synergy + b·inclusion + c·bonus_rol`; pesos y mínimos por rol
  configurables en `src/config`.
- **Nunca se propone cortar**: comandante(s), tierras básicas, cartas bloqueadas.
- **Nunca se propone meter** una carta fuera de la identidad de color del comandante.
- **Mínimos por defecto**: 36 tierras, 10 ramp, 10 robo, 8 removal, 2 wipes.
- **Idioma**: textos de la UI en español; código e identificadores en inglés.
- **Formatos de lista admitidos**: `1 X`, `1x X`, `X`, `1 X (SET) 123`, `*F*`/`*E*`, `*CMDR*`,
  `SB:`, secciones Commander/Deck/Sideboard/Maybeboard/Companion/About, categorías y etiquetas de
  Archidekt (`[Commander{top}]`, `{noDeck}`, `^…^`) y etiquetas de Moxfield (`#!Ramp`).
- **Secretos**: solo en `.env` (gitignored). `.env.example` documenta las variables.

## Formato del CSV de ManaBox (observado en el export del usuario)

Columnas: `Name, Set code, Set name, Collector number, Foil, Rarity, Quantity, ManaBox ID,
Scryfall ID, Purchase price, Misprint, Altered, Signed, Condition, Language, Proxy,
Purchase price currency, Added`.

- Campos con comas van entre comillas (p. ej. `"Ultros, Obnoxious Octopus"`); las cartas de dos
  caras usan `A // B` en `Name`.
- `Foil`: `normal` | `foil` (posiblemente `etched`). `Quantity`: entero. Booleanos: `true`/`false`.
- En el export actual todas las filas traen `Scryfall ID`, idioma `en` y precios en EUR.

## Fases

0. Arquitectura y setup ✅
1. Datos de Scryfall + import CSV ManaBox + parser de listas, con tests ✅
2. `EdhrecClient` con caché + tests con fixtures ✅ (fixtures escritos a mano: verificar con
   `edhrec:fetch` contra EDHREC real)
3. Motor de sugerencias + clasificador de roles, con tests de casos concretos ✅
4. UI (import, mazo con curva/roles, swaps aceptar/descartar, bloqueos, exportar texto) ✅
5. Importar mazos desde links de Archidekt y Moxfield (+ lista del mazo agrupada por rol) ✅
6. Mazos guardados en BD + descontar copias usadas en otros mazos ✅
7. Modo "si compro N cartas baratas, ¿cuáles mejoran más el mazo?" con precio de Cardmarket ✅
8. Usuarios: registro/login con email+contraseña y Google; colección y mazos por usuario ✅
9. Parte social: perfiles públicos, mazos públicos/privados, colección pública opcional, seguir y
   notificaciones (mazo nuevo, carta cara) ✅
10. Crear mazos desde el comandante (mazo medio de EDHREC o desde cero) y gestor de mazos ✅
11. Exportar a Arena/MTGO, mazos ocultos, mano inicial y empezar a guardar precios ✅
12. Bracket estimado, game changers y bracket objetivo en el motor ✅
13. Comunidad: mazos que puedes montar ya (% y coste), filtros y "me gusta" ✅
14. Precios: histórico, lo que más sube/baja de la colección, avisos de bajada; símbolos e
    imágenes servidos desde nuestro servidor ✅

Las fases siguientes (15–20) están en `ROADMAP.md`. Se hacen en ese orden salvo que el usuario
diga otra cosa, y cada una se empieza solo cuando el usuario lo pida.

### Futuro (no empezar hasta que el usuario lo pida)

- **App móvil**. Requisito ya fijado: debe aparecer como destino al **compartir desde ManaBox**
  (share sheet de Android/iOS) y aceptar tanto el **CSV** como el **texto** compartido, importándolo
  directamente como colección (o como mazo si es una lista). Reutilizará la API JSON (`/api/*`);
  para autenticarse desde la app, añadir el plugin `bearer` de Better Auth.

Al terminar cada fase: parar y esperar el OK del usuario.
