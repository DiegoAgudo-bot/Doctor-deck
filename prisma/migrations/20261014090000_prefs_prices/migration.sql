-- AlterTable
ALTER TABLE "OracleCard" ADD COLUMN "minPriceEur" REAL;

-- CreateTable
CREATE TABLE "UserPref" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "key"),
    CONSTRAINT "UserPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OracleCard_minPriceEur_idx" ON "OracleCard"("minPriceEur");


-- Rellena el precio mínimo con lo que ya hay (después lo mantiene `insertPrintings`).
UPDATE "OracleCard" SET "minPriceEur" = (
    SELECT MIN("priceEur") FROM "Printing" WHERE "Printing"."oracleId" = "OracleCard"."oracleId"
);
