-- 017 cache da geocodificação do endereço da organização (origem das rotas).
-- Preenchido sob demanda em GET /api/account/origem; limpo quando o endereço muda.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS origem_lat double precision,
  ADD COLUMN IF NOT EXISTS origem_lon double precision;
