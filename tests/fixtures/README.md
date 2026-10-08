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
