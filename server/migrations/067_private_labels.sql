-- 067 — private labels (marcas próprias que a empresa fornece p/ terceiros marcarem).
-- Entidade org-scoped e reutilizável: a empresa X fornece sob a private label P
-- para as lojas Y e Z. Relação N:N tanto com empresas quanto com contatos.
--
-- Os vínculos apontam para companies(id) (base global RFB, sem org) e contacts(id).
-- O isolamento por tenant vem do org_id que cada linha de junção carrega — mesmo
-- padrão de relationship_contacts. ON DELETE CASCADE em ambos os lados: apagar a
-- label ou a empresa/contato só desfaz o vínculo.

CREATE TABLE IF NOT EXISTS private_labels (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, nome)
);

CREATE TABLE IF NOT EXISTS private_label_companies (
  private_label_id bigint NOT NULL REFERENCES private_labels(id) ON DELETE CASCADE,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  org_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (private_label_id, company_id)
);
CREATE INDEX IF NOT EXISTS private_label_companies_company_idx ON private_label_companies (company_id);

CREATE TABLE IF NOT EXISTS private_label_contacts (
  private_label_id bigint NOT NULL REFERENCES private_labels(id) ON DELETE CASCADE,
  contact_id bigint NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  org_id bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (private_label_id, contact_id)
);
CREATE INDEX IF NOT EXISTS private_label_contacts_contact_idx ON private_label_contacts (contact_id);
