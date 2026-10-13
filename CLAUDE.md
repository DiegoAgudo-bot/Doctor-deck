# Doctor Deck

App web que sugiere mejoras 1×1 ("quita X → mete Y") para mazos de Commander usando
recomendaciones de EDHREC, priorizando cartas de la colección del usuario (export de ManaBox).

@AGENTS.md

## Comandos

| Comando                                                                                           | Qué hace                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm install`                                                                                     | Instala dependencias y genera el cliente Prisma (`postinstall`)                |
| `cp .env.example .env`                                                                            | Configuración local (nunca se sube `.env`)                                     |
| `npm run db:migrate`                                                                              | Aplica/crea migraciones de Prisma sobre SQLite (`data/deck-doctor.db`)         |
| `npm run dev`                                                                                     | Servidor de desarrollo                                                         |
| `npm test` / `npm run test:watch` / `npm run test:coverage`                                       | Vitest                                                                         |
| `npm run e2e`                                                                                     | Pruebas de navegador (Playwright, escritorio y móvil) contra la build, sin red |
| `npm run typecheck`                                                                               | `next typegen` + `tsc --noEmit`                                                |
| `npm run lint`                                                                                    | ESLint (incluye la regla de capas)                                             |
| `npm run format` / `format:check`                                                                 | Prettier                                                                       |
| `npm run build`                                                                                   | Build de producción                                                            |
| `npm run scryfall:sync [-- --force \| --skip-download]`                                           | Descarga los bulk de Scryfall (si hay versión nueva) y los vuelca a la BD      |
| `npm run symbols:sync`                                                                            | Descarga los símbolos de maná de Scryfall a `public/symbols/`                  |
| `npm run otags:sync [-- --force \| --tag ramp]`                                                   | Descarga las etiquetas `otag:` de Scryfall Tagger (roles)                      |
| `npm run db:backup`                                                                               | Copia de seguridad de la SQLite en `data/backups/` (ver `DEPLOY.md`)           |
| `npm run collection:import -- "export.csv" [--user email]`                                        | Importa un CSV de ManaBox (a la cuenta indicada) y muestra el resumen          |
| `npm run users:claim -- --user email`                                                             | Pasa a esa cuenta la colección y los mazos de antes de haber usuarios          |
| `npm run deck:check -- "lista.txt" \| "https://…"`                                                | Parsea y resuelve una lista de mazo contra el catálogo                         |
| `npm run edhrec:fetch -- "Comandante" [--theme x] [--partner "B"] [--save f.json]`                | Pide recomendaciones a EDHREC (con caché) y muestra un resumen                 |
| `npm run deck:suggest -- "lista.txt" [--theme x] [--lock "Carta"] [--commander "C"]`              | Analiza un mazo y muestra los cambios sugeridos                                |
| `… deck:suggest -- … [--deck-id uuid] [--ignore-other-decks] [--buy N --max-price 1 --budget 10]` | Igual, con mazo guardado / sin descontar otros mazos / modo compra             |

Antes de cada commit: `npm run typecheck && npm run lint && npm run format:check && npm test`
(y, si se toca la UI, `npm run build && npm run e2e`; si se toca `mobile/` o la API que usa,
`cd mobile && npm run typecheck && npm test`).

**CI/CD**: `.github/workflows/ci.yml` ejecuta esos checks + build en cada push/PR; en push a `main`
despliega en el VPS (`root@37.27.32.222:/doctor-deck`) por SSH (`scripts/deploy.sh`: pull +
`docker compose up -d --build`; el contenedor aplica `prisma migrate deploy` al arrancar). La app va
detrás del Traefik de pulsestack en `https://doctordeck.app` (`DECK_DOCTOR_HOST`); `www.` y la
dirección antigua `deckdoctor.37.27.32.222.nip.io` redirigen allí (301).
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
  la colección por carta (con la imagen de la impresión de la que tengo más copias) o, con
  `by: "copy"` en `/api/collection/view` (la app lo usa por defecto, como ManaBox), por variante
  (edición, foil, idioma y estado; `CollectionCard.key`/`variant`) con catálogo, precio, roles, idiomas y mazos que la usan; `browseMyCollection` filtra,
  ordena y pagina en el servidor (`domain/collection/browse.ts`; la web pide 48 por página).
  `summary.totalCards` = copias identificadas (sin las filas sin emparejar). Cada copia guarda su
  idioma (`CollectionEntry.language`, código de Scryfall: `en`, `es`, `ja`…; `normalizeLanguage` en
  `domain/cards/languages.ts` acepta también "Japanese"…): sale del `Language` del CSV o del campo
  `language` de `POST /api/collection/cards`, se ve como etiqueta (`ES ×2`) y hay filtro por idioma.
  Solo es presentación: el análisis sigue siendo por carta. Sin cuenta, todo vive
  en el navegador (`local-collection.ts`: `{import, added}`) y se manda como pares
  `[oracleId, copias]`.
- **Editar la colección sin ManaBox** (Fase 20): `CollectionEntry.condition` (estado como en
  ManaBox: `near_mint`, `lightly_played`…; `domain/cards/conditions.ts`) y `publicId` por línea.
  `collectionLines` (`GET /api/collection/lines?oracleId=`) da mis copias de una carta con su
  impresión y precio; `editCollectionLine` (`PATCH /api/collection/lines/{publicId}`: `quantity`
  (0 = borrar), `foil`, `language`, `condition`, `scryfallId` de otra impresión de la misma carta)
  vale también para las del CSV, que pasan a `matchMethod = "manual"` para que reimportar no las
  pise; `DELETE /api/collection/lines/{publicId}` borra cualquiera. `exportCollectionCsv`
  (`GET /api/collection/export`) escribe el CSV de ManaBox (`toManaboxCsv`, se vuelve a leer igual).
  UI: pulsar una carta de la colección abre `CollectionCardDialog` (imagen + cada copia editable).
