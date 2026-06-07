-- 010 Vários contatos por prospecção. Substitui o FK único contato_id por N:N.
CREATE TABLE IF NOT EXISTS relationship_contacts (
  relationship_id bigint NOT NULL REFERENCES company_relationships(id) ON DELETE CASCADE,
  contact_id      bigint NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (relationship_id, contact_id)
);
CREATE INDEX IF NOT EXISTS relationship_contacts_contact_idx ON relationship_contacts (contact_id);

-- migra o vínculo único que existia
INSERT INTO relationship_contacts (relationship_id, contact_id)
  SELECT id, contato_id FROM company_relationships WHERE contato_id IS NOT NULL
  ON CONFLICT DO NOTHING;

ALTER TABLE company_relationships DROP COLUMN IF EXISTS contato_id;
