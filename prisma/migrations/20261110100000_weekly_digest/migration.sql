-- Resumen semanal por correo (hay que activarlo) y cuándo se mandó el último.
ALTER TABLE "user" ADD COLUMN "weeklyDigest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN "digestSentAt" DATETIME;
