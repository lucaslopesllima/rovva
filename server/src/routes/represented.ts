import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { requireAuth, requirePermission } from '../auth.ts';

const COLS = 'id, nome, cnpj, segmento, site, contato, notas, ativo, comissao_modalidade, comissao_prazo_tipo, comissao_prazo';
const PAYMENT_PROPS = {
  comissao_modalidade: { type: 'string', enum: ['faturamento', 'liquidez'] },
  comissao_prazo_tipo: { type: 'string', enum: ['dias', 'mes_seguinte'] },
  comissao_prazo: { type: 'integer', minimum: 0, maximum: 365 },
};

export function representedRoutes(app: FastifyInstance): void {
  app.get('/api/represented', { preHandler: [requireAuth, requirePermission('represented.list')] }, async (req) => {
    const orgId = req.auth!.orgId;
    const empresas = await query(
      `SELECT ${COLS} FROM represented_companies WHERE org_id = $1 ORDER BY ativo DESC, nome`,
      [orgId],
    );
    return { empresas };
  });

  app.post('/api/represented', {
    preHandler: [requireAuth, requirePermission('represented.create')],
    schema: {
      body: {
        type: 'object',
        required: ['nome'],
        properties: {
          nome: { type: 'string', minLength: 1 },
          cnpj: { type: ['string', 'null'] },
          segmento: { type: ['string', 'null'] },
          site: { type: ['string', 'null'] },
          contato: { type: ['string', 'null'] },
          notas: { type: ['string', 'null'] },
          ...PAYMENT_PROPS,
        },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const b = req.body as Record<string, unknown>;
    if (b.comissao_prazo_tipo === 'mes_seguinte' && !(Number(b.comissao_prazo) >= 1 && Number(b.comissao_prazo) <= 31)) {
      return reply.code(400).send({ error: 'Dia do mês seguinte deve estar entre 1 e 31.' });
    }
    const rows = await query(
      `INSERT INTO represented_companies (org_id, nome, cnpj, segmento, site, contato, notas, comissao_modalidade, comissao_prazo_tipo, comissao_prazo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${COLS}`,
      [orgId, b.nome, b.cnpj ?? null, b.segmento ?? null, b.site ?? null, b.contato ?? null, b.notas ?? null, b.comissao_modalidade ?? 'faturamento', b.comissao_prazo_tipo ?? 'dias', b.comissao_prazo ?? 0],
    );
    return { empresa: rows[0] };
  });

  app.patch('/api/represented/:id', {
    preHandler: [requireAuth, requirePermission('represented.update')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: {
        type: 'object',
        properties: {
          nome: { type: 'string', minLength: 1 },
          cnpj: { type: ['string', 'null'] },
          segmento: { type: ['string', 'null'] },
          site: { type: ['string', 'null'] },
          contato: { type: ['string', 'null'] },
          notas: { type: ['string', 'null'] },
          ...PAYMENT_PROPS,
          ativo: { type: 'boolean' },
        },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const b = req.body as Record<string, unknown>;
    const current = (await query<{ comissao_prazo_tipo: string; comissao_prazo: number }>(
      'SELECT comissao_prazo_tipo, comissao_prazo FROM represented_companies WHERE id = $1 AND org_id = $2', [id, orgId],
    ))[0];
    if (!current) return reply.code(404).send({ error: 'não encontrado' });
    const prazo = Number(b.comissao_prazo ?? current.comissao_prazo);
    if ((b.comissao_prazo_tipo ?? current.comissao_prazo_tipo) === 'mes_seguinte' && (prazo < 1 || prazo > 31)) {
      return reply.code(400).send({ error: 'Dia do mês seguinte deve estar entre 1 e 31.' });
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const k of ['nome', 'cnpj', 'segmento', 'site', 'contato', 'notas', 'ativo', 'comissao_modalidade', 'comissao_prazo_tipo', 'comissao_prazo'] as const) {
      if (b[k] !== undefined) { params.push(b[k]); sets.push(`${k} = $${params.length}`); }
    }
    if (sets.length === 0) return reply.code(400).send({ error: 'nada para atualizar' });
    params.push(id, orgId);
    const rows = await query(
      `UPDATE represented_companies SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND org_id = $${params.length} RETURNING ${COLS}`,
      params,
    );
    if (rows.length === 0) return reply.code(404).send({ error: 'não encontrado' });
    return { empresa: rows[0] };
  });

  app.delete('/api/represented/:id', {
    preHandler: [requireAuth, requirePermission('represented.delete')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const rows = await query('DELETE FROM represented_companies WHERE id = $1 AND org_id = $2 RETURNING id', [id, orgId]);
    if (rows.length === 0) return reply.code(404).send({ error: 'não encontrado' });
    return { deleted: true };
  });
}
