-- 004 TENANT tables: every row scoped by org_id. Tenants never own companies;
-- they only create references (company_relationships) into the global pool.

CREATE TABLE IF NOT EXISTS organizations (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome   text NOT NULL,
  plano  text NOT NULL DEFAULT 'free'
);

CREATE TABLE IF NOT EXISTS users (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       text NOT NULL UNIQUE,
  senha_hash  text NOT NULL,             -- scrypt: salt:hash hex
  role        user_role NOT NULL DEFAULT 'rep'
);

-- target profile: declared CNAEs and/or territory. pesos drives the score weights.
CREATE TABLE IF NOT EXISTS target_profiles (
  org_id                 bigint PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  cnaes_alvo             int[] NOT NULL DEFAULT '{}',
  territorio_municipios  int[] NOT NULL DEFAULT '{}',
  territorio_raio_km     int,            -- null/0 => use municipio list; else radius around territory centroid
  pesos                  jsonb NOT NULL DEFAULT '{"cnae":0.5,"proximidade":0.3,"porte":0.2}'
);

CREATE TABLE IF NOT EXISTS stages (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id  bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome    text NOT NULL,
  ordem   int NOT NULL
);

-- THE reference of a tenant to a company in the global pool. Holds ALL tenant-specific
-- state for that company. Kanban operates here via stage_id. No separate deals table.
CREATE TABLE IF NOT EXISTS company_relationships (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id      bigint NOT NULL REFERENCES companies(id),
  owner_user_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  stage_id        bigint REFERENCES stages(id) ON DELETE SET NULL,
  status          rel_status NOT NULL DEFAULT 'prospect',
  valor_estimado  numeric(16,2),
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_relationships_uq UNIQUE (org_id, company_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id         bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tipo           text NOT NULL DEFAULT 'tarefa',
  titulo         text NOT NULL,
  start_at       timestamptz NOT NULL,
  end_at         timestamptz,
  owner_user_id  bigint REFERENCES users(id) ON DELETE SET NULL,
  company_id     bigint REFERENCES companies(id),
  status         activity_status NOT NULL DEFAULT 'pendente'
);
