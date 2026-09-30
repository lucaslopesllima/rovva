-- 082 — índices da busca de empresas (sql/recommend.ts), três coisas:
--
-- 1) Índice de cobertura recriado com `source <> 'demo'` no predicado parcial. A
--    073 adicionou esse predicado à query mas não ao índice, e o scan de candidatos
--    voltou a ler o heap linha a linha (Parallel Index Scan em vez de Index Only):
--    filtro raro em SP capital 1,3s -> 0,4s quente, 5,2s -> 0,7s frio. Sai
--    cnae_divisao do INCLUDE: a recomendação não usa mais (fit por CNAE exato).
--
-- 2) CNAE exato no principal OU em qualquer secundário (candidatePredicates:
--    `cnae_principal = ANY($) OR cnae_secundarios && $`). Índices compostos com
--    município na frente: o BitmapOr já sai restrito ao território, em vez de
--    varrer o CNAE no Brasil inteiro e descartar 90% no heap (47 mil blocos ->
--    4 mil; CNAE raro em SP 1,4s -> <0,2s frio). btree_gin permite municipio_id
--    (int) no GIN junto com o array. Substituem as versões nacionais que esta
--    migração criava antes de ser commitada.
--
-- 3) companies_divisao_ativa_idx: nenhum caminho filtra mais por cnae_divisao.
--
-- Custo: rebuild do índice de cobertura (~1,8GB, alguns minutos, SHARE lock —
-- bloqueia escrita, não leitura) + ~35s por índice de CNAE. Não é CONCURRENTLY
-- porque o runner aplica cada migração numa transação.
CREATE EXTENSION IF NOT EXISTS btree_gin;

DROP INDEX IF EXISTS companies_reco_cov_idx;
CREATE INDEX IF NOT EXISTS companies_reco_cov_idx
  ON companies (municipio_id)
  INCLUDE (id, uf, regiao, cnae_principal, porte, capital_social, data_inicio_atividade)
  WHERE situacao_cadastral = 'ativa' AND source <> 'demo';

DROP INDEX IF EXISTS companies_cnae_ativa_idx;
DROP INDEX IF EXISTS companies_cnae_sec_gin_idx;
CREATE INDEX IF NOT EXISTS companies_muni_cnae_idx
  ON companies (municipio_id, cnae_principal)
  WHERE situacao_cadastral = 'ativa' AND source <> 'demo';
CREATE INDEX IF NOT EXISTS companies_muni_cnae_sec_gin_idx
  ON companies USING gin (municipio_id, cnae_secundarios)
  WHERE situacao_cadastral = 'ativa' AND source <> 'demo';

DROP INDEX IF EXISTS companies_divisao_ativa_idx;
