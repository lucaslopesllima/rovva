-- 007 represented_companies — fabricantes/fornecedores que o representante representa.
-- Org-scoped. Não confundir com `companies` (pool global de prospecção) nem com
-- `company_relationships` (funil). Aqui são as marcas/principais que o rep trabalha.
CREATE TABLE IF NOT EXISTS represented_companies (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  cnpj        text,
  segmento    text,
  site        text,
  contato     text,
  notas       text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS represented_companies_org_idx ON represented_companies (org_id, nome);
