-- 003 GLOBAL tables: shared pool, written ONLY by ETL, read by app.
-- companies is a single global base common to ALL tenants. Never org-scoped.

CREATE TABLE IF NOT EXISTS municipios (
  id          int PRIMARY KEY,            -- IBGE code
  nome        text NOT NULL,
  uf          char(2) NOT NULL,
  regiao      regiao_br NOT NULL,
  geom        geography(Point,4326) NOT NULL  -- centroide
);

CREATE TABLE IF NOT EXISTS cnae_reference (
  codigo      int PRIMARY KEY,            -- CNAE subclasse, 7 digits as int (e.g. 4781400)
  descricao   text NOT NULL,
  secao       char(1) NOT NULL,
  divisao     smallint NOT NULL           -- 2 digits
);

-- synonym dictionary: free term -> set of CNAE codes (no NLP, plain lookup)
CREATE TABLE IF NOT EXISTS cnae_sinonimos (
  termo          text PRIMARY KEY,
  cnae_codigos   int[] NOT NULL
);

-- which regions/UFs have been loaded by ETL (recommendation gate)
CREATE TABLE IF NOT EXISTS enabled_regions (
  uf          char(2),
  regiao      regiao_br,
  CONSTRAINT enabled_regions_one_chk CHECK (uf IS NOT NULL OR regiao IS NOT NULL),
  CONSTRAINT enabled_regions_uf_uq UNIQUE (uf)
);

CREATE TABLE IF NOT EXISTS companies (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cnpj               char(14) NOT NULL UNIQUE,
  razao_social       text NOT NULL,
  nome_fantasia      text,
  cnae_principal     int NOT NULL,
  -- derived hierarchy bucket (pure function of cnae_principal); kept for index-backed division fit
  cnae_divisao       smallint GENERATED ALWAYS AS (cnae_principal / 100000) STORED,
  cnae_secundarios   int[] NOT NULL DEFAULT '{}',
  municipio_id       int REFERENCES municipios(id),
  uf                 char(2) NOT NULL,
  regiao             regiao_br NOT NULL,
  geom               geography(Point,4326),
  porte              porte_emp NOT NULL DEFAULT 'nao_informado',
  capital_social     numeric(16,2) NOT NULL DEFAULT 0,
  situacao_cadastral situacao_cad NOT NULL DEFAULT 'ativa',
  source             company_source NOT NULL DEFAULT 'rfb',
  raw_data           jsonb
);

-- static map divisao -> secao, derived from cnae_reference; tiny (~99 rows), joined for secao-level fit.
CREATE TABLE IF NOT EXISTS cnae_divisao_secao (
  divisao  smallint PRIMARY KEY,
  secao    char(1)  NOT NULL
);
