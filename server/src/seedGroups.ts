import type pg from 'pg';
import { pool, query } from './db.ts';
import { PRESET_VENDEDOR, PRESET_GERENTE, PRESET_FINANCEIRO } from './permissions.ts';

// Grupos padrão semeados em toda org. Administrador é is_admin (bypass total);
// os demais carregam presets do catálogo. Mantido aqui (TS) em vez de SQL para
// ter uma única fonte dos códigos (src/permissions.ts).
const DEFAULT_GROUPS: { nome: string; is_admin: boolean; permissions: string[] }[] = [
  { nome: 'Administrador', is_admin: true, permissions: [] },
  { nome: 'Vendedor', is_admin: false, permissions: PRESET_VENDEDOR },
  { nome: 'Gerente', is_admin: false, permissions: PRESET_GERENTE },
  { nome: 'Financeiro', is_admin: false, permissions: PRESET_FINANCEIRO },
];

type Querier = Pick<pg.PoolClient, 'query'>;

// Garante os grupos padrão de uma org (idempotente via UNIQUE(org_id,nome)) e
// devolve o id do grupo Administrador — usado no register para já filiar o admin.
export async function ensureDefaultGroups(orgId: number | string, db: Querier = pool): Promise<number> {
  let adminId = 0;
  for (const g of DEFAULT_GROUPS) {
    const r = await db.query(
      `INSERT INTO permission_groups (org_id, nome, is_admin, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id, nome) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id, is_admin`,
      [orgId, g.nome, g.is_admin, g.permissions],
    );
    if (r.rows[0].is_admin) adminId = Number(r.rows[0].id);
  }
  return adminId;
}

// Boot: garante grupos em todas as orgs e filia usuários ainda sem grupo pelo
// papel (admin → Administrador, demais → Vendedor). Idempotente; só toca quem
// tem group_id NULL, então não sobrescreve atribuição feita pelo admin na UI.
export async function seedAllOrgs(): Promise<void> {
  const orgs = await query<{ id: number }>('SELECT id FROM organizations');
  for (const o of orgs) await ensureDefaultGroups(o.id);

  await query(
    `UPDATE users u SET group_id = g.id
       FROM permission_groups g
      WHERE g.org_id = u.org_id AND g.is_admin = true
        AND u.group_id IS NULL AND u.role = 'admin'`,
  );
  await query(
    `UPDATE users u SET group_id = g.id
       FROM permission_groups g
      WHERE g.org_id = u.org_id AND g.nome = 'Vendedor'
        AND u.group_id IS NULL AND u.role <> 'admin'`,
  );
}
