-- 012 Origem fixa para cálculo de rota (endereço-base do representante).
ALTER TABLE target_profiles
  ADD COLUMN IF NOT EXISTS origem_endereco text,
  ADD COLUMN IF NOT EXISTS origem_lat double precision,
  ADD COLUMN IF NOT EXISTS origem_lon double precision;