- **Carta → mazo** (UX U4): «Añadir a un mazo» (`AddToDeck`, en la ficha de la colección, la
  ficha de la carta y la hoja del móvil; solo con sesión) → `POST /api/decks/{id}/cards`
  (`{oracleId}`, `addCardToDeck`): resuelve la lista guardada (aunque sea un enlace), comprueba
  con `addCardProblem` (`domain/deck/add-card.ts`) que no sea el comandante, que esté en su
  identidad y que no esté ya (salvo básicas; error 409 con `code`), la reescribe en texto con
  `decklistWithCard` (conserva impresiones y las líneas no encontradas) y la guarda con
  `saveDeck`. `CardDTO.canBeCommander` → «Crear mazo con X» (`/decks/new?commander=`) en la ficha
  de la colección; filtro `commander` («Pueden ser comandante») en la colección; enlace «Mazos que
  puedes montar» (`/community?sort=owned`, Comunidad lee `?sort=`).
- **Cuenta y RGPD** (Fase 20, `application/account.ts`): `GET /api/me/export` (todos mis datos en
  JSON, sin ids internos) y `DELETE /api/me` (`{confirm: email}`; borra en cascada). Páginas
  `/privacy` y `/legal` (titular y contacto de `LEGAL_OWNER`/`LEGAL_EMAIL`), pie `LegalFooter` con el
  aviso de la Fan Content Policy, sección "Tus datos" en `/settings`.
- **Compartir y SEO** (Fase 20, `server/share.ts`, `server/og.tsx`): `generateMetadata` y
  `opengraph-image` en `/decks/[id]` (solo públicos u ocultos; los ocultos con `noindex`) y
  `/u/[username]`: imagen 1200×630 con el arte del comandante (`art_crop` de la caché de imágenes),
  fuente Instrument Sans (`assets/fonts`, OFL). `metadataBase` = `BETTER_AUTH_URL`. `robots.ts` y
  `sitemap.ts` (mazos públicos y perfiles) se generan al pedirlos.
- **PWA** (Fase 20): `app/manifest.ts`, iconos en `public/icons/` (`npx tsx scripts/make-icons.tsx`
  los regenera), `themeColor` y márgenes `safe-area` en las barras.
- **Copias de seguridad** (Fase 20): `backupDatabase` (`adapters/db/backup.ts`, API `backup` de
  SQLite + `integrity_check` + gzip, rotación `BACKUP_KEEP`); cron diario que añade `deploy.sh`.
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
- **Impresiones** (Fase 18): `Printing` guarda también `priceEurFoil`, `setName` y `releasedAt`;
  `printingPrice(p, foil)` da el precio de una copia. El análisis sigue siendo por carta
  (`oracleId`); la impresión es presentación y precio:
  - Mazos: `resolveDecklist` recuerda la impresión pedida (`ResolvedDeck.printings`, por Scryfall
    ID o `(SET) número`), `saveDeck` la guarda en `DeckCard.scryfallId` y el análisis la devuelve en
    `CardDTO.printing` con su imagen (`cardWithPrintingDTO`). Elegirla (`PrintingDialog`, columna
    "Edición" de la tabla, `GET /api/cards/{oracleId}/printings`) reescribe la lista con
    `setPrinting` → `1 Sol Ring (FRC) 21`, que exportan los formatos de texto (no Arena/MTGO).
  - Colección: `CollectionEntryRow.scryfallId`; `collectionView` calcula `value` = cada copia al
    precio de su impresión (foil si es foil) o, si no se sabe, al de la más barata. Orden "valor".
  - Histórico: además de `PriceSnapshot` (por carta, la más barata: avisos y lista de deseos),
    `PrintingPriceSnapshot` (por impresión, normal y foil) de las impresiones que hay en alguna
    colección; `collectionPrices` usa el de cada copia (`Holding`) y si no hay, el de la carta.
- **Intercambios** (Fase 17, `application/trades.ts`, dominio en `domain/trades/lists.ts`):
  lista de deseos = cartas añadidas a mano (`WishlistItem`) + lo que falta de los mazos con
  `Deck.inWishlist` (lo que piden todos mis mazos − lo que tengo, como mucho lo que piden los
  marcados; si está por las dos vías, el máximo); "para cambiar" = copias libres (tengo − usadas
  en mis mazos), sin básicas ni las marcadas "no la cambio" (`TradeKeep`). `User.tradesPublic`
  (privadas por defecto). `tradeMatches`: con cada usuario con listas públicas, lo que tiene que
  quiero y lo que quiere que tengo, con valor; primero la gente que sigo. `notifyTradeMatches`
  (tras `scryfall:sync`): aviso `trade_match` por carta, como mucho cada 30 días. API `GET
/api/trades`, `GET /api/trades/matches?username=`, `PUT /api/trades/wishes/{oracleId}`
  (`{quantity}`), `PUT /api/trades/keeps/{oracleId}` (`{keep}`), `PATCH /api/decks/{id}`
  (`{inWishlist}`), `PATCH /api/me/profile` (`{tradesPublic}`). UI: `/trades` (cruces, lo que
  busco, para cambiar), sección en el perfil de otros, botón en "Qué me falta" y ajuste en
  `/settings`. Sin pagos ni mensajes. Cuentas de prueba locales en `data/test-accounts.local.json`
  (gitignored).
