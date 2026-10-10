# Fixtures

- `manabox_sample.csv`: 16 filas reales recortadas de `jj one.csv` (export de ManaBox).
- `scryfall/oracle_cards.sample.json` y `scryfall/default_cards.sample.json`: objetos con la forma
  de los bulk data de Scryfall, **escritos a mano** (el entorno de desarrollo no tenía acceso a
  Scryfall). Los Scryfall ID de las cartas del CSV son los reales; los `oracle_id` son sintéticos
  (`00000000-0000-4000-8000-…`) y los textos pueden estar abreviados. Casos especiales:
  - _Lantern Flare_: el Scryfall ID del CSV no existe en el fixture, pero sí otra impresión con el
    mismo set + número → se empareja por set/número.
  - _Relm's Sketching_: sin impresiones en `default_cards` → se empareja por nombre.
  - _Zndrsplt_: `reversible_card` sin `oracle_id` en la raíz (está en las caras).
  - Token llamado _Sol Ring_: no debe ganar a la carta jugable al buscar por nombre.
  - _Mana Crypt_: prohibida en Commander.
- `edhrec/*.json`: páginas con la forma de `json.edhrec.com/pages/commanders/{slug}.json`,
  **escritas a mano** (sin acceso a EDHREC desde el entorno de desarrollo). Comandante: _Teferi,
  Temporal Archmage_ (está en el catálogo de prueba). Incluyen cartas repetidas en varias listas,
  una sin contadores (inclusión desde la etiqueta), una sin synergy, una de dos caras y una que no
  está en el catálogo (_Reliquary Tower_). `redirect.json` y `changed-format.json` cubren la
  redirección y un cambio de estructura. Para sustituirlas por datos reales:
  `npm run edhrec:fetch -- "Teferi, Temporal Archmage" --save tests/fixtures/edhrec/real.json`.
- `edhrec/average-deck-winota.json`: mazo medio **real** de `json.edhrec.com/pages/average-decks/
winota-joiner-of-forces.json` (descargado el 2026-10-09, recortado a `header` y `deck`), para
  comprobar el parser contra la estructura de verdad.
- `edhrec/average-deck-teferi.json`: mazo medio **escrito a mano** con cartas del catálogo de prueba
  (incluye al comandante dentro de las cartas, 30 Island y una carta fuera del catálogo).
- `deck-sources/*.json`: respuestas de Archidekt (`/api/decks/{id}/`) y Moxfield (v3 y v2),
  **escritas a mano** con cartas del catálogo de prueba (Teferi + Sol Ring, Dig Through Time,
  Island; Body of Knowledge en maybeboard/sideboard).
- `spellbook/find-my-combos-jund.json`: respuesta **real** de `POST
backend.commanderspellbook.com/find-my-combos` para un Korvold Jund de 100 cartas (descargada el
  2026-10-11), recortada a 6 combos completos, 8 a una carta y 2 "añadiendo colores", y sin las
  URL de imágenes ni los campos que no usamos.
