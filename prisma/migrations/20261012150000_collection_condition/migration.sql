-- AlterTable
ALTER TABLE "CollectionEntry" ADD COLUMN "condition" TEXT;


-- Las filas importadas antes ya traían el estado en el CSV original (columna "Condition").
UPDATE "CollectionEntry"
SET "condition" = lower(trim(json_extract("raw", '$.Condition')))
WHERE "raw" LIKE '{%' AND json_valid("raw") AND trim(coalesce(json_extract("raw", '$.Condition'), '')) <> '';
