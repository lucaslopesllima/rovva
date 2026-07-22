import type { FastifyInstance } from 'fastify';
import { query, one, withClient } from '../db.ts';
import { requireAuth, requirePermission } from '../auth.ts';

// Private labels: marcas próprias que a empresa fornece p/ terceiros marcarem.
// Entidade org-scoped, N:N com empresas (base global RFB) e contatos. Os vínculos
// são geridos dos dois lados: aqui (empresas/contatos de uma label) e nas telas de
// empresa/contato (labels de uma empresa/contato). Ver migração 067.

const LABEL_COLS = 'id, nome, descricao, cor, created_at';
const L_COLS = 'l.id, l.nome, l.descricao, l.cor, l.created_at'; // mesmas colunas com alias `l`
const labelBody = {
  nome: { type: 'string', minLength: 1, maxLength: 120 },
  descricao: { type: ['string', 'null'], maxLength: 500 },
  cor: { type: ['string', 'null'], maxLength: 32 },
} as const;

// Confere que todos os ids pertencem à org na tabela dada (ids vazio = ok).
async function allOwned(table: 'private_labels' | 'contacts', ids: number[], orgId: number): Promise<boolean> {
  if (ids.length === 0) return true;
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${table} WHERE org_id = $1 AND id = ANY($2::bigint[])`,
    [orgId, ids],
  );
  return Number(row?.n ?? 0) === new Set(ids).size;
}

export function privateLabelRoutes(app: FastifyInstance): void {
  // ── Catálogo de labels ─────────────────────────────────────
  app.get('/api/private-labels', {
    preHandler: [requireAuth, requirePermission('private_labels.list')],
  }, async (req) => {
    const orgId = req.auth!.orgId;
    // conta empresas/contatos vinculados p/ exibir na lista sem N+1
    const labels = await query(
      `SELECT ${L_COLS},
              (SELECT count(*) FROM private_label_companies plc WHERE plc.private_label_id = l.id)::int AS companies_count,
              (SELECT count(*) FROM private_label_contacts plt WHERE plt.private_label_id = l.id)::int AS contacts_count
         FROM private_labels l
        WHERE l.org_id = $1
        ORDER BY l.nome`,
      [orgId],
    );
    return { labels };
  });

  app.get('/api/private-labels/:id', {
    preHandler: [requireAuth, requirePermission('private_labels.list')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const label = await one(`SELECT ${LABEL_COLS} FROM private_labels WHERE id = $1 AND org_id = $2`, [id, orgId]);
    if (!label) return reply.code(404).send({ error: 'não encontrado' });
    const companies = await query(
      `SELECT c.id, c.cnpj, c.razao_social, c.nome_fantasia, c.uf
         FROM private_label_companies plc
         JOIN companies c ON c.id = plc.company_id
        WHERE plc.private_label_id = $1 AND plc.org_id = $2
        ORDER BY COALESCE(c.nome_fantasia, c.razao_social)`,
      [id, orgId],
    );
    const contacts = await query(
      `SELECT ct.id, ct.nome, ct.cargo
         FROM private_label_contacts plt
         JOIN contacts ct ON ct.id = plt.contact_id
        WHERE plt.private_label_id = $1 AND plt.org_id = $2
        ORDER BY ct.nome`,
      [id, orgId],
    );
    return { label, companies, contacts };
  });

  app.post('/api/private-labels', {
    preHandler: [requireAuth, requirePermission('private_labels.create')],
    schema: { body: { type: 'object', required: ['nome'], properties: { ...labelBody } } },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const b = req.body as { nome: string; descricao?: string | null; cor?: string | null };
    const rows = await query(
      `INSERT INTO private_labels (org_id, nome, descricao, cor) VALUES ($1,$2,$3,$4) RETURNING ${LABEL_COLS}`,
      [orgId, b.nome.trim(), b.descricao?.trim() || null, b.cor?.trim() || null],
    ).catch((e: unknown) => {
      // UNIQUE(org_id, nome)
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') return null;
      throw e;
    });
    if (rows === null) return reply.code(409).send({ error: 'já existe uma private label com esse nome' });
    return reply.code(201).send({ label: rows[0] });
  });

  app.patch('/api/private-labels/:id', {
    preHandler: [requireAuth, requirePermission('private_labels.update')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: { type: 'object', properties: { ...labelBody } },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const b = req.body as { nome?: string; descricao?: string | null; cor?: string | null };
    const sets: string[] = [];
    const params: unknown[] = [];
    if ('nome' in b) {
      const nome = (b.nome ?? '').trim();
      if (!nome) return reply.code(400).send({ error: 'nome obrigatório' });
      params.push(nome); sets.push(`nome = $${params.length}`);
    }
    for (const k of ['descricao', 'cor'] as const) {
      if (k in b) {
        params.push(typeof b[k] === 'string' ? (b[k] as string).trim() || null : b[k] ?? null);
        sets.push(`${k} = $${params.length}`);
      }
    }
    if (sets.length === 0) return reply.code(400).send({ error: 'nada para atualizar' });
    params.push(id); const idIdx = params.length;
    params.push(orgId); const orgIdx = params.length;
    const rows = await query(
      `UPDATE private_labels SET ${sets.join(', ')} WHERE id = $${idIdx} AND org_id = $${orgIdx} RETURNING ${LABEL_COLS}`,
      params,
    ).catch((e: unknown) => {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') return null;
      throw e;
    });
    if (rows === null) return reply.code(409).send({ error: 'já existe uma private label com esse nome' });
    if (rows.length === 0) return reply.code(404).send({ error: 'não encontrado' });
    return { label: rows[0] };
  });

  app.delete('/api/private-labels/:id', {
    preHandler: [requireAuth, requirePermission('private_labels.delete')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const rows = await query('DELETE FROM private_labels WHERE id = $1 AND org_id = $2 RETURNING id', [id, orgId]);
    if (rows.length === 0) return reply.code(404).send({ error: 'não encontrado' });
    return { deleted: true };
  });

  // ── Vínculos geridos pelo lado da LABEL ────────────────────
  // Substitui o conjunto de empresas de uma label. company_ids apontam para a base
  // global (FK garante existência); o org_id do vínculo isola por tenant.
  app.put('/api/private-labels/:id/companies', {
    preHandler: [requireAuth, requirePermission('private_labels.update')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: {
        type: 'object', required: ['company_ids'],
        properties: { company_ids: { type: 'array', items: { type: 'integer' } } },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const ids = [...new Set((req.body as { company_ids: number[] }).company_ids)];
    const label = await one('SELECT 1 FROM private_labels WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (!label) return reply.code(404).send({ error: 'não encontrado' });
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        await c.query('DELETE FROM private_label_companies WHERE private_label_id = $1 AND org_id = $2', [id, orgId]);
        if (ids.length) {
          await c.query(
            `INSERT INTO private_label_companies (private_label_id, company_id, org_id)
             SELECT $1, unnest($2::bigint[]), $3 ON CONFLICT DO NOTHING`,
            [id, ids, orgId],
          );
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; }
    });
    return { updated: true, count: ids.length };
  });

  // Substitui o conjunto de contatos de uma label (contatos precisam ser da org).
  app.put('/api/private-labels/:id/contacts', {
    preHandler: [requireAuth, requirePermission('private_labels.update')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: {
        type: 'object', required: ['contact_ids'],
        properties: { contact_ids: { type: 'array', items: { type: 'integer' } } },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const ids = [...new Set((req.body as { contact_ids: number[] }).contact_ids)];
    const label = await one('SELECT 1 FROM private_labels WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (!label) return reply.code(404).send({ error: 'não encontrado' });
    if (!(await allOwned('contacts', ids, orgId))) return reply.code(400).send({ error: 'contato inválido' });
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        await c.query('DELETE FROM private_label_contacts WHERE private_label_id = $1 AND org_id = $2', [id, orgId]);
        if (ids.length) {
          await c.query(
            `INSERT INTO private_label_contacts (private_label_id, contact_id, org_id)
             SELECT $1, unnest($2::bigint[]), $3 ON CONFLICT DO NOTHING`,
            [id, ids, orgId],
          );
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; }
    });
    return { updated: true, count: ids.length };
  });

  // ── Vínculos geridos pelo lado da EMPRESA / do CONTATO ─────
  app.get('/api/companies/:id/private-labels', {
    preHandler: [requireAuth, requirePermission('private_labels.list')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const labels = await query(
      `SELECT ${L_COLS}
         FROM private_label_companies plc
         JOIN private_labels l ON l.id = plc.private_label_id
        WHERE plc.company_id = $1 AND plc.org_id = $2
        ORDER BY l.nome`,
      [id, orgId],
    );
    return { labels };
  });

  app.put('/api/companies/:id/private-labels', {
    preHandler: [requireAuth, requirePermission('private_labels.update')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: {
        type: 'object', required: ['label_ids'],
        properties: { label_ids: { type: 'array', items: { type: 'integer' } } },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const ids = [...new Set((req.body as { label_ids: number[] }).label_ids)];
    if (!(await allOwned('private_labels', ids, orgId))) return reply.code(400).send({ error: 'private label inválida' });
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        await c.query('DELETE FROM private_label_companies WHERE company_id = $1 AND org_id = $2', [id, orgId]);
        if (ids.length) {
          await c.query(
            `INSERT INTO private_label_companies (private_label_id, company_id, org_id)
             SELECT unnest($1::bigint[]), $2, $3 ON CONFLICT DO NOTHING`,
            [ids, id, orgId],
          );
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; }
    });
    return { updated: true, count: ids.length };
  });

  app.get('/api/contacts/:id/private-labels', {
    preHandler: [requireAuth, requirePermission('private_labels.list')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const owns = await one('SELECT 1 FROM contacts WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (!owns) return reply.code(404).send({ error: 'não encontrado' });
    const labels = await query(
      `SELECT ${L_COLS}
         FROM private_label_contacts plt
         JOIN private_labels l ON l.id = plt.private_label_id
        WHERE plt.contact_id = $1 AND plt.org_id = $2
        ORDER BY l.nome`,
      [id, orgId],
    );
    return { labels };
  });

  app.put('/api/contacts/:id/private-labels', {
    preHandler: [requireAuth, requirePermission('private_labels.update')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
      body: {
        type: 'object', required: ['label_ids'],
        properties: { label_ids: { type: 'array', items: { type: 'integer' } } },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { id } = req.params as { id: number };
    const ids = [...new Set((req.body as { label_ids: number[] }).label_ids)];
    const owns = await one('SELECT 1 FROM contacts WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (!owns) return reply.code(404).send({ error: 'não encontrado' });
    if (!(await allOwned('private_labels', ids, orgId))) return reply.code(400).send({ error: 'private label inválida' });
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        await c.query('DELETE FROM private_label_contacts WHERE contact_id = $1 AND org_id = $2', [id, orgId]);
        if (ids.length) {
          await c.query(
            `INSERT INTO private_label_contacts (private_label_id, contact_id, org_id)
             SELECT unnest($1::bigint[]), $2, $3 ON CONFLICT DO NOTHING`,
            [ids, id, orgId],
          );
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; }
    });
    return { updated: true, count: ids.length };
  });
}
