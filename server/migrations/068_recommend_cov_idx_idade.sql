-- 068 — score da busca de empresas ganhou dois componentes: capital social (que
-- saiu de dentro do componente porte) e tempo de vida da empresa
-- (data_inicio_atividade). O tempo de vida é calculado por linha no scan de
-- candidatos, então data_inicio_atividade precisa entrar no INCLUDE do índice de
-- cobertura (058) — sem isso o Index Only Scan volta a tocar o heap de 18GB e o
-- pior caso (São Paulo capital, ~2,7M ativas) volta de <1s para ~29s.
--
-- Custo: rebuild do índice (~1,8GB, alguns minutos, SHARE lock — bloqueia
-- escrita, não leitura). Não é CONCURRENTLY porque o runner aplica cada
-- migração numa transação.
DROP INDEX IF EXISTS companies_reco_cov_idx;

CREATE INDEX IF NOT EXISTS companies_reco_cov_idx
  ON companies (municipio_id)
  INCLUDE (id, uf, regiao, cnae_principal, cnae_divisao, porte, capital_social,
           data_inicio_atividade)
  WHERE situacao_cadastral = 'ativa';
