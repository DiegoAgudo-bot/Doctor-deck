-- Índices para el contador de avisos sin leer y la actividad (intercambios y partidas por fecha).
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "TradeProposal_status_closedAt_idx" ON "TradeProposal"("status", "closedAt");
CREATE INDEX "Game_playedAt_idx" ON "Game"("playedAt");
