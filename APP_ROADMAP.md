# App Android: lo que tiene la web y le falta a la app

Comparativa de la web (`src/`) con la app (`mobile/`), revisada el 7 de noviembre de 2026 (app
1.2.7). La app cubre bien el día a día: colección, escáner, buscar, mazos básicos, jugar, grupos,
intercambios, préstamos, comunidad, perfiles, comentarios, avisos con push y compartir desde otras
apps. Lo que falta es sobre todo **la parte de análisis y edición de mazos**, que es lo que
diferencia a Doctor Deck, y algo de colección (precios) y de cuenta.

**Casi todo tiene ya la API hecha** (la usa la web): son pantallas nativas, no trabajo de
servidor. La app usa unas 50 rutas; de las que existen, no usa estas: `/api/combos`,
`/api/decks/{id}/versions`, `/api/decks/{id}/card-roles`, `/api/me/card-roles`,
`/api/cards/{id}/printings`, `/api/cards/{id}/prices`, `/api/collection/prices`, `/api/commanders`,
`/api/me/prefs` y `/api/collection/cards/{id}` (y las de administración, que no hacen falta).

Reglas de siempre para cada fase: mismos textos y conceptos que la web (y sin nombres de otras
webs), tipos de `@/server/dto` y lógica pura de `src/domain` si hace falta, `cd mobile && npm run
typecheck && npm test` y `expo export` antes de cada commit, subir `VERSION` en `app.config.ts` y
**parar al terminar cada fase hasta el OK del usuario**.

## Resumen

| Fase  | Contenido                                                          | Esfuerzo | API nueva |
| ----- | ------------------------------------------------------------------ | -------- | --------- |
| M1 ✅ | Gestionar mazos: ajustes, historial, tema, candados, exportar      | Medio    | No        |
| M2 ✅ | Editor de mazos: añadir cartas, copias, edición, roles y etiquetas | Alto     | No        |
| M3 ✅ | Análisis: combos, mano inicial, alternativas y modo compra         | Medio    | No        |
| M4    | Precios: valor de la colección, lo que sube y baja, histórico      | Medio    | No        |
| M5    | Cuenta: contraseña, sesiones, avisos por tipo, preferencias        | Bajo     | No        |
| M6    | Inicio y buscador global                                           | Medio    | No        |

Orden recomendado: M1 → M2 → M3 (lo que más se echa en falta al usar la app de verdad), luego
M4, M5 y M6. M1 y M5 son rápidas y se pueden hacer antes si se quiere una mejora visible pronto.

---

## Fase M1 · Gestionar mazos ✅

Hecha en la app 1.3.0 (`components/deck-manage.tsx`).

**Ahora en la app**: la lista de mazos solo abre o crea. Dentro del mazo no se puede cambiar
nada que no sean las cartas.

- **Gestor de mazos** (`(tabs)/decks.tsx`, como «Mis mazos» de la web `saved-decks.tsx`):
  mantener pulsado un mazo (o un menú «⋯») → renombrar, duplicar (copia privada), cambiar la
  visibilidad (público / oculto / privado) y borrar con confirmación. API: `PATCH /api/decks/{id}`
  (`name`, `visibility`), `POST /api/decks` (duplicar), `DELETE /api/decks/{id}`.
- **Ajustes del mazo** (botón en la cabecera de `deck/[id].tsx`, como `DeckSettingsDialog`):
  nombre, visibilidad, duplicar, **reemplazar la lista** (pegar otra o un enlace) y borrar.
- **Historial de versiones**: cada versión con lo que entró y salió, y «Restaurar». API `GET
/api/decks/{id}/versions` y `POST /api/decks/{id}/versions/{versionId}`.
- **Tema de la comunidad**: elegir el tema (tribal, aristócratas…) en el mazo, que cambia los
  cambios sugeridos, y al crear un mazo desde un comandante (mazo medio o «con mis cartas» de un
  tema). Los temas vienen en el análisis (`edhrec.themes`) y en `GET /api/commanders?ids=`; se
  guarda con el mazo (como en la web, `analyze` con `persist`).
- **Bracket objetivo** editable (2–4) en «Datos»: ya se manda, falta poder cambiarlo (`PATCH
/api/decks/{id}` con `targetBracket`).
- **Candados**: bloquear una carta para que nunca se proponga sacarla (hoy se respetan los de la
  web, pero no se pueden poner desde la app).
- **Exportar** la lista en los formatos de la web (texto, Arena, MTGO, con etiquetas), con
  «Compartir» del sistema y copiar. `exportDeck` está en `src/domain/deck/export.ts` (puro: se
  puede usar desde la app).

**Hecho cuando**: todo lo de «Ajustes» del mazo de la web se puede hacer desde la app.

## Fase M2 · Editor de mazos ✅

Hecha en la app 1.4.0 (`components/deck-editor.tsx`).

**Ahora en la app**: se quitan cartas manteniéndolas pulsadas y se aplican los cambios
sugeridos; no se pueden añadir cartas sueltas ni tocar copias, ediciones o roles.

- **Añadir cartas** al mazo: buscador limitado a la identidad del comandante (`/api/cards?…` con
  los colores) y, arriba, «Recomendadas de tu colección» (las del análisis que tengo libres). API
  `PATCH /api/decks/{id}/cards` (`changes`).
