-- AlterTable
ALTER TABLE "OracleCard" ADD COLUMN "colors" TEXT;
ALTER TABLE "OracleCard" ADD COLUMN "power" TEXT;
ALTER TABLE "OracleCard" ADD COLUMN "toughness" TEXT;
ALTER TABLE "OracleCard" ADD COLUMN "loyalty" TEXT;
ALTER TABLE "OracleCard" ADD COLUMN "powerValue" REAL;
ALTER TABLE "OracleCard" ADD COLUMN "toughnessValue" REAL;

-- AlterTable
ALTER TABLE "Printing" ADD COLUMN "rarity" TEXT;
ALTER TABLE "Printing" ADD COLUMN "artist" TEXT;