- **Calculadora de intercambio y propuestas** (Fase 19, `application/trade-proposals.ts`, dominio
  en `domain/trades/proposal.ts`, adaptador `PrismaTradeProposalRepository`):
  - "Para cambiar" por copias (`buildTradeCopies`): de cada carta de la lista "para cambiar", qué
    copias concretas (impresión, foil, idioma) con su precio (`printingPrice`, si no, la más
    barata); se supone que en los mazos están las más baratas, así que se ofrecen las de más valor.
    `copyKey` identifica una copia (`oracleId|scryfallId|f|idioma`).
  - `tradeCalculator` (`GET /api/trades/calculator?username=`): `proposeTrade` cruza las listas
    (cada uno da sus copias más baratas de cada carta) y `balanceTrade` cuadra: mientras la
    diferencia pase la tolerancia (`tradeTolerance`: 5 % del lado que más vale o 1 €), quita del
    lado que vale más la copia más cara que no haga pasarse al otro lado; nunca deja un lado vacío.
    Solo con usuarios con `tradesPublic`, nunca consigo mismo.
  - Propuestas (`TradeProposal` con `publicId`, `TradeProposalItem` por versión con `giverId` y el
    precio del momento): `draft` (solo la ve quien la crea) → `pending` (le toca a `turnUserId`:
    aceptar, rechazar o **contraproponer**, que crea una versión nueva y pasa el turno; las
    versiones anteriores quedan como historial) → `accepted` | `rejected` | `cancelled` (cualquiera
    de los dos retira una pendiente). Las líneas se validan con `priceItems` contra lo que cada uno
    tiene para cambiar (`TradeProposalError` `unavailable`).
  - **Aceptar mueve las cartas** entre las dos colecciones de Doctor Deck (la idea es dejar ManaBox):
    en una transacción, `accept` quita las copias a quien las da (primero las de esa impresión, foil
    e idioma; si no, otras de la carta) y se las añade a quien las recibe como cartas sueltas
    (`matchMethod = "manual"`, sobreviven a reimportar el CSV); si a alguien le faltan copias no
    cambia nada (`MissingCopiesError` → `trade_missing_copies`). Lo recibido sale de la lista de
    deseos manual. Reimportar un CSV antiguo de ManaBox devolvería las cartas dadas (se avisa).
  - Avisos `trade_proposal`, `trade_counter`, `trade_accepted`, `trade_rejected`,
    `trade_cancelled` (`Notification.tradeId`).
  - API: `GET|POST /api/trades/proposals` (`{username, lines, send}`), `GET|PATCH
/api/trades/proposals/{id}` (`{action: save|send|counter|accept|reject|cancel|delete, lines?}`);
    `lines` = `[{side: give|get, oracleId, scryfallId, foil, language, quantity}]` desde quien la
    manda. UI: `/trades/with/{username}` (calculadora), `/trades/proposals/{id}`
    (`TradeEditor`: dos columnas, ± por copia, "Añadir más", balance en vivo), pestaña
    "Propuestas" en `/trades` y "Proponer intercambio" en cada cruce y en el perfil.
- **Social de la fase 21** (casos de uso en `application/{groups,games,loans,comments,feed}.ts`,
  puertos en `domain/ports/{play,loans,moderation,feed}.ts`, adaptadores `play-repository.ts`,
  `loan-repository.ts`, `moderation-repository.ts`, `feed-repository.ts`; errores con `AppError`
  (`application/errors.ts`: `code` + estado HTTP, lo traduce `errorResponse`); dependencias en
  `server/social.ts` y DTOs en `server/social-dto.ts`; la gente siempre por nombre de usuario,
  nunca por id):
  - **Grupos** (`PlayGroup` con `publicId` e `inviteCode` aleatorio, `GroupMember`): se entra con
    `/groups/join/{inviteCode}` (aviso `group_join` al creador); solo los miembros ven el grupo
    (si no, 404). El creador cambia nombre, genera otro enlace, echa a gente y lo borra (no puede
    salir). Máx. 50 miembros y 20 grupos por persona. Los miembros ven los mazos públicos y
    ocultos de los demás (`groupDecks`), "¿quién tiene…?" (`groupHolders`: copias y libres =
    tengo − usadas en mazos − prestadas) y "Te lo pueden dejar" (`groupCanLend`: mi lista de
    deseos —o, sin mazos marcados, lo que falta en todos mis mazos— ∩ copias libres del grupo).
    API `GET|POST /api/groups`, `GET|PATCH|DELETE /api/groups/{id}` (`{name?, description?,
newInvite?}`), `DELETE /api/groups/{id}/members/{username}`, `GET /api/groups/{id}/decks`,
    `GET /api/groups/{id}/cards?oracleId=`, `GET /api/groups/{id}/can-lend`, `GET|POST
/api/groups/join/{code}`.
  - **Partidas** (`Game` + `GamePlayer`: usuario o invitado, mazo guardado o solo nombre, nombre y
    comandantes del momento, ganador): `recordGame` valida que los usuarios sean del grupo (sin
    grupo, solo yo y el resto invitados), que cada mazo sea de su jugador y no privado, 2–8
    jugadores y como mucho un ganador; aviso `game_recorded` a los demás. Las ve quien jugó, quien
    la registró y los miembros del grupo; la borra quien la registró o el creador del grupo.
    Estadísticas en el dominio (`domain/play/stats.ts`: `playerStandings`/`deckStandings`,
    victorias → % → partidas, y racha) sobre las 500 últimas. API `GET|POST /api/games`
    (`?group=` | `?deck=` | sin nada = las mías), `GET|DELETE /api/games/{id}`; el perfil
    (`GET /api/users/{u}`) trae `record` (jugadas y ganadas) y `blocked`.
  - **Contador de vidas** (`/play`, `components/life-counter.tsx`, lógica pura en
    `domain/play/life.ts`): 2–6 jugadores, 20/30/40 vidas, pulsar mitad izquierda/derecha (mantener
    repite), daño de comandante por rival (resta vida; 21 elimina), veneno (10), conceder, turnos,
    revancha. A pantalla completa (`.lifetable`, los de arriba girados 180°), estado en
    `localStorage` y Wake Lock para que no se apague la pantalla. Al quedar uno, "Registrar
    partida" (`RecordGameDialog`, también desde el grupo).
  - **Préstamos** (`Loan`: a un usuario `@ana` —aviso `loan_new`— o a un nombre): solo copias
    libres. `PrismaDeckRepository.usage()` suma los préstamos sin devolver (`withLoans`,
    `domain/collection/loans.ts`, "Prestada a @ana"), así que cuentan como ocupadas en el motor,
    "para cambiar", la colección y los grupos. Devuelta la marca cualquiera de los dos; borrar,
    quien prestó. API `GET|POST /api/loans` (`?all=1` con devueltos), `PATCH
/api/loans/{id}` (`{action: "returned"}`), `DELETE /api/loans/{id}`. UI `/loans` y "Prestar"
    en la ficha de una carta de la colección y en "¿quién tiene…?".
  - **Feed** (`activityFeed`, `/feed` y en la portada): de la gente que sigo y de mis compañeros de
    grupo, sin bloqueados. Sin tabla propia: `PrismaFeedSource` lee de lo que ya hay (mazos
    públicos nuevos, "me gusta", comentarios, partidas —una entrada por partida; el nombre del
    grupo solo si soy miembro— e intercambios aceptados si los dos tienen las listas públicas) y
    `mergeFeed` mezcla por fecha. Paginado con `?before=` (fecha); filtro `?types=deck,game…`.
  - **Comentarios** (`DeckComment`) en mazos públicos y ocultos (`GET|POST|PATCH
/api/decks/{id}/comments`, `PATCH` = `{open}` del dueño, `Deck.commentsOpen`): texto limpio
    de 1–1000 caracteres, ≤ 2 enlaces, 15 s entre comentarios (`domain/social/comments.ts`); aviso
    `deck_comment` al dueño. Los borra el autor, el dueño del mazo o un administrador (`DELETE
/api/comments/{id}`). **Moderación**: `POST /api/comments/{id}/report` (`spam` | `abuse` |
    `other`, una por persona); con 3 se oculta (`hiddenAt`; el dueño del mazo lo sigue viendo
    marcado) hasta que un administrador (`ADMIN_EMAILS`) lo revisa en `/admin/reports` (`GET
/api/admin/reports`, `PATCH /api/admin/reports/{id}` `{action: keep|hide|delete}`).
    **Bloquear** (`Block`, `POST|DELETE /api/users/{u}/block`, lista en `GET /api/me/blocks` y en
    Ajustes): rompe el seguimiento en los dos sentidos e impide seguir, comentar sus mazos,
    proponer intercambios (`trade_blocked`), prestar y salir en sus cruces y feed; sus comentarios
    no se ven. No se avisa al bloqueado.
  - `GET /api/me/export` incluye grupos, partidas, préstamos, comentarios y bloqueados.
