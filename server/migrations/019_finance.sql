-- 019 módulo financeiro: contas a pagar e a receber, org-scoped.
-- Cada lançamento pode (opcionalmente) se relacionar com:
--   company_id     → empresa prospect (pool global `companies`)
--   represented_id → empresa representada (`represented_companies`)
--   activity_id    → compromisso (`activities`)
-- Todos os FKs usam SET NULL no delete: apagar o vínculo não apaga o lançamento.

DO $$ BEGIN
  CREATE TYPE finance_kind AS ENUM ('pagar','receber');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finance_status AS ENUM ('pendente','liquidado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS finance_entries (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            finance_kind NOT NULL,
  descricao       text NOT NULL,
  valor           numeric(16,2) NOT NULL,
  vencimento      date NOT NULL,
  liquidacao_data date,                       -- preenchido quando status = 'liquidado'
  status          finance_status NOT NULL DEFAULT 'pendente',
  categoria       text,
  notas           text,
  company_id      bigint REFERENCES companies(id) ON DELETE SET NULL,
  represented_id  bigint REFERENCES represented_companies(id) ON DELETE SET NULL,
  activity_id     bigint REFERENCES activities(id) ON DELETE SET NULL,
  owner_user_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_entries_org_venc_idx   ON finance_entries (org_id, vencimento);
CREATE INDEX IF NOT EXISTS finance_entries_org_status_idx ON finance_entries (org_id, kind, status);
