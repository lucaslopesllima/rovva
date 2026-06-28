import type { FastifyInstance } from 'fastify';
import { one, query } from '../db.ts';
import { requireAuth, requirePermission } from '../auth.ts';

export function stageRoutes(app: FastifyInstance): void {
  app.get('/api/stages', { preHandler: [requireAuth, requirePermission('stages.list')] }, async (req) => {
    const orgId = req.auth!.orgId;
    const stages = await query('SELECT id, nome, ordem FROM stages WHERE org_id = $1 ORDER BY ordem', [orgId]);
    return { stages };
  });

  app.post('/api/stages', {
    preHandler: [requireAuth, requirePermission('stages.create')],
    schema: {
      body: { type: 'object', required: ['nome'], properties: { nome: { type: 'string', minLength: 1 }, ordem: { type: 'integer' } } },
    },
  }, async (req) => {
    const orgId = req.auth!.orgId;
    const { nome, ordem } = req.body as { nome: string; ordem?: number };
    const next = ordem ?? (await one<{ n: number }>('SELECT COALESCE(MAX(ordem),0)+1 AS n FROM stages WHERE org_id = $1', [orgId]))!.n;
    const rows = await query('INSERT INTO stages (org_id, nome, ordem) VALUES ($1,$2,$3) RETURNING id, nome, ordem', [orgId, nome, next]);
    return { stage: rows[0] };
  });

  app.patch('/api/stages/:id', {
    preHandler: [requireAuth, requirePermission('stages.update')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: { type: 'object', properties: { nome: { type: 'string' }, ordem: { type: 'integer' } } },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const b = req.body as { nome?: string; ordem?: number };
    const sets: string[] = [];
    const params: unknown[] = [];
    if (b.nome !== undefined) { params.push(b.nome); sets.push(`nome = $${params.length}`); }
    if (b.ordem !== undefined) { params.push(b.ordem); sets.push(`ordem = $${params.length}`); }
    if (sets.length === 0) return reply.code(400).send({ error: 'nada para atualizar' });
    params.push(id, orgId);
    const rows = await query(
      `UPDATE stages SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND org_id = $${params.length} RETURNING id, nome, ordem`,
      params,
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'não encontrado' });
    return { stage: rows[0] };
  });

  app.delete('/api/stages/:id', {
    preHandler: [requireAuth, requirePermission('stages.delete')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    // relationships keep stage_id ON DELETE SET NULL via FK
    const rows = await query('DELETE FROM stages WHERE id = $1 AND org_id = $2 RETURNING id', [id, orgId]);
    if (rows.length === 0) return reply.code(404).send({ error: 'não encontrado' });
    return { deleted: true };
  });
}
