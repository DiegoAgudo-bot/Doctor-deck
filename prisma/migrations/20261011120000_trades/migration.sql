-- CreateTable
CREATE TABLE "WishlistItem" (
    "userId" TEXT NOT NULL,
    "oracleId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "oracleId"),
    CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TradeKeep" (
    "userId" TEXT NOT NULL,
    "oracleId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "oracleId"),
    CONSTRAINT "TradeKeep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable (columnas con valor por defecto: no hace falta reconstruir las tablas)
ALTER TABLE "Deck" ADD COLUMN "inWishlist" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "tradesPublic" BOOLEAN NOT NULL DEFAULT false;
