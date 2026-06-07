-- 009 Cadastros da prospecção: tudo vira dropdown (exceto Notas, texto livre).
-- - represented_brands: marcas que cada empresa representada trabalha (MARCA).
-- - contacts: pessoas; podem ser globais, de uma empresa-prospect (companies) ou de
--   uma representada. No funil só listamos os contatos da empresa-prospect do card.
-- - funnel_scenarios / funnel_actions: listas de "Cenário atual" e "Ação p/ próximo nível".
-- company_relationships passa a referenciar esses cadastros por FK; campos texto saem.

CREATE TABLE IF NOT EXISTS represented_brands (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id         bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  represented_id bigint NOT NULL REFERENCES represented_companies(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS represented_brands_rep_idx ON represented_brands (represented_id, nome);

CREATE TABLE IF NOT EXISTS contacts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id         bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  cargo          text,
  email          text,
  telefone       text,
  company_id     bigint REFERENCES companies(id) ON DELETE CASCADE,            -- empresa-prospect (opcional)
  represented_id bigint REFERENCES represented_companies(id) ON DELETE CASCADE, -- representada (opcional)
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts (org_id, nome);
CREATE INDEX IF NOT EXISTS contacts_company_idx ON contacts (company_id);

CREATE TABLE IF NOT EXISTS funnel_scenarios (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id     bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_scenarios_org_idx ON funnel_scenarios (org_id, nome);

CREATE TABLE IF NOT EXISTS funnel_actions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id     bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funnel_actions_org_idx ON funnel_actions (org_id, nome);

-- Funil agora referencia os cadastros. represented_id (de 008) passa a ser a REPRESENTADA.
ALTER TABLE company_relationships
  DROP COLUMN IF EXISTS representante,
  DROP COLUMN IF EXISTS contato_pessoa,
  DROP COLUMN IF EXISTS contato_cargo,
  DROP COLUMN IF EXISTS cenario_atual,
  DROP COLUMN IF EXISTS proxima_acao,
  ADD COLUMN IF NOT EXISTS marca_id   bigint REFERENCES represented_brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contato_id bigint REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cenario_id bigint REFERENCES funnel_scenarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acao_id    bigint REFERENCES funnel_actions(id) ON DELETE SET NULL;
