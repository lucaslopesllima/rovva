import type { FastifyInstance } from 'fastify';
import { query } from '../db.ts';
import { requireAuth } from '../auth.ts';

// Endpoints de município usados na seleção de território (filtro da busca) e
// nos chips de cidade. Leitura global (a base de municípios não é por org).
export function municipiosRoutes(app: FastifyInstance): void {
  // municipios available for territory selection (global read).
  app.get('/api/municipios', { preHandler: requireAuth }, async () => {
    const rows = await query(
      `SELECT id, nome, uf, regiao FROM municipios ORDER BY uf, nome`,
    );
    return { municipios: rows };
  });

  // Free-text municipio search (accent-insensitive) — typeahead for territory selection.
  app.get('/api/municipios/search', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: { q: { type: 'string', minLength: 1 } },
      },
    },
  }, async (req) => {
    const { q } = req.query as { q: string };
    const term = q.trim().toLowerCase();
    const rows = await query(
      `SELECT id, nome, uf, regiao FROM municipios
       WHERE unaccent(lower(nome)) LIKE '%' || unaccent($1) || '%'
       ORDER BY (unaccent(lower(nome)) LIKE unaccent($1) || '%') DESC, nome
       LIMIT 30`,
      [term],
    );
    return { municipios: rows };
  });

  // Resolve labels for already-selected municipio ids (territory chips).
  app.get('/api/municipios/labels', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        required: ['ids'],
        properties: { ids: { type: 'string' } }, // comma-separated
      },
    },
  }, async (req) => {
    const { ids } = req.query as { ids: string };
    const parsed = ids.split(',').map((s) => parseInt(s, 10)).filter(Number.isFinite);
    if (parsed.length === 0) return { municipios: [] };
    const rows = await query(
      `SELECT id, nome, uf, regiao FROM municipios WHERE id = ANY($1::int[]) ORDER BY nome`,
      [parsed],
    );
    return { municipios: rows };
  });

  // UF list with municipio counts — for "select whole state" in territory UI.
  app.get('/api/municipios/ufs', { preHandler: requireAuth }, async () => {
    const rows = await query<{ uf: string; regiao: string; total: number }>(
      `SELECT uf, min(regiao) AS regiao, count(*)::int AS total FROM municipios GROUP BY uf ORDER BY uf`,
    );
    return { ufs: rows };
  });

  // All municipios of one UF — expands a state selection into ids/chips.
  app.get('/api/municipios/by-uf', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        required: ['uf'],
        properties: { uf: { type: 'string', minLength: 2, maxLength: 2 } },
      },
    },
  }, async (req) => {
    const { uf } = req.query as { uf: string };
    const rows = await query(
      `SELECT id, nome, uf, regiao FROM municipios WHERE uf = upper($1) ORDER BY nome`,
      [uf],
    );
    return { municipios: rows };
  });
}