- **Buscador de cartas y ficha** (`/cards`, `/cards/{oracleId}`; `application/card-catalog.ts`):
  `CatalogQuery` (`domain/cards/catalog-search.ts`, se lee y escribe en la URL: `q` en nombre, tipo
  o texto, `colors` + `mode` within|exact|includes o `C` incoloras, `type`, `commander=1`, `gc=1`,
  `cmc` 0–7, `sort` popular|name|cmc) → `CardRepository.searchCatalog` (SQL sobre `OracleCard`, sin
  tokens; "puede ser comandante" aproximado en SQL: legendaria criatura/background o "can be your
  commander") con el precio más barato de cada una. API pública `GET /api/cards` y `GET
/api/cards/{oracleId}` (`cardDetail`: texto, roles, impresiones con precio normal/foil, mínimos,
  con sesión mis copias —libres, en qué mazos, deseada— y hasta 6 mazos públicos con ella de
  comandante). La ficha enseña el histórico (`PriceChart`), enlaza a Cardmarket, añade a la
  colección o a la lista de deseos y, si puede ser comandante, "Crear mazo" →
  `/decks/new?commander={oracleId}` (el asistente la deja elegida). `/community?q=` rellena el
  buscador de Comunidad. La ficha también se abre desde la colección ("Ver ficha").
  En la ficha de un comandante, **"Lo que se juega con X"** (`CommanderStaples`, `GET
/api/cards/{oracleId}/edhrec?theme=`, `commanderStaples`): la página de EDHREC del comandante
  (general o de un tema) agrupada por sus listas como en su web (`recommendationSections`,
  `domain/recommendations/sections.ts`: alta sinergia, las más jugadas, novedades, game changers,
  criaturas, instantáneos, conjuros, artefactos, encantamientos, planeswalkers, tierras…; como
  mucho 30 por lista, por inclusión), con % de mazos, sinergia, precio y, con sesión, "La tienes" /
  "En tus mazos" y filtro de las que tengo o me faltan. Mismo `EdhrecClient` (caché, errores con
  aviso).
- **Combos** (Fase 16, Commander Spellbook, **sin API oficial**): `SpellbookClient`
  (`adapters/spellbook`, puerto `ComboSource`) hace `POST
backend.commanderspellbook.com/find-my-combos?limit=500` con el mazo (nombres), cachea en
  `HttpCache` por la lista de cartas (TTL `SPELLBOOK_CACHE_TTL_HOURS`), guarda solo lo que usamos
  (`parseFindMyCombos`, zod), y si falla devuelve la copia caducada con aviso; si no,
  `ComboSourceError` (`blocked` 403/429 sin reintentos, `unavailable`, `format`). Rate limit
  `SPELLBOOK_MIN_INTERVAL_MS`. `deckCombos` (`application/deck-combos.ts`): completos, a una
  carta (`oneAwayCombos`: qué carta falta y si la tengo libre, en otros mazos o hay que comprarla,
  con precio; fuera los "B" prohibidos), `keyCards` (las que más combos abren) y el bracket
  recalculado (`estimateBracket(cards, combos)`: etiqueta R → 4, S/P → 3). Va en `POST /api/combos`
  aparte de `/api/analyze` (Spellbook tarda ~2,5 s la primera vez); la UI lo pide tras cada
  análisis, pestaña "Combos", y al llegar actualiza el bracket de la cabecera.
- **Roles corregidos y etiquetas** (Fase 15): `withOverrides` (`domain/roles/overrides.ts`)
  aplica, por este orden, mis correcciones solo para ese mazo (`DeckRoleOverride`, por mazo y
  carta, solo las del dueño y solo al analizar ese mazo guardado con `deckId`; `PUT
/api/decks/{id}/card-roles/{oracleId}`, mismo cuerpo), mis correcciones (`CardRoleOverride`, por
  usuario y carta, valen en todos mis mazos y en la colección; sin cuenta viven en el navegador, `local-roles.ts`, y se
  mandan como `roleEdits`), las etiquetas de la lista (Moxfield `#!Ramp`/`#wincon` y categorías
  de Archidekt `[Ramp,Draw]`, que ahora guarda el parser en `entry.tags`; `splitTags` las separa
  en roles —alias en inglés y español— y etiquetas libres) y los roles automáticos. Las etiquetas
  libres de todas las capas se suman. El motor, los
  mínimos y el bracket usan el clasificador corregido; `DeckCardDTO` lleva `roleSource` (`auto` |
  `list` | `mine` | `deck`) y `tags`. API `GET /api/me/card-roles`, `PUT /api/me/card-roles/{oracleId}`
  (`{roles, primary?, tags}`; vacío = volver a los automáticos). UI: en la tabla del mazo, clic en
  el rol (`RoleEditDialog`; en un mazo guardado propio, "En todos mis mazos" o "Solo en este mazo"). Exportar `moxfield` escribe `#Rol #etiqueta` y se vuelve a leer.
