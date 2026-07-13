-- Evita créditos duplicados por reintentos de webhooks (p.ej. Stripe entregando
-- el mismo evento dos veces): la unicidad se aplica en la base de datos, no solo
-- en el chequeo previo de la aplicación, que por sí solo no cierra la condición
-- de carrera entre dos transacciones concurrentes.
-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_userId_reason_refId_key" ON "CreditLedger"("userId", "reason", "refId");
