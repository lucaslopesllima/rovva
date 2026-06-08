-- 016 cache de geocodificação sob demanda (endereço -> lat/lon exato).
-- Preenchido quando uma empresa é aberta/focada/roteada. Sobrevive ao ETL
-- (que só mexe em companies). precisao: 'rua' | 'cep' | 'municipio'.
CREATE TABLE IF NOT EXISTS company_geocode (
  company_id    bigint PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  lat           double precision NOT NULL,
  lon           double precision NOT NULL,
  precisao      text NOT NULL,
  fonte         text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
