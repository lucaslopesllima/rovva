-- 060 — vincula o pedido a um contato (pessoa) da empresa cliente.
-- Complementa company_id/relationship_id: registra COM QUEM o pedido foi tratado
-- (comprador). Editável mesmo em pedido já emitido — é só referência, não afeta
-- valor. ON DELETE SET NULL: apagar o contato só desfaz o vínculo.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS contact_id bigint REFERENCES contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_contact_idx ON orders (contact_id);
