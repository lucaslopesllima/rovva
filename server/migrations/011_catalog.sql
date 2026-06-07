-- 011 Catálogo de produtos/serviços da org. Relacionável à prospecção (0..N).
CREATE TABLE IF NOT EXISTS catalog_items (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id         bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  codigo         text,                          -- SKU / código
  descricao      text,
  preco          numeric(16,2),
  represented_id bigint REFERENCES represented_companies(id) ON DELETE SET NULL, -- marca/representada (opcional)
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_items_org_idx ON catalog_items (org_id, nome);

CREATE TABLE IF NOT EXISTS relationship_catalog (
  relationship_id bigint NOT NULL REFERENCES company_relationships(id) ON DELETE CASCADE,
  catalog_item_id bigint NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  PRIMARY KEY (relationship_id, catalog_item_id)
);
CREATE INDEX IF NOT EXISTS relationship_catalog_item_idx ON relationship_catalog (catalog_item_id);
