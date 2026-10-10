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

| Fase | Contenido                                                     | Esfuerzo | Estado |
| ---- | ------------------------------------------------------------- | -------- | ------ |
| 10   | Crear mazos (comandante, mazo medio, desde cero) y gestor     | Bajo     | ✅     |
| 11   | Exportar Arena/MTGO, mazos ocultos, manos de muestra, precios | Bajo     | ✅     |
| 12   | Bracket y game changers                                       | Bajo     | ✅     |
| 13   | Comunidad: mazos que puedes montar ya, me gusta, filtros      | Medio    |        |
| 14   | Precios: histórico, lo que más sube, avisos de bajada         | Medio    |        |
| 15   | Etiquetas propias que corrigen los roles                      | Medio    |        |
| 16   | Combos (Commander Spellbook) y bracket con combos             | Medio    |        |
| 17   | Listas de deseos e intercambio con cruce automático           | Medio    |        |
| 18   | Impresiones concretas (edición, foil, idioma)                 | Alto     |        |
| 19   | Calculadora de intercambio entre dos usuarios                 | Medio    |        |
| 20   | App móvil: compartir desde ManaBox y escáner                  | Alto     |        |

---

## Fase 10 · Crear mazos ✅

Hecha. El asistente `/mazos/nuevo` crea el mazo desde el comandante, con el mazo medio de EDHREC
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

## Fase 13 · Comunidad útil

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

## Fase 14 · Precios

**Objetivo:** sacar partido del histórico que se empezó a guardar en la fase 11.

- **Histórico de una carta:** una gráfica de 30, 90 y 365 días al pasar o pulsar sobre la carta.
- **"Lo que más sube" de tu colección** y el valor de tu colección en el tiempo.
- **Avisos de bajada de precio** (idea 5). Si una carta de "Qué me falta" de alguno de tus mazos
  baja un X % o por debajo de un umbral, recibes un aviso en la campana, con el mismo sistema de
  `Notification`. El umbral se configura en `/ajustes`.

**Hecho cuando:** los avisos llegan como mucho una vez por carta y semana, y hay tests con
históricos inventados.

## Fase 15 · Etiquetas propias

**Objetivo:** que el usuario corrija al clasificador de roles cuando falla, lo que también mejora
los cambios propuestos.

- Por carta y usuario (opcionalmente por mazo), "esta carta es ramp / no es removal" y etiquetas
  libres ("wincon", "sinergia de tesoros").
- El motor usa los roles corregidos para los mínimos y para el bonus de rol.
- Se leen y escriben las etiquetas `#!Ramp` de Moxfield al importar y exportar (el parser ya las
  reconoce).
- **Opcional:** usar las etiquetas `otag:` de Scryfall como segunda fuente de roles (ya está
  previsto en `CLAUDE.md`).

## Fase 16 · Combos

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

## Fase 17 · Listas de deseos e intercambio

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

## Fase 18 · Impresiones concretas

**Objetivo:** precio exacto y base para los intercambios. Hoy todo va por `oracleId`.

- `CollectionEntry` guarda la impresión, el foil y el idioma (el CSV de ManaBox ya trae el
  `Scryfall ID` de cada copia).
- En los mazos se puede elegir la impresión de cada carta y se usa su imagen; si no se elige, se
  usa la más barata, como ahora.
- El valor de la colección y el histórico de precios pasan a calcularse por impresión. El
  histórico pasa de `oracleId` a `scryfallId` con una migración.
- El motor sigue trabajando por `oracleId`: la impresión es solo presentación y precio.

## Fase 19 · Calculadora de intercambio

- Sobre las fases 17 y 18: eliges a otro usuario, se proponen cartas de su lista "para cambiar"
  que están en tu lista de deseos y viceversa, y se cuadra el valor por los precios de cada
  impresión.
- Se puede guardar como borrador y compartir el enlace. No hay pagos ni transacciones en la app.

## Fase 20 · App móvil

El requisito ya fijado en `CLAUDE.md` se mantiene: la app debe ser destino al **compartir desde
ManaBox** (CSV o texto) y usar la misma API, con el plugin `bearer` de Better Auth.

- **Primer paso:** compartir e importar, consultar mazos y colección, y los avisos (con
  notificaciones push, aquí sí).
- **Segundo paso:** el escáner de cartas. El endpoint `POST /api/collection/cards` con `scryfallId`
  ya está listo.

---

## Descartado o aplazado (y por qué)

- **Playtester completo** (partida de prueba con zonas): Moxfield y Archidekt ya lo hacen muy bien
  y no nos diferencia. Nos quedamos con las manos de muestra y las probabilidades de la fase 11.
- **Comprar directamente en una tienda** (como Moxfield con Mana Pool): Cardmarket no tiene una API
  pública para meter cosas en el carrito. Se mantiene la lista para Wants y los enlaces. Se
  reevaluaría si alguna tienda europea ofrece integración.
- **Comentarios y mensajes privados:** exigen moderación y denuncias. Se valorará si la comunidad
  crece.
- **Binders** (carpetas de la colección): con los filtros, la lista de deseos y la de intercambio
  cubrimos casi todo su uso. Se añadirían como etiquetas de colección si alguien los pide.
