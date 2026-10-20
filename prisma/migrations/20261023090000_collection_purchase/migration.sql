-- AlterTable
ALTER TABLE "CollectionEntry" ADD COLUMN "addedOn" TEXT;
ALTER TABLE "CollectionEntry" ADD COLUMN "purchaseEur" REAL;

-- Lo que ya estaba importado: la fecha y el precio de compra salen de la fila original del CSV.
UPDATE "CollectionEntry"
SET "addedOn" = substr(json_extract("raw", '$.Added'), 1, 10)
WHERE json_valid("raw")
  AND json_extract("raw", '$.Added') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*';

UPDATE "CollectionEntry"
SET "purchaseEur" = round(CAST(replace(json_extract("raw", '$."Purchase price"'), ',', '.') AS REAL), 2)
WHERE json_valid("raw")
  AND upper(coalesce(json_extract("raw", '$."Purchase price currency"'), 'EUR')) IN ('EUR', '')
  AND CAST(replace(json_extract("raw", '$."Purchase price"'), ',', '.') AS REAL) > 0;
