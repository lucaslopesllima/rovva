-- 086 Importação de histórico (PDF da representada): nº do pedido no sistema
-- da representada. Único por org+representada — reimportar o mesmo relatório
-- pula o que já entrou em vez de duplicar.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS numero_externo text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_numero_externo_uq
  ON orders (org_id, represented_id, numero_externo) WHERE numero_externo IS NOT NULL;
