-- Descripción pública del mazo y notas privadas por carta (JSON: oracleId → texto).
ALTER TABLE "Deck" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deck" ADD COLUMN "cardNotes" TEXT NOT NULL DEFAULT '{}';