- **Roles** (`domain/roles`): `HeuristicRoleClassifier` con regex sobre el oracle text (sin
  reminder text, nombre propio → "this") y el tipo de la cara frontal. Roles: land, ramp, draw,
  removal, wipe, counterspell, tutor, protection, synergy (= lo que no es nada de lo anterior).
  Una carta cuenta en todos sus roles; el principal sale de un orden de prioridad. Limitaciones
  conocidas: overload/escalate no cuentan como wipe; "protection" exige conceder a otros.
  Segunda fuente: las etiquetas de **Scryfall Tagger** (`otag:`). `withTaggerRoles`
  (`domain/roles/otags.ts`) suma a los heurísticos los roles de `OTAG_ROLES` (`ramp`, `draw`,
  `removal`, `board-wipe` → wipe, `counterspell`, `tutor`; protección solo heurística), sin cambiar
  el principal salvo que fuera "synergy" y sin tocar las tierras. Se descargan con la búsqueda de la
  API (`ScryfallTagger`, `adapters/scryfall/tagger.ts`, `otag:<tag>`, paginada, errores
  `TaggerError`) a `CardOtag` (sin FK: sobrevive a vaciar el catálogo) y `OtagSync`;
  `PrismaCardRepository` devuelve cada `Card` con sus `otags`. `scryfall:sync` las actualiza si
  tienen más de 7 días (`syncOracleTags`); si Scryfall falla se avisa y se usan las de antes.
  Los nombres de las etiquetas están **pendientes de verificar** contra Scryfall real
  (`npm run otags:sync` avisa si alguna sale con 0 cartas).
