-- CreateTable
CREATE TABLE "CardRoleOverride" (
    "userId" TEXT NOT NULL,
    "oracleId" TEXT NOT NULL,
    "roles" TEXT NOT NULL DEFAULT '[]',
    "primary" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "oracleId"),
    CONSTRAINT "CardRoleOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

