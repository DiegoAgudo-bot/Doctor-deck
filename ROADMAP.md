# Hoja de ruta

Plan por fases para cubrir el análisis de la competencia (Moxfield, Archidekt, EDHREC, ManaBox,
Dragon Shield, Commander Spellbook). Sigue la numeración de `CLAUDE.md` (fases 0–9 hechas).

**Criterio de orden:** primero lo que refuerza lo que nos diferencia (**colección + EDHREC + tus
otros mazos**), después lo que cierra huecos frente a la competencia. Lo que necesita datos
acumulados (precios) empieza a recogerlos cuanto antes, aunque su pantalla llegue más tarde.

Cada fase sigue las reglas de siempre: dominio puro con tests, servicios externos detrás de un
adaptador con caché y errores tipados (si fallan, se avisa al usuario), checks antes de cada commit,
despliegue en `main` y **parar al terminar cada fase hasta el OK del usuario**.

## Resumen

| Fase | Contenido                                                     | Esfuerzo | Estado           |
| ---- | ------------------------------------------------------------- | -------- | ---------------- |
| 10   | Crear mazos (comandante, mazo medio, desde cero) y gestor     | Bajo     | ✅               |
| 11   | Exportar Arena/MTGO, mazos ocultos, manos de muestra, precios | Bajo     | ✅               |
| 12   | Bracket y game changers                                       | Bajo     | ✅               |
| 13   | Comunidad: mazos que puedes montar ya, me gusta, filtros      | Medio    | ✅               |
| 14   | Precios: histórico, lo que más sube, avisos de bajada         | Medio    | ✅               |
| 15   | Etiquetas propias que corrigen los roles                      | Medio    | ✅               |
| 16   | Combos (Commander Spellbook) y bracket con combos             | Medio    | ✅               |
| 17   | Listas de deseos e intercambio con cruce automático           | Medio    | ✅               |
| 18   | Impresiones concretas (edición, foil, idioma)                 | Alto     | ✅               |
| 19   | Calculadora de intercambio entre dos usuarios                 | Medio    | ✅               |
| 20   | Cimientos: copias, colección sin ManaBox, legal, compartir    | Medio    | ✅               |
| 21   | Social: grupos, partidas, préstamos, feed y comentarios       | Alto     | ✅               |
| 22   | App móvil: compartir desde ManaBox, escáner y push            | Alto     | ✅ (sin escáner) |

---

## Fase 10 · Crear mazos ✅

Hecha. El asistente `/decks/new` crea el mazo desde el comandante, con el mazo medio de EDHREC
(general o de un tema) o vacío. El nombre se propone solo ("Jund - Aristócratas"). El mazo se edita
en la pestaña Lista y "Mis mazos" hace de gestor (renombrar, duplicar, visibilidad, borrar).
Cubre la idea 2 del análisis.

## Fase 11 · Huecos básicos rápidos ✅

**Objetivo:** que nadie eche de menos nada básico al venir de Moxfield o Archidekt.

- **Exportar a Arena y MTGO.**
  - Hoy solo hay texto genérico.
  - `domain/deck/export.ts` ganará formatos `arena` (`1 Sol Ring (C21) 263`, secciones
    `Commander`/`Deck`), `mtgo` (`.dek`/texto con `SB:` para el comandante) y `moxfield` (texto con
    `*CMDR*`).
  - En la UI, un selector de formato en Exportar, con botones para copiar y descargar.
- **Mazos ocultos** (solo con el enlace).
  - `Deck.isPublic` pasa a `visibility: public | unlisted | private`, con una migración que
    conserva los valores actuales.
  - Un mazo oculto no sale en el perfil, en Comunidad ni en los avisos, pero se abre con su URL
    `/decks/{uuid}`.
  - El interruptor de la UI pasa a ser un selector de tres opciones.
- **Manos de muestra y probabilidades.**
  - En el dominio, cálculo puro (hipergeométrica): la probabilidad de 2–4 tierras en la mano
    inicial, de tener jugada en el turno 2 o 3 y de robar al menos una carta de ramp antes del
    turno 3.
  - Botón "Robar 7" (y mulligan) con las imágenes.
  - No es un playtester completo: eso no nos diferencia (ver "Descartado").
