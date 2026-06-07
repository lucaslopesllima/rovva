-- Free-term -> CNAE codes dictionary (no NLP). Expand as needed.
INSERT INTO cnae_sinonimos (termo, cnae_codigos) VALUES
  ('roupa',     ARRAY[1411801,1412601,1413401,4781400,4642701]),
  ('roupas',    ARRAY[1411801,1412601,1413401,4781400,4642701]),
  ('vestuario', ARRAY[1411801,1412601,1413401,4781400,4642701]),
  ('vestuário', ARRAY[1411801,1412601,1413401,4781400,4642701]),
  ('moda',      ARRAY[1412601,4781400,4642701]),
  ('calcado',   ARRAY[1531901,4782201]),
  ('calçado',   ARRAY[1531901,4782201]),
  ('sapato',    ARRAY[1531901,4782201]),
  ('padaria',   ARRAY[4721102,1091101]),
  ('pao',       ARRAY[4721102,1091101]),
  ('pão',       ARRAY[4721102,1091101]),
  ('restaurante', ARRAY[5611201,5611203]),
  ('comida',    ARRAY[5611201,5611203]),
  ('mercado',   ARRAY[4711301]),
  ('software',  ARRAY[6201501]),
  ('contabilidade', ARRAY[6920601])
ON CONFLICT (termo) DO UPDATE SET cnae_codigos = EXCLUDED.cnae_codigos;