- **UI** (`src/app`, `src/components`): páginas `/` (estado), `/collection` (subir CSV) y `/analyze`
  (pegar lista → curva, roles, cambios con aceptar/descartar, candados, exportar). Son componentes de
  cliente que solo hablan con la API JSON:
  - `GET /api/status`, `POST /api/collection` (cuerpo = texto del CSV), `POST /api/collection/cards`
    (`{cards: [{oracleId|scryfallId|name, quantity, foil?}]}`, máx. 500), `DELETE
/api/collection/cards/{publicId}` (solo las añadidas a mano), `POST /api/collection/view`
    (`{collection?, filters, sort, offset, limit}`; `limit: 0` = solo totales), `GET /api/collection/cards`
    (las añadidas a mano), `GET /api/cards/search?q=&limit=`, `POST /api/analyze`
    (`{input, theme?, commanders?, locked?, excluded?, deckId?, useOtherDecks?, buy?: {maxCards,
maxPrice?, budget?}}`, validado con zod), `GET|POST /api/decks`, `GET|DELETE /api/decks/[id]`.
  - Páginas: `/decks` (lista, borrar) y `/decks/{publicId}` (un mazo guardado; exigen sesión). Los
    mazos se identifican fuera de la BD solo por `Deck.publicId` (uuid): API `/api/decks/{uuid}`,
    `deckId` de `/api/analyze`; el `id` numérico es interno. Rutas en grupos `(app)` (con barras) y
    `(cuenta)` (entrar, registro…, sin barras). Con Cache Components, `usePathname`/`useParams` se
    leen dentro de `<Suspense>` (si no, falla el build en rutas dinámicas).
  - **URLs siempre en inglés** (páginas, parámetros y valores: `?new=1`, `?analyze=1`, `?edit=1`,
    `?tab=changes|missing|list|combos|stats|buy` en los mazos, `?tab=matches|proposals|wanted|offered`
    en `/trades`) y **nunca con IDs internos**: lo que se identifica en una URL usa un uuid aleatorio
    (`Deck.publicId`, `TradeProposal.publicId`, `CollectionEntry.publicId`) o el nombre de usuario.
    Las URL antiguas en español redirigen a las nuevas (`next.config.ts`).
  - Las páginas (`<main className="page">`) ocupan todo el ancho; solo se limitan bloques de
    texto (legal) o tarjetas sueltas. `CardHover`: con ratón, la carta al pasar por encima; en
    táctil, tocarla abre `CardSheet` (hoja con carta, tipo, precio, mis copias y "Ver ficha").
    "N en otros mazos" de la cabecera de un mazo abre qué cartas y en qué mazos
    (`OwnershipItemDTO.usedInDecks`, enlazados), y la tabla de la lista las marca.
  - **Preferencias** (`UserPref`, `domain/prefs/prefs.ts`, `components/prefs.ts`): filtros, orden
    y vista de la colección (`collection`) y del buscador (`cards`, como parámetros de URL sin el
    texto) se guardan en el navegador y, con cuenta, en `GET /api/me/prefs` / `PUT
/api/me/prefs/{key}` (objeto JSON ≤ 4000 caracteres). `restorePref` aplica la del navegador al
    momento y luego la del servidor; sin ninguna local espera al servidor para no pisarla.
  - Orden con dirección (botón ↓/↑, `SortDirButton`): colección `dir` en `/api/collection/view`
    (`collectionSorter`, sin dato siempre al final) y buscador `sort=price` + `dir` + `min`/`max`
    (€). `OracleCard.minPriceEur` (precio de la impresión más barata) lo rellena `insertPrintings`.
  - `CardImage` con `sizes` ofrece también la imagen pequeña de Scryfall (146 px) en miniaturas;
    `CardGridSkeleton` y `TilesSkeleton` mientras cargan las rejillas y listas.
  - **Rendimiento** (bloque C del bugfix): `createDb` sube `dataEpoch()` con cada escritura en
    colección, mazos, préstamos, roles corregidos o catálogo; `MemoCache` (`server/memo-cache.ts`)
    guarda por usuario la colección calculada (`container.collectionViews`, válida hasta que cambie
    la época o pasen 10 min) y `browseCollectionView` filtra sobre ella. `EdhrecClient` guarda en
    memoria las 32 últimas páginas validadas hasta que caducan. `/api/collection/view` y
    `/api/analyze` devuelven `Server-Timing` (`Timing`, `timing.wrap` cronometra los adaptadores).
    En el navegador, `swr-cache.ts` enseña lo de la última vez (mis mazos, totales y primera página
    de la colección) mientras llega lo nuevo; se borra al entrar o salir. `GET /api/decks`,
    `/api/decks/{id}`, `/api/collection/cards` y `/api/me/prefs` llevan ETag (`jsonWithEtag`, 304
    si no ha cambiado; pensado también para la app).
  - **Errores** (`ErrorLog`, `domain/errors/report.ts`, `PrismaErrorLog`): los 500 de
    `errorResponse` y los de pintar páginas (`instrumentation.ts`, `onRequestError`) se guardan
    con `reportServerError`; los del navegador los manda `ErrorReporter` (en el layout raíz, y
    `(app)/error.tsx` al fallar una página) a `POST /api/errors` (público, `RateLimiter` 20/min por
    IP). Se agrupan por huella (sin números ni uuids) y se ven en `/admin/errors` (`ADMIN_EMAILS`).
  - **Pruebas de navegador** (`e2e/`, `playwright.config.ts`): `scripts/e2e-db.ts` crea
    `data/e2e.db` con el catálogo de ejemplo y EDHREC de los fixtures (sin red), `global-setup`
    crea la cuenta `e2e@example.com` (administradora) con colección y dos mazos, y se prueban
    colección, mazos, buscador, errores y, en móvil (`mobile.spec.ts`), la hoja de carta y que
    ninguna página tenga scroll horizontal. El CI las corre tras la build. Las especificaciones
    usan `test` de `e2e/fixtures.ts`, que falla si la página lanza errores de JavaScript.
  - **Barra inferior del móvil** (UX U6, `BottomNav`): con cuenta Inicio · Mazos · Colección ·
    Jugar · Más (hoja `Dialog` con perfil, nuevo mazo, cartas, comunidad, actividad, grupos,
    intercambios, préstamos, ajustes y salir; va fuera de `nav.bottomnav` para no heredar sus
    estilos); sin cuenta Inicio · Analizar · Colección · Jugar · Entrar.
  - **Móvil**: las tablas con `.rtable` pasan a tarjetas (celdas `rt-qty`, `rt-main`, `rt-end`
    en la primera línea; el resto debajo) y todos los `.dialog` salen desde abajo como hojas.
    **Buscador global** (`GlobalSearch` en la cabecera, atajo `/`; en el móvil, hoja a pantalla
    completa): cartas (`/api/cards/search`), mis mazos (lista ya cargada) y gente (`/api/users`).
  - Tipos y mapeadores de la API en `src/server/dto.ts` (los componentes solo hacen `import type`);
    errores → JSON `{error: {code, message}}` en `src/server/http.ts`.
  - Las rutas GET llaman a `await connection()` (better-sqlite3 es síncrono y si no, Next las
    prerenderiza). El container es un singleton (`getContainer`).
  - Estado del mazo (lista, tema, bloqueadas, descartadas) en `localStorage` del navegador.
    "Aplicar cambios y recalcular" reescribe la lista con `applySwaps` + `exportDecklist`
    (`domain/deck/export.ts`) y vuelve a analizar excluyendo las cartas descartadas.
    En un mazo mío guardado **todo se guarda solo** (UX U2: `analyze(…, { persist: true })` →
    `persistDeck`): aplicar cambios, tema, «Cambiar lista», editor y edición; candados y
    descartes al momento. Ahí el botón de la cabecera es «Guardar como nuevo». La lista de temas
    de EDHREC se recuerda (la página de un tema no la trae). En su página, un mazo mío guardado
    tiene «Exportar» y «Ajustes» (`DeckSettingsDialog`: nombre, visibilidad, duplicar —abre
    «Guardar como nuevo»—, reemplazar la lista y borrar con confirmación); el bracket objetivo
    sigue en Estadísticas y la lista de deseos en «Qué me falta».
