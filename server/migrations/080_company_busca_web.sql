-- Resultado da busca na internet (Serper) por empresa. Cada busca custa 2–3
-- créditos pagos; guardar evita repetir a mesma consulta a cada abertura da
-- ficha. Global por empresa, como company_geocode (016): companies é a base
-- pública compartilhada, e o resultado não depende de quem buscou.
--
-- Contém dado de pessoa física (LinkedIn/telefone de sócio achados por nome).
-- Atualização só por clique explícito ("atualizar"), que sobrescreve a linha.
CREATE TABLE IF NOT EXISTS company_busca_web (
  company_id bigint PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  resultado  jsonb       NOT NULL,   -- BuscaWeb (server/src/busca_web.ts)
  buscado_em timestamptz NOT NULL DEFAULT now()
);
