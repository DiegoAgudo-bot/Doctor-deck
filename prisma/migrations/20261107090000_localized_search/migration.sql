-- Texto de búsqueda en otros idiomas, en la propia carta: buscar es un LIKE sobre OracleCard en
-- vez de sacar ids de CardLocalization (con miles de coincidencias, pasaban el límite de
-- parámetros de SQLite y la búsqueda fallaba). Lo rellenan insertCards y replaceLocalizations.
ALTER TABLE "OracleCard" ADD COLUMN "localNames" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OracleCard" ADD COLUMN "localTypes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OracleCard" ADD COLUMN "localText" TEXT NOT NULL DEFAULT '';

UPDATE "OracleCard" SET
  "localNames" = COALESCE((SELECT ' ' || group_concat(l."nameKey", ' ') FROM "CardLocalization" l WHERE l."oracleId" = "OracleCard"."oracleId"), ''),
  "localTypes" = COALESCE((SELECT group_concat(l."typeLine", ' | ') FROM "CardLocalization" l WHERE l."oracleId" = "OracleCard"."oracleId"), ''),
  "localText" = COALESCE((SELECT group_concat(l."text", ' | ') FROM "CardLocalization" l WHERE l."oracleId" = "OracleCard"."oracleId"), '');