- **Empezar a guardar precios.**
  - Nueva tabla `PriceSnapshot` (`oracleId`, fecha, `eur`), que rellena el `scryfall:sync`
    nocturno.
  - Solo guarda las cartas que alguien tiene en su colección, en un mazo o (más adelante) en una
    lista de deseos, para no llenar la BD con ~30 000 filas al día.
  - Todavía no hay pantalla: así, cuando llegue la fase 14, ya habrá semanas de histórico.

**Hecho cuando:** un mazo exportado se importa sin errores en Arena y en Moxfield; un mazo oculto
no aparece en ningún listado; la probabilidad está probada contra valores conocidos.

## Fase 12 · Bracket y game changers ✅

**Objetivo:** decir en qué bracket está un mazo (1–5) y por qué, que es lo que más se pregunta
desde que existen los brackets.

- **Game changers.**
  - Scryfall ya trae el campo `game_changer` en sus cartas (comprobado en el bulk).
  - Se mapea en `Card` y se guarda en la BD, de modo que el sync nocturno lo mantiene al día sin
    listas escritas a mano.
- **Estimador de bracket** en `domain/deck/bracket.ts`, con reglas explicadas que siguen el
  documento de brackets de WotC:
  - número de game changers;
  - tutores (ya los detecta el clasificador de roles);
  - destrucción masiva de tierras;
  - turnos extra en cadena;
  - combos de dos cartas tempranos (en la fase 16; hasta entonces se marca "sin comprobar
    combos").
- **UI.**
  - Una pastilla "Bracket 3" en la cabecera del mazo, con su desglose ("2 game changers: Rhystic
    Study, Smothering Tithe").
  - Las game changers se marcan en la lista.
- **Opcional:** un bracket objetivo por mazo, de modo que el motor no proponga meter game changers
  si eso sube el bracket.

**Hecho cuando:** los tests cubren un mazo de cada bracket y el motor respeta el bracket objetivo.

## Fase 13 · Comunidad útil ✅

**Objetivo:** que la parte social sirva para jugar, no solo para mirar.

- **Mazos que puedes montar ya** (idea 1, la más diferencial).
  - En Comunidad y en los perfiles, cada mazo público muestra el porcentaje que ya tienes (y
    cuánto costaría el resto). Se puede ordenar por "lo que más tengo".
  - Se calcula con `deckOwnership` para muchos mazos a la vez: hay que precalcular un resumen
    ligero por mazo (las cartas por `oracleId`) para no resolver 100 mazos en cada petición.
- **Filtros en Comunidad:** comandante, colores, bracket (de la fase 12) y "solo de gente que
  sigo".
- **"Me gusta" en los mazos**, con un contador y el orden "más gustados". Sin comentarios por
  ahora: exigen moderación. Se podrían añadir más adelante si hay comunidad.

**Hecho cuando:** Comunidad responde en menos de 1 s con 500 mazos públicos y el porcentaje
coincide con el de la pestaña "Qué me falta".

## Fase 14 · Precios ✅

**Objetivo:** sacar partido del histórico que se empezó a guardar en la fase 11.

- **Histórico de una carta:** una gráfica de 30, 90 y 365 días al pasar o pulsar sobre la carta.
- **"Lo que más sube" de tu colección** y el valor de tu colección en el tiempo.
- **Avisos de bajada de precio** (idea 5). Si una carta de "Qué me falta" de alguno de tus mazos
  baja un X % o por debajo de un umbral, recibes un aviso en la campana, con el mismo sistema de
  `Notification`. El umbral se configura en `/settings`.

**Hecho cuando:** los avisos llegan como mucho una vez por carta y semana, y hay tests con
históricos inventados.

## Fase 15 · Etiquetas propias ✅

**Objetivo:** que el usuario corrija al clasificador de roles cuando falla, lo que también mejora
los cambios propuestos.

- Por carta y usuario (opcionalmente por mazo), "esta carta es ramp / no es removal" y etiquetas
  libres ("wincon", "sinergia de tesoros").
- El motor usa los roles corregidos para los mínimos y para el bonus de rol.
- Se leen y escriben las etiquetas `#!Ramp` de Moxfield al importar y exportar (el parser ya las
  reconoce).
- ✅ (después) Corrección de roles solo para un mazo (tabla `DeckRoleOverride`), que manda sobre
  las de todos mis mazos.
- ✅ (después) Las etiquetas `otag:` de Scryfall Tagger como segunda fuente de roles
  (`npm run otags:sync`; los nombres de las etiquetas están pendientes de verificar contra
  Scryfall real).

## Fase 16 · Combos ✅

**Objetivo:** mostrar qué combos tiene el mazo, cuáles están a una carta y, sobre todo, **cuáles
completas con tu colección** (nadie más lo hace).

- **Adaptador de Commander Spellbook** detrás de un puerto `ComboSource`, con las mismas reglas que
  EDHREC: caché en `HttpCache`, rate limit, zod y errores tipados. Su API no está documentada
  oficialmente: si cambia, se rompe solo el adaptador y se avisa.
- **Pestaña "Combos":**
  - los que ya están en el mazo;
  - los que están a una carta y la tienes libre;
  - los que están a una carta y la tendrías que comprar (con su precio).
- **El bracket de la fase 12** pasa a tener en cuenta los combos tempranos.

## Fase 17 · Listas de deseos e intercambio ✅

**Objetivo:** el paso grande de la comunidad: "@ana tiene libre la Mana Crypt que te falta".

- **Lista de deseos:**
  - se rellena sola con lo que falta en los mazos que elijas;
  - también admite cartas sueltas.
- **Para cambiar:**
  - sale sola de las copias libres (las que tienes menos las que usas en tus mazos);
  - también se pueden marcar cartas a mano.
- **Visibilidad:** ambas listas son públicas solo si lo eliges (como la colección).
- **Cruce automático:**
  - en tu perfil y en Comunidad, quién de la gente que sigues (o de los perfiles públicos) tiene lo
    que buscas y busca lo que tienes;
  - un aviso cuando aparece un cruce nuevo.
- **Sin pagos ni mensajería** dentro de la app: se enlaza al perfil y cada uno se contacta por
  fuera. Un sistema de mensajes privados sería otra fase con moderación.

## Fase 18 · Impresiones concretas ✅

**Objetivo:** precio exacto y base para los intercambios. Hoy todo va por `oracleId`.

- `CollectionEntry` guarda la impresión, el foil y el idioma (el CSV de ManaBox ya trae el
  `Scryfall ID` de cada copia).
- En los mazos se puede elegir la impresión de cada carta y se usa su imagen; si no se elige, se
  usa la más barata, como ahora.
- El valor de la colección y el histórico de precios pasan a calcularse por impresión. El
  histórico pasa de `oracleId` a `scryfallId` con una migración.
- El motor sigue trabajando por `oracleId`: la impresión es solo presentación y precio.
- ✅ (después) El idioma de cada copia (`CollectionEntry.language`), con filtro en la colección.

## Fase 19 · Calculadora de intercambio ✅

Hecha con estas decisiones del usuario: tolerancia del 5 % o 1 €; precio de Cardmarket vía
Scryfall según la copia (normal o foil); se puede **contraproponer** (versiones de la misma
propuesta, con el turno pasando de uno a otro); y al **aceptar se mueven las cartas** entre las dos
colecciones de Doctor Deck (la idea es dejar de usar ManaBox). Detalles en `CLAUDE.md`. El plan con
el que se empezó:

**Objetivo:** con otro usuario, una propuesta de intercambio cuadrada por valor que se pueda
guardar, retocar y compartir. Sin pagos ni transacciones en la app.

**Punto de partida (ya hecho):** `tradeMatches` (fase 17) ya cruza mi lista de deseos con su
"para cambiar" y al revés, pero por carta (`oracleId`) y con el precio de la impresión más
barata. La fase 18 dejó en cada copia de la colección su impresión, foil e idioma, y
`printingPrice(p, foil)` da el precio de una copia.

**Plan:**

1. **Dominio** (`domain/trades/proposal.ts`, puro y con tests):
   - "Para cambiar" por copias: `buildTradeCopies` parte de las líneas de la colección (impresión,
     foil, idioma) y descuenta las usadas en mis mazos (primero las de la impresión elegida en el
     mazo, `DeckCard.scryfallId`; después las más baratas, para ofrecer las de más valor).
   - `proposeTrade(mine, theirs, prices)`: lo que me da (su "para cambiar" ∩ mi lista de deseos) y
     lo que le doy (al revés), cada copia con su precio exacto.
   - `balanceTrade`: si un lado vale más, quita copias de ese lado (de la más cara a la más
     barata, sin pasarse) hasta que la diferencia quede dentro de la tolerancia; devuelve la
     diferencia que queda para que la cuadren a mano.
2. **BD**: `TradeProposal` (`publicId` uuid, `fromUserId`, `toUserId`, `status` `draft` |
   `shared`, fechas) y `TradeProposalItem` (`side` `give` | `get`, `oracleId`, `scryfallId`,
   `foil`, `language`, `quantity` y el precio unitario del momento, para que el borrador no cambie
   solo).
3. **API**: `GET /api/trades/calculator?username=` (propuesta inicial ya cuadrada);
   `POST /api/trades/proposals` (guardar borrador); `GET|PATCH|DELETE /api/trades/proposals/{id}`
   (retocar copias o compartir). Una propuesta compartida la ven solo los dos usuarios.
4. **UI**: `/trades/{username}` con dos columnas (doy / recibo), −/+ por copia, añadir
   cualquier carta de su "para cambiar" aunque no esté en mi lista de deseos, barra de balance y
   botones guardar / compartir. Botón "Proponer intercambio" en cada cruce de `/trades` y
   en el perfil.
5. **Avisos**: una `Notification` `trade_proposal` al otro usuario cuando se comparte.

**Decisiones para el usuario antes de empezar:**

- Tolerancia del cuadre (propuesta: 5 % del total o 1 €, lo que sea mayor).
- Precio de referencia: tendencia de Cardmarket vía Scryfall, normal o foil según la copia (como
  el valor de la colección).
- ¿Puede el otro usuario contestar con una contrapropuesta (otra versión del mismo borrador) o
  basta con compartir y hablar por fuera?
- ¿Al marcar un intercambio como hecho se mueven las cartas entre las dos colecciones, o eso queda
  fuera (cada uno actualiza su ManaBox)? La propuesta inicial es dejarlo fuera.

**Hecho cuando:** la propuesta inicial coincide con los cruces de `/trades`, el balance
está probado con casos inventados (foil, varias impresiones, copias en mazos) y un borrador
compartido se abre con su enlace solo para los dos usuarios.

## Fase 20 · Cimientos ✅

Salió de la auditoría frente a la competencia (antes de la app móvil, que debe llegar cuando todo
lo demás esté bien):

- **Copias de seguridad** diarias de la SQLite (`npm run db:backup`, cron que instala
  `deploy.sh`, 14 días). Falta copiarlas fuera del VPS (ver `DEPLOY.md`).
- **Colección sin ManaBox**: editar cualquier copia (cantidad, edición, foil, idioma y estado),
  borrarla y exportar la colección en el CSV de ManaBox.
- **Legal y RGPD**: `/privacy`, `/legal` (con el aviso de la Fan Content Policy), descargar todos
  mis datos y borrar la cuenta.
- **Compartir**: título, descripción e imagen generada (arte del comandante) para mazos y
  perfiles; `robots.txt` y `sitemap.xml`.
- **Visual**: portada nueva, ficha de carta en la colección, cabecera del mazo con el arte,
  filtros plegables y arreglos en el móvil, PWA instalable con iconos.

**Pendiente del usuario** (no se puede hacer desde el código): dominio propio, SMTP para los
emails, `LEGAL_OWNER`/`LEGAL_EMAIL` en el `.env` del VPS y copias fuera del servidor.

## Fase 21 · Social ✅

Lo que convierte Doctor Deck en la red social de los jugadores de Commander (detalles en
`CLAUDE.md`):

- **Grupos de juego** (`/groups`): se entra con un enlace de invitación; los miembros ven los
  mazos públicos y ocultos de los demás, buscan "¿quién del grupo tiene…?" y ven qué les falta
  que alguien del grupo tiene libre ("Te lo pueden dejar"). Como mucho 50 miembros.
- **Partidas**: contador de vidas a pantalla completa (`/play`: 2–6 jugadores, daño de
  comandante, veneno, turnos, revancha, la pantalla no se apaga) y registrar la partida (quién
  jugó, con qué mazo y quién ganó). Clasificación del grupo por jugador y por mazo con podio y
  rachas, partidas del mazo en su página y victorias en el perfil.
- **Préstamos** (`/loans`): a un usuario o a alguien sin cuenta; la carta sigue siendo tuya pero
  cuenta como ocupada (motor, "para cambiar", otros mazos) hasta que se devuelve.
- **Feed** (`/feed` y en la portada): mazos publicados, partidas, comentarios, "me gusta" e
  intercambios de la gente que sigues y de tus grupos.
- **Comentarios** en los mazos públicos y ocultos, con **moderación**: bloquear (rompe el
  seguimiento y corta comentarios, intercambios y préstamos), denunciar (con 3 denuncias se oculta
  hasta revisarlo en `/admin/reports`, `ADMIN_EMAILS`), el dueño borra y puede cerrarlos, 15 s
  entre comentarios y 2 enlaces como mucho.

## Fase 22 · App móvil

El requisito ya fijado en `CLAUDE.md` se mantiene: la app debe ser destino al **compartir desde
ManaBox** (CSV o texto) y usar la misma API, con el plugin `bearer` de Better Auth.

- **Primer paso ✅:** app Android nativa (Expo) con la estructura de ManaBox: colección, mazos,
  buscador, ficha de carta, avisos con notificaciones push y compartir desde ManaBox (CSV o
  texto). Lo demás (intercambios, grupos, préstamos, contador) se abre de la web dentro de la app.
  Ver `mobile/README.md`.
- **Segundo paso (v2):** el escáner de cartas. El endpoint `POST /api/collection/cards` con `scryfallId`
  ya está listo, y las copias se pueden editar después (`PATCH /api/collection/lines/{id}`).

---

## Plan de UX (fases U1–U10)

Sale de la auditoría UX/CRO y del recorrido pantalla a pantalla (octubre de 2026). El problema
principal: **carta, colección y mazo apenas se conectan** (no se puede añadir una carta a un mazo
desde la colección ni crear un mazo desde ella), los cambios aplicados en un mazo guardado no se
guardan solos y hay botones y entradas de menú repetidos. El usuario pidió aplicarlas seguidas: una
PR por fase, que se mergea cuando el CI está en verde.

| Fase | Contenido                                                                           | Esfuerzo   | Estado |
| ---- | ----------------------------------------------------------------------------------- | ---------- | ------ |
| U1   | Limpieza: navegación sin duplicados, portada, cabecera del mazo y textos de botones | Bajo       | ✅     |
| U2   | Los mazos guardados se guardan solos (cambios aplicados, tema, candados, descartes) | Medio      | ✅     |
| U3   | Ajustes del mazo en su página (nombre, visibilidad, duplicar, reemplazar, borrar)   | Bajo-medio | ✅     |
| U4   | Colección y cartas → mazos: «Añadir a un mazo», «Crear mazo», comandantes que tengo | Medio      | ✅     |
| U5   | Un único «Nuevo mazo» (comandante o lista/enlace, siempre se guarda)                | Medio      | ✅     |
| U6   | Barra inferior del móvil con Mazos y «Más»                                          | Medio      |        |
| U7   | Registro sin fricción y sin perder lo hecho antes de tener cuenta                   | Medio      |        |
| U8   | Portada pintada en el servidor, mazos reales de la comunidad y preguntas frecuentes | Medio      |        |
| U9   | Crear un mazo «Con mis cartas» (recomendadas de EDHREC que tengo libres)            | Alto       |        |
| U10  | Barra de acción fija en el mazo (móvil) y letra más legible en el móvil             | Bajo       |        |

Ya hecho antes de este plan (PR #20): mazo de ejemplo, aviso de colección encima del analizador,
un solo CTA primario en la portada, zonas táctiles y campos de 16 px, contraste y foco.

---

## Descartado o aplazado (y por qué)

- **Playtester completo** (partida de prueba con zonas): Moxfield y Archidekt ya lo hacen muy bien
  y no nos diferencia. Nos quedamos con las manos de muestra y las probabilidades de la fase 11.
- **Comprar directamente en una tienda** (como Moxfield con Mana Pool): Cardmarket no tiene una API
  pública para meter cosas en el carrito. Se mantiene la lista para Wants y los enlaces. Se
  reevaluaría si alguna tienda europea ofrece integración.
- **Mensajes privados:** exigen más moderación que los comentarios públicos. Se valorará si la
  comunidad crece (los comentarios en mazos ya están, fase 21).
- **Binders** (carpetas de la colección): con los filtros, la lista de deseos y la de intercambio
  cubrimos casi todo su uso. Se añadirían como etiquetas de colección si alguien los pide.
