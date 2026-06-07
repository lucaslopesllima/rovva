import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { requireAuth } from '../auth.ts';

export function cnaeRoutes(app: FastifyInstance): void {
  // Free-text CNAE resolution: trigram over descriptions + synonym dictionary. No NLP.
  app.get('/api/cnae/search', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: { q: { type: 'string', minLength: 2 } },
      },
    },
  }, async (req) => {
    const { q } = req.query as { q: string };
    const term = q.trim().toLowerCase();

    const rows = await query<{ codigo: number; descricao: string; secao: string; divisao: number }>(
      `WITH syn AS (
         SELECT unnest(cnae_codigos) AS codigo
         FROM cnae_sinonimos
         WHERE termo = $1 OR termo LIKE '%' || $1 || '%' OR $1 LIKE '%' || termo || '%'
       ),
       matches AS (
         SELECT codigo FROM syn
         UNION
         SELECT codigo FROM cnae_reference WHERE descricao ILIKE '%' || $1 || '%'
         UNION
         SELECT codigo FROM cnae_reference WHERE similarity(lower(descricao), $1) > 0.2
       )
       SELECT cr.codigo, cr.descricao, cr.secao, cr.divisao
       FROM cnae_reference cr
       JOIN matches m ON m.codigo = cr.codigo
       ORDER BY cr.divisao, cr.codigo
       LIMIT 100`,
      [term],
    );

    // Group by divisao so the UI can show fabricação (indústria) vs comércio etc.
    const grupos = new Map<number, { divisao: number; secao: string; itens: typeof rows }>();
    for (const r of rows) {
      let g = grupos.get(r.divisao);
      if (!g) { g = { divisao: r.divisao, secao: r.secao, itens: [] }; grupos.set(r.divisao, g); }
      g.itens.push(r);
    }
    return { grupos: [...grupos.values()] };
  });

  // Resolve labels for already-selected CNAE codes (profile UI chips).
  app.get('/api/cnae/labels', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        required: ['codes'],
        properties: { codes: { type: 'string' } }, // comma-separated
      },
    },
  }, async (req) => {
    const { codes } = req.query as { codes: string };
    const ints = codes.split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
    if (ints.length === 0) return { labels: [] };
    const rows = await query(
      `SELECT codigo, descricao, secao, divisao FROM cnae_reference WHERE codigo = ANY($1::int[])`,
      [ints],
    );
    return { labels: rows };
  });
}
