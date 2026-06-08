-- 018 índices para as colunas de filtro de empresa que ainda faltavam.
-- Dados RFB de consulta: mudam pouco (só no ETL) e são usados como filtro no
-- funil/prospecção (recommend.ts) e na checagem de regiões habilitadas.
-- PARCIAIS em situacao_cadastral='ativa' (mesma convenção da 005): só ATIVA é
-- consultada -> índices menores, mais quentes e cache-friendly.

-- filtro por UF (RecommendFilters.uf) + EXISTS enabled_regions er.uf = c.uf
CREATE INDEX IF NOT EXISTS companies_uf_ativa_idx
  ON companies (uf)
  WHERE situacao_cadastral = 'ativa';

-- filtro por porte (RecommendFilters.porte)
CREATE INDEX IF NOT EXISTS companies_porte_ativa_idx
  ON companies (porte)
  WHERE situacao_cadastral = 'ativa';

-- EXISTS enabled_regions er.regiao = c.regiao (poda por região habilitada)
CREATE INDEX IF NOT EXISTS companies_regiao_ativa_idx
  ON companies (regiao)
  WHERE situacao_cadastral = 'ativa';
