-- AlterTable
ALTER TABLE "CollectionEntry" ADD COLUMN "language" TEXT;

-- Las filas importadas antes ya traían el idioma en el CSV original (columna "Language").
UPDATE "CollectionEntry"
SET "language" = lower(trim(json_extract("raw", '$.Language')))
WHERE "raw" LIKE '{%' AND json_valid("raw") AND trim(coalesce(json_extract("raw", '$.Language'), '')) <> '';
