-- 005 indexes. Hot path = recommendation over ~1.6M companies.
-- Only ATIVA companies are ever queried, so the filter indexes are PARTIAL
-- (WHERE situacao_cadastral='ativa') -> smaller, hotter, cache-friendly.

-- territory by municipio (primary territory mode)
CREATE INDEX IF NOT EXISTS companies_municipio_ativa_idx
  ON companies (municipio_id)
  WHERE situacao_cadastral = 'ativa';

-- territory by radius
CREATE INDEX IF NOT EXISTS companies_geom_ativa_idx
  ON companies USING gist (geom)
  WHERE situacao_cadastral = 'ativa';

-- division-level CNAE fit + candidate pruning (index-backed division match)
CREATE INDEX IF NOT EXISTS companies_divisao_ativa_idx
  ON companies (cnae_divisao)
  WHERE situacao_cadastral = 'ativa';

-- exact CNAE fit
CREATE INDEX IF NOT EXISTS companies_cnae_ativa_idx
  ON companies (cnae_principal)
  WHERE situacao_cadastral = 'ativa';

-- secondary CNAEs membership
CREATE INDEX IF NOT EXISTS companies_cnae_sec_gin_idx
  ON companies USING gin (cnae_secundarios);

-- fuzzy company name search (CRM lookup)
CREATE INDEX IF NOT EXISTS companies_razao_trgm_idx
  ON companies USING gin (razao_social gin_trgm_ops);
CREATE INDEX IF NOT EXISTS companies_fantasia_trgm_idx
  ON companies USING gin (nome_fantasia gin_trgm_ops);

-- CNAE free-text search over reference descriptions
CREATE INDEX IF NOT EXISTS cnae_ref_desc_trgm_idx
  ON cnae_reference USING gin (descricao gin_trgm_ops);

-- tenant scoping (company_relationships)
-- UNIQUE(org_id, company_id) already created in 004; add kanban + ownership access paths.
CREATE INDEX IF NOT EXISTS rel_org_stage_idx
  ON company_relationships (org_id, stage_id);
CREATE INDEX IF NOT EXISTS rel_org_owner_idx
  ON company_relationships (org_id, owner_user_id);
-- supports NOT EXISTS anti-join in recommendation (org_id, company_id) — covered by unique idx.

-- activities agenda access
CREATE INDEX IF NOT EXISTS activities_org_start_idx
  ON activities (org_id, start_at);
CREATE INDEX IF NOT EXISTS activities_org_owner_idx
  ON activities (org_id, owner_user_id);