- **Copias −/+** en cada carta, respetando `maxCopies` (básicas sin límite, «up to seven»…).
- **Edición de cada carta** del mazo (y foil): hoja con las impresiones y su precio (`GET
/api/cards/{id}/printings`), como `PrintingDialog`; reescribe la lista con `(SET) número`.
- **Corregir roles y etiquetas** de una carta (`RoleEditDialog`): roles, rol principal y
  etiquetas libres, «en todos mis mazos» (`PUT /api/me/card-roles/{id}`) o «solo en este mazo»
  (`PUT /api/decks/{id}/card-roles/{id}`). Enseñar de dónde sale el rol (`roleSource`).
- **Lista agrupada por rol** además de por tipo (selector), con los mínimos (36 tierras, 10
  ramp…) y cuántas cartas cumple cada uno.
- **«N en otros mazos»**: pulsar la cifra de la cabecera abre qué cartas y en qué mazos
  (`usedInDecks`), y la lista marca esas cartas.

**Hecho cuando**: se puede montar un mazo desde uno vacío solo con la app.

## Fase M3 · Análisis del mazo ✅

Hecha en la app 1.5.0 (`components/deck-analysis.tsx`). El histórico de precio al pulsar un precio
va con la gráfica de la fase M4.

**Ahora en la app**: pestañas Lista, Me falta, Cambios y Datos (curva, roles y bracket).

- **Pestaña Combos** (`POST /api/combos`, aparte del análisis porque tarda): combos completos,
  los que están a una carta (y si la tengo libre, en otros mazos o hay que comprarla, con
  precio), cartas clave, y el bracket recalculado con los combos en la cabecera.
- **Mano inicial** en «Datos»: probabilidades de 2–4 tierras, ramp y robo, y «Robar 7» con
  mulligan (`src/domain/deck/draw-odds.ts`, puro).
- **Detalle del bracket**: por qué (qué game changers, destrucción masiva, turnos extra, combos).
- **«Me falta» completo**: «Alternativas más baratas» de cada carta cara (`ownership.alternatives`,
  ya viene en el análisis), «Comprar ↗» por carta y el histórico de precio al pulsar el precio.
- **Modo compra**: «si compro N cartas baratas, ¿cuáles mejoran más el mazo?» con número de
  cartas, precio máximo y presupuesto (`POST /api/analyze` con `buy`).

**Hecho cuando**: el análisis de un mazo en la app enseña lo mismo que en la web.

## Fase M4 · Precios y colección

**Ahora en la app**: precio actual de cada copia y la variación desde que se añadió.

- **Pestaña o pantalla «Precios» de la colección** (`POST /api/collection/prices`): valor día a
  día (30 / 90 / 365 días) en una gráfica y lo que más sube y más baja de mis copias.
- **Histórico de precio de una carta** en su ficha (`GET /api/cards/{id}/prices?days=`), con la
  misma gráfica (`PriceChart` de la web como referencia).
- **Ediciones de una carta** en su ficha: la tabla de impresiones con precio normal y foil (hoy
  solo se ven al elegir con cuál añadir).
- **Reemplazar la colección con un CSV** desde la app enseñando el resumen como la web
  (identificadas, no encontradas y por qué).

**Hecho cuando**: alguien que solo usa la app sabe cuánto vale su colección y cómo va.

## Fase M5 · Cuenta y ajustes

**Ahora en la app**: perfil público, privacidad, avisos de precio, vincular Google, verificar el
email, bloqueados, exportar datos y borrar la cuenta.

- **Cambiar la contraseña** (`authClient.changePassword`, cerrando las demás sesiones).
- **Sesiones abiertas**: lista y cerrar una o todas las demás (`listSessions`).
- **Avisos por tipo** (`mutedNotifications`: seguidos, precios, intercambios, propuestas, grupos,
  comentarios, préstamos), que también silencian las push. `PATCH /api/me/profile`.
- **Preferencias compartidas con la web** (`GET|PUT /api/me/prefs`): orden, vista y filtros de la
  colección y del buscador, para que sean los mismos en el móvil y en el ordenador.
- (Opcional) **Tema claro**: la web tiene claro y oscuro; la app solo oscuro.

**Hecho cuando**: los ajustes de la app son los de la web.

## Fase M6 · Inicio y buscador global

**Ahora en la app**: se abre en la colección; «Buscar» solo busca cartas.

- **Inicio** (como el panel `home.tsx` de la web): resumen de la colección (copias y valor), mis
  mazos recientes, propuestas de intercambio pendientes y la actividad de la gente que sigo.
  Como primera pestaña o como pantalla al abrir.
- **Buscador global** en «Buscar»: además de cartas, mis mazos (por nombre o comandante) y gente
  (`GET /api/users?q=`), como el de la cabecera de la web.

**Hecho cuando**: la app tiene un punto de partida y se encuentra cualquier cosa desde un sitio.

---

## Lo que se queda solo en la web

- **Administración** (`/admin/errors`, `/admin/reports`): se modera desde el ordenador.
- **Usar sin cuenta** (analizar un mazo con la colección guardada en el navegador): en la app
  tiene poco sentido; para probar sin registrarse está la web.
- **Páginas legales**: la app las abre en el navegador del sistema (ya funciona así).

## Lo que la app tiene y la web no

El escáner de cartas, compartir listas y CSV desde otras apps, notificaciones push, la colección
sin conexión (caché en el móvil) y el contador de vidas con los asientos girados para jugar en la
mesa.
