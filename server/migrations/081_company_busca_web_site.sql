-- Investigação completa salva por empresa: além da busca na internet (080),
-- o site achado no registro.br e os contatos lidos nele. Cada parte é gravada
-- pela rota que a produz, em momentos diferentes — daí resultado nullable.
--
-- site          -> DominioEmpresa (server/src/enriquecimento.ts)
-- contatos_site -> { url, contatos, paginas, bloqueado } (contatos_site.ts);
--                  só gravado quando url é um site que o próprio servidor achou
--                  para a empresa (ver routes/companies.ts), porque a linha é
--                  compartilhada entre organizações.
ALTER TABLE company_busca_web
  ALTER COLUMN resultado DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS site jsonb,
  ADD COLUMN IF NOT EXISTS contatos_site jsonb;