- **Usuarios** (Fase 8, Better Auth, `src/server/auth.ts`): email + contraseña (scrypt, mínimo 8)
  y Google si hay `GOOGLE_CLIENT_ID/SECRET`; "olvidé mi contraseña" solo si hay `SMTP_URL`
  (`adapters/mail`; con el SMTP de Resend se usa su API HTTPS, porque el VPS bloquea los puertos
  SMTP; los correos se mandan sin esperar y si fallan quedan en `/admin/errors`). Sesiones en BD (tablas `user`, `session`, `account`, `verification`) con cookie
  httpOnly; rutas en `/api/auth/[...all]`. Si alguien entra con Google con el mismo email que una
  cuenta existente, se vinculan (`accountLinking`) **solo si el email de esa cuenta está
  verificado** (`requireLocalEmailVerified`, por seguridad); si no, Google vuelve a `/login?error=
account_not_linked` con la explicación y se vincula desde Ajustes ya con sesión
  (`authClient.linkSocial`, sección "Cuenta", que también reenvía el enlace de verificación). Con
  correo configurado, el registro envía el enlace de verificación (`emailVerification`) y
  restablecer la contraseña marca el email como verificado (`onPasswordReset`).
  - `CollectionEntry` y `Deck` tienen `userId`. Los repositorios se crean **por usuario**
    (`container.collectionFor(userId)`, `decksFor(userId)`) y filtran todas sus consultas por él; el
    catálogo y la caché de EDHREC son globales. Dominio y casos de uso no saben de usuarios.
  - Cada ruta de la API llama a `requireUser(request)` (`src/server/session.ts`) → 401 si no hay
    sesión; `/api/status` funciona sin sesión. `src/proxy.ts` redirige a `/login?next=…` las páginas
    privadas si no hay cookie (comprobación optimista; la real es `requireUser`).
  - UI: `/login`, `/signup`, `/forgot-password`, `/reset-password`; `UserMenu` en la cabecera. Tras entrar
    se navega con recarga completa (la caché del router puede tener la redirección de antes).
  - Filas con `userId` vacío = datos de antes de los usuarios → `npm run users:claim`.
  - En producción `loadEnv` exige `BETTER_AUTH_SECRET`; `BETTER_AUTH_URL` debe ser la URL pública.
    En el VPS, `scripts/deploy.sh` genera el secreto en `.env` si falta y `docker-compose.yml` pone
    `BETTER_AUTH_URL=https://$DECK_DOCTOR_HOST`.
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
  Rutas: `/community`, `/u/[username]`, `/notifications`, `/settings`; API `GET|PATCH
/api/me/profile`, `GET /api/users?q=`, `GET /api/users/{u}`, `POST|DELETE /api/users/{u}/follow`,
  `GET /api/notifications`, `POST /api/notifications/read`, `POST /api/community/decks`,
  `PATCH /api/decks/{id}` (`{visibility}`), `POST /api/collection/view` con `username`.
- **Crear mazos** (`application/new-deck.ts`, página `/decks/new`): eliges el comandante
  (buscador con `commander=1`) y `newDeckFromCommander` monta el **mazo medio de EDHREC**
  (`EdhrecClient.getAverageDeck`, `/average-decks/{slug}[/{tema}]`, parser en
  `adapters/edhrec/average-deck.ts`; mismas reglas de caché y errores) o un mazo **vacío** para
  montarlo desde cero. Devuelve la lista en texto, que se guarda con `saveDeck` como cualquier otra.
  Nombre propuesto (`domain/deck/naming.ts`): "<colores> - <de qué va>", p. ej. "Jund -
  Aristócratas" (combinaciones Boros/Jund/… y temas de EDHREC traducidos). API: `GET
/api/commanders?ids=` (temas y nombre) y `POST /api/decks/new` (con sesión guarda y devuelve
  `id`; sin ella devuelve la lista para abrirla en `/analyze?analyze=1`).
  UX U5: «Nuevo mazo» es la única entrada para crear: pestañas «Desde un comandante» (con
  atajos «De tu colección»: mis cartas que pueden ser comandante, `filters.commander`) e
  «Importar una lista o enlace» (`?from=list`; con sesión `POST /api/decks` y se abre el mazo; si
  la lista no dice el comandante —`no_commander`— o no hay sesión, se abre en el analizador).
  Con sesión, la barra superior dice «Mis mazos» en vez de «Analizar mazo».
  Editor: en la pestaña Lista de un mazo propio o sin guardar, "Añadir cartas" (buscador con
  `identity=` de los colores del comandante y recomendadas de tu colección) y −/+ en la tabla;
  cada cambio (`changeCard` en `domain/deck/export.ts`) reanaliza y, si es un mazo guardado, lo
  guarda. "Mis mazos" es el gestor: nuevo, importar, renombrar (`PATCH /api/decks/{id}` con
  `name`), duplicar (copia privada), público/privado y borrar.
- **Exportar** (`exportDeck` en `domain/deck/export.ts`): `text` (Moxfield/Archidekt/ManaBox),
  `arena` (split con `///`, dos caras solo la frontal), `mtgo` (comandante en el banquillo, split
  con `/`) y `moxfield` (texto con etiquetas `#Ramp #wincon`). Por eso `CardDTO` lleva `layout`.
- **Mano inicial** (`domain/deck/draw-odds.ts`, pestaña Estadísticas): hipergeométrica sobre las
  99 (P de 2–4 tierras, caídas de tierra, ramp, robo; en multijugador se roba en el turno 1) y
  manos de muestra con mulligan (el primero gratis).
