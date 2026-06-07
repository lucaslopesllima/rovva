-- 008 campos extras da prospecção no funil (company_relationships).
-- Espelham as colunas da planilha de vendas: representante, pessoa/cargo de contato,
-- marca (represented_companies), data do contato, cenário atual, ação p/ próximo nível
-- e previsão de faturamento (data — o valor R$ já é valor_estimado).
ALTER TABLE company_relationships
  ADD COLUMN IF NOT EXISTS representante   text,
  ADD COLUMN IF NOT EXISTS contato_pessoa  text,
  ADD COLUMN IF NOT EXISTS contato_cargo   text,
  ADD COLUMN IF NOT EXISTS represented_id  bigint REFERENCES represented_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_contato    date,
  ADD COLUMN IF NOT EXISTS cenario_atual   text,
  ADD COLUMN IF NOT EXISTS proxima_acao    text,
  ADD COLUMN IF NOT EXISTS previsao_data   date;
