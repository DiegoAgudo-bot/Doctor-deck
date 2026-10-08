# Deck Doctor

App web que sugiere mejoras 1×1 ("quita X → mete Y") para mazos de Commander usando
recomendaciones de EDHREC, priorizando cartas de la colección del usuario (export de ManaBox).

@AGENTS.md

## Comandos

| Comando                                                                              | Qué hace                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `npm install`                                                                        | Instala dependencias y genera el cliente Prisma (`postinstall`)           |
| `cp .env.example .env`                                                               | Configuración local (nunca se sube `.env`)                                |
| `npm run db:migrate`                                                                 | Aplica/crea migraciones de Prisma sobre SQLite (`data/deck-doctor.db`)    |
| `npm run dev`                                                                        | Servidor de desarrollo                                                    |
| `npm test` / `npm run test:watch` / `npm run test:coverage`                          | Vitest                                                                    |
| `npm run typecheck`                                                                  | `next typegen` + `tsc --noEmit`                                           |
| `npm run lint`                                                                       | ESLint (incluye la regla de capas)                                        |
| `npm run format` / `format:check`                                                    | Prettier                                                                  |
| `npm run build`                                                                      | Build de producción                                                       |
| `npm run scryfall:sync [-- --force \| --skip-download]`                              | Descarga los bulk de Scryfall (si hay versión nueva) y los vuelca a la BD |
| `npm run collection:import -- "export.csv"`                                          | Importa un CSV de ManaBox y muestra el resumen                            |
| `npm run deck:check -- "lista.txt"`                                                  | Parsea y resuelve una lista de mazo contra el catálogo                    |
| `npm run edhrec:fetch -- "Comandante" [--theme x] [--partner "B"] [--save f.json]`   | Pide recomendaciones a EDHREC (con caché) y muestra un resumen            |
| `npm run deck:suggest -- "lista.txt" [--theme x] [--lock "Carta"] [--commander "C"]` | Analiza un mazo y muestra los cambios sugeridos                           |

Antes de cada commit: `npm run typecheck && npm run lint && npm run format:check && npm test`.

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
  `ownedQuantities` → `suggestSwaps` (dominio) + `manaCurve` + `validateDeck`.
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
  - `GET /api/status`, `POST /api/collection` (cuerpo = texto del CSV), `POST /api/analyze`
    (`{input, theme?, commanders?, locked?, excluded?}`, validado con zod).
  - Tipos y mapeadores de la API en `src/server/dto.ts` (los componentes solo hacen `import type`);
    errores → JSON `{error: {code, message}}` en `src/server/http.ts`.
  - Las rutas GET llaman a `await connection()` (better-sqlite3 es síncrono y si no, Next las
    prerenderiza). El container es un singleton (`getContainer`).
  - Estado del mazo (lista, tema, bloqueadas, descartadas) en `localStorage` del navegador.
    "Aplicar cambios y recalcular" reescribe la lista con `applySwaps` + `exportDecklist`
    (`domain/deck/export.ts`) y vuelve a analizar excluyendo las cartas descartadas.
- **Mazo**: `DeckSource.load` → `parseDecklist` → `resolveDecklist` (agrupa por oracleId, detecta
  comandante: marcado → único candidato o pareja válida → si no, `commanderCandidates` para que
  elija el usuario con `chooseCommanders`) → `validateDeck`.

## Decisiones

- **Identidad de carta = `oracle_id` de Scryfall.** Todas las impresiones cuentan como la misma carta.
  Cartas de dos caras / split: emparejar por nombre completo (`A // B`) y por nombre de la primera cara.
- **Scryfall**: fuente de verdad. Bulk `oracle_cards` + `default_cards` descargados a
  `SCRYFALL_DATA_DIR`, leídos en _streaming_ y volcados a SQLite solo con los campos necesarios.
  API solo cuando haga falta: User-Agent propio (`HTTP_USER_AGENT`) y ≥ 100 ms entre peticiones.
- **EDHREC**: sin API oficial. Solo `json.edhrec.com/pages/commanders/{slug}.json` y
  `/{slug}/{tema}.json`, todo detrás de `EdhrecClient` (adapters/edhrec): caché en BD (`HttpCache`,
  TTL `EDHREC_CACHE_TTL_HOURS`, 24 h), rate limit (`EDHREC_MIN_INTERVAL_MS`), User-Agent
  identificable, y validación con zod de la forma del JSON. Si la estructura cambia, solo se rompe el
  adaptador y devuelve un error tipado. **Si algo de EDHREC/Moxfield falla, avisar al usuario; no
  buscar formas de saltárselo.**
- **Colección ManaBox**: CSV con cabecera (ver abajo). Emparejar por `Scryfall ID`; si falta, por
  set + número de coleccionista; si no, por nombre. Lo no emparejado queda como `unmatched`.
- **Mazos**: interfaz `DeckSource`. MVP = texto pegado (`1 Sol Ring`, `1x Sol Ring (C21) 263`,
  secciones de comandante). Archidekt/Moxfield = adaptadores posteriores.
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
5. Después: Archidekt/Moxfield, copias usadas en otros mazos, modo "comprar N cartas baratas"
   (Cardmarket), app móvil.

Al terminar cada fase: parar y esperar el OK del usuario.
