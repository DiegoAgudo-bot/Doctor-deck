-- AlterTable
ALTER TABLE "DeckCard" ADD COLUMN "scryfallId" TEXT;

-- AlterTable
ALTER TABLE "Printing" ADD COLUMN "priceEurFoil" REAL;
ALTER TABLE "Printing" ADD COLUMN "releasedAt" TEXT;
ALTER TABLE "Printing" ADD COLUMN "setName" TEXT;

-- CreateTable
CREATE TABLE "PrintingPriceSnapshot" (
    "scryfallId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "eur" REAL,
    "eurFoil" REAL,

    PRIMARY KEY ("scryfallId", "date")
);

-- CreateIndex
CREATE INDEX "PrintingPriceSnapshot_date_idx" ON "PrintingPriceSnapshot"("date");