- **Bracket** (`domain/deck/bracket.ts`): `estimateBracket` da el bracket MÍNIMO (2, 3 o 4) por
  game changers (`Card.gameChanger`, campo `game_changer` de Scryfall; 1–3 → 3, ≥4 → 4),
  destrucción masiva de tierras (regex sobre el texto: "destroy all lands", "each player
  sacrifices N lands", Blood Moon, Winter Orb…; sacrificar tus tierras como coste no cuenta) y ≥3
  cartas de turno extra (→ 4). Tutores solo informativos; los combos los añade la fase 16. Sale en
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
  el ajuste en `/settings`.
- **Sin depender de Scryfall/Cloudflare en el navegador** (en España se bloquean IPs de Cloudflare
  durante los partidos de LaLiga): el navegador solo habla con nuestro servidor. Los símbolos de
  maná están en `public/symbols/` (`npm run symbols:sync`, se suben al repo) y las imágenes de
  cartas se sirven desde `/img/<ruta de Scryfall>`: `cardDTO` reescribe `imageUrl`
  (`localImageUrl`, `domain/cards/images.ts`) y `FileImageCache` las guarda en `IMAGE_CACHE_DIR` la
  primera vez (tope `IMAGE_CACHE_MAX_MB`; lleno, se sirven sin guardar). Solo acepta rutas con la
  forma de las de Scryfall.
- **App móvil** (Fase 22, `mobile/`, ver `mobile/README.md`): Expo + React Native con
  `expo-router`, solo Android. Pestañas como ManaBox (Colección, Mazos, Buscar, Avisos, Más), ficha
  de carta con añadir copias (edición, foil, idioma, estado), mazo (lista, me falta, cambios,
  datos) y lo demás (intercambios, grupos, préstamos, contador, ajustes) en un WebView con la
  sesión. Solo importa **tipos** de la web (`@/server/dto`, `@/server/card-dto`); su código usa
  `~/…`. Servidor para la app:
  - Sesión: plugin `expo` de Better Auth (`trustedOrigins: doctordeck://`, cookie en cabecera;
    Google vuelve a `doctordeck://` con la sesión). La app manda sus peticiones con
    `credentials: "omit"` (si no, el almacén de cookies de Android pisa la cabecera → 401). WebView:
    `POST /api/app/web` (con sesión) da un código de un solo uso (60 s, en memoria,
    `server/app-handoff.ts`) y `GET /api/app/web?code=…&next=/ruta` le pone la cookie de sesión al
    WebView y redirige (solo rutas propias).
  - Compartir desde ManaBox: `POST /api/import/shared` (`{text, save}`; `importShared` en
    `application/shared-import.ts`): CSV (`looksLikeCsv`) o lista `1 Carta (SET) 123 *F*`
    (`(SET) número` → impresión con `findPrintingsBySetNumbers`), primero sin guardar (vista previa
    con `BrowserCollectionRepository`) y luego como cartas sueltas; `looksLikeDeck` si trae
    comandante o 60–101 cartas. Reemplazar con el CSV sigue siendo `POST /api/collection`.
  - Push: `PushDevice` (token de FCM, `POST|DELETE /api/me/devices`); `PrismaSocialRepository`
    llama a `afterCreate` con cada aviso guardado y el container lo manda con `pushNotifications`
    (`application/push.ts`) por `FcmSender` (`adapters/push/fcm.ts`, FCM HTTP v1 con la cuenta de
    servicio de `FCM_SERVICE_ACCOUNT`; borra los tokens que ya no valen). El texto de cada aviso
    sale de `notificationMessage` (`domain/social/notification-text.ts`), que también va en
    `GET /api/notifications` (`message: {title, body, path}`) para la app.
  - `GET /api/app`: versión mínima (`MOBILE_MIN_VERSION`) y qué hay (push, Google, recuperar).
  - CI: `.github/workflows/mobile.yml` (tipos, tests, bundle; en main compila APK y AAB con la
    clave de subida si está en los secretos).
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
- **Clasificador de roles** intercambiable (`RoleClassifier`): heurísticas sobre oracle text y tipo
  más las etiquetas `otag:` de Scryfall Tagger (se suman). Una carta puede tener varios roles.
- **Scoring**: `score = a·synergy + b·inclusion + c·bonus_rol`; pesos y mínimos por rol
  configurables en `src/config`.
- **Nunca se propone cortar**: comandante(s), tierras básicas, cartas bloqueadas.
- **Nunca se propone meter** una carta fuera de la identidad de color del comandante.
- **Mínimos por defecto**: 36 tierras, 10 ramp, 10 robo, 8 removal, 2 wipes.
- **Idioma**: textos de la UI en español; código e identificadores en inglés.
- **Nombre**: **Doctor Deck** (antes "Deck Doctor") en todo lo que se ve. Lo interno conserva
  `deck-doctor` (BD `data/deck-doctor.db`, contenedor, claves de `localStorage`, copias de
  seguridad): cambiarlo no aporta nada y podría perder datos.
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
15. Roles corregidos a mano (en todos mis mazos o solo en uno) y etiquetas (Moxfield/Archidekt),
    en el motor y al exportar; etiquetas `otag:` de Scryfall como segunda fuente de roles ✅
16. Combos (Commander Spellbook): en el mazo, a una carta (con tu colección) y en el bracket ✅
17. Intercambios: lista de deseos, para cambiar, cruces entre usuarios y avisos ✅
18. Impresiones concretas: edición en los mazos, valor exacto de la colección (foil) e idioma de
    cada copia ✅
19. Calculadora de intercambio: propuesta cuadrada por valor, borradores, contrapropuestas y, al
    aceptar, las cartas se mueven entre las colecciones ✅
20. Cimientos: copias de seguridad, colección editable y exportable sin ManaBox, legal y RGPD,
    vistas previas al compartir, portada nueva, arreglos móviles y PWA ✅

21. Social: grupos de juego, contador de vidas y partidas con clasificación, préstamos, feed de
    actividad y comentarios con moderación (bloquear y denunciar) ✅
22. App móvil Android (Expo): colección, mazos, buscador, avisos con push y compartir desde
    ManaBox; servidor listo para la app (sesión, importar lo compartido, push, versión mínima) ✅
    (el escáner de cartas queda para la v2)

Lo siguiente (escáner de cartas en la app, v2) está en `ROADMAP.md`. Se hacen en ese orden salvo que el usuario
diga otra cosa, y cada una se empieza solo cuando el usuario lo pida.

### Futuro (no empezar hasta que el usuario lo pida)

- **Escáner de cartas** en la app (v2): cámara → `POST /api/collection/cards` con `scryfallId`.
- **iOS**: la app está hecha con Expo, pero hace falta cuenta de Apple Developer.

Al terminar cada fase: parar y esperar el OK del usuario.
