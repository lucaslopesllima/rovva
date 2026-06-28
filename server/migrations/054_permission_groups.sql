-- 054 RBAC fino: grupos de permissão. Cada usuário pertence a um grupo; o grupo
-- carrega a lista de códigos de permissão (catálogo em src/permissions.ts).
-- is_admin = bypass total (grupo Administrador). O seed dos grupos padrão e a
-- atribuição dos usuários existentes rodam no boot (src/seedGroups.ts), reusando
-- os presets do catálogo — evita duplicar a lista de códigos aqui em SQL.
--
-- role permanece: continua dirigindo o escopo owner-based (scope.ts) e serve de
-- fallback de bypass admin enquanto o seed de grupos não atribuiu group_id.

CREATE TABLE IF NOT EXISTS permission_groups (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id      bigint NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome        text   NOT NULL,
  is_admin    boolean NOT NULL DEFAULT false,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, nome)
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS group_id bigint REFERENCES permission_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_group_idx ON users (group_id);
