-- Códigos de convite para o cadastro com SIGNUP_ENABLED=false: quem tem um
-- código válido cria a conta mesmo com o cadastro público fechado. Uso único;
-- org_id registra quem consumiu. Gerenciados só pelo dono (LEADS_ADMIN_EMAIL).
CREATE TABLE IF NOT EXISTS signup_convites (
  codigo     text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  usado_em   timestamptz,
  org_id     bigint REFERENCES organizations(id) ON DELETE SET NULL
);
