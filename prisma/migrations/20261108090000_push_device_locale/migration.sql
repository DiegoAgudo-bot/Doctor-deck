-- Idioma del móvil para las notificaciones push.
ALTER TABLE "PushDevice" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'es';
