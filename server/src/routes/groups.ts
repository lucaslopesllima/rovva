import type { FastifyInstance } from 'fastify';
import { one, query } from '../db.ts';
import { requireAuth, requirePermission } from '../auth.ts';
import { audit } from '../audit.ts';
import { PERMISSIONS, sanitizeCodes } from '../permissions.ts';

// CRUD dos grupos de permissão (admin/grupo com perms `groups.*`). O catálogo é
// público a qualquer logado — a UI monta a matriz de checkboxes a partir dele.
// O grupo Administrador (is_admin) é fixo: não editável nem removível por aqui.

const GROUP_COLS = 'id, nome, is_admin, permissions, created_at';
const guard = (code: string) => [requireAuth, requirePermission(code)];

export function groupRoutes(app: FastifyInstance): void {
  app.get('/api/permissions/catalog', { preHandler: requireAuth }, async () => {
    return { permissions: PERMISSIONS };
  });

  app.get('/api/groups', { preHandler: guard('groups.list') }, async (req) => {
    const groups = await query(
      `SELECT ${GROUP_COLS},
              (SELECT count(*) FROM users u WHERE u.group_id = g.id)::int AS user_count
         FROM permission_groups g WHERE org_id = $1 ORDER BY is_admin DESC, nome`,
      [req.auth!.orgId],
    );
    return { groups };
  });

  app.post('/api/groups', {
    preHandler: guard('groups.create'),
    schema: {
      body: {
        type: 'object',
        required: ['nome'],
        properties: {
          nome: { type: 'string', minLength: 1 },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const b = req.body as { nome: string; permissions?: string[] };
    const perms = sanitizeCodes(b.permissions);
    const dup = await one('SELECT id FROM permission_groups WHERE org_id = $1 AND lower(nome) = lower($2)', [orgId, b.nome.trim()]);
    if (dup) return reply.code(409).send({ error: 'já existe um grupo com esse nome' });

    const rows = await query(
      `INSERT INTO permission_groups (org_id, nome, permissions) VALUES ($1,$2,$3) RETURNING ${GROUP_COLS}`,
      [orgId, b.nome.trim(), perms],
    );
    const g = rows[0] as { id: number };
    await audit(req, 'group', g.id, 'create', { nome: b.nome, permissions: perms });
    return reply.code(201).send({ group: rows[0] });
  });

  app.patch('/api/groups/:id', {
    preHandler: guard('groups.update'),
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: {
        type: 'object',
        properties: {
          nome: { type: 'string', minLength: 1 },
          permissions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const b = req.body as { nome?: string; permissions?: string[] };

    const target = await one<{ is_admin: boolean }>(
      'SELECT is_admin FROM permission_groups WHERE id = $1 AND org_id = $2', [id, orgId],
    );
    if (!target) return reply.code(404).send({ error: 'não encontrado' });
    // Grupo Administrador é fixo (bypass total) — editá-lo não faria efeito e
    // poderia confundir; bloqueia para manter o convite mental claro.
    if (target.is_admin) return reply.code(400).send({ error: 'o grupo Administrador não é editável' });

    const sets: string[] = [];
    const params: unknown[] = [];
    if (b.nome !== undefined) { params.push(b.nome.trim()); sets.push(`nome = $${params.length}`); }
    if (b.permissions !== undefined) { params.push(sanitizeCodes(b.permissions)); sets.push(`permissions = $${params.length}`); }
    if (sets.length === 0) return reply.code(400).send({ error: 'nada para atualizar' });
    params.push(id, orgId);
    const rows = await query(
      `UPDATE permission_groups SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND org_id = $${params.length} RETURNING ${GROUP_COLS}`,
      params,
    );
    await audit(req, 'group', id, 'update', b);
    return { group: rows[0] };
  });

  app.delete('/api/groups/:id', {
    preHandler: guard('groups.delete'),
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const target = await one<{ is_admin: boolean }>(
      'SELECT is_admin FROM permission_groups WHERE id = $1 AND org_id = $2', [id, orgId],
    );
    if (!target) return reply.code(404).send({ error: 'não encontrado' });
    if (target.is_admin) return reply.code(400).send({ error: 'o grupo Administrador não pode ser removido' });
    const inUse = await one('SELECT 1 FROM users WHERE group_id = $1', [id]);
    if (inUse) return reply.code(409).send({ error: 'há usuários neste grupo' });

    await query('DELETE FROM permission_groups WHERE id = $1 AND org_id = $2', [id, orgId]);
    await audit(req, 'group', id, 'delete');
    return { ok: true };
  });
}
