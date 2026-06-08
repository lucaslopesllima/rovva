import type { FastifyInstance } from 'fastify';
import { one, query } from '../db.ts';
import { requireAuth } from '../auth.ts';

export function profileRoutes(app: FastifyInstance): void {
  app.get('/api/profile', { preHandler: requireAuth }, async (req) => {
    const orgId = req.auth!.orgId;
    const profile = await one(
      `SELECT org_id, cnaes_alvo, territorio_municipios, territorio_raio_km, pesos,
              origem_endereco, origem_lat, origem_lon
       FROM target_profiles WHERE org_id = $1`,
      [orgId],
    );
    return { profile };
  });

  app.put('/api/profile', {
    preHandler: requireAuth,
    schema: {
      body: {
        type: 'object',
        properties: {
          cnaes_alvo: { type: 'array', items: { type: 'integer' } },
          territorio_municipios: { type: 'array', items: { type: 'integer' } },
          territorio_raio_km: { type: ['integer', 'null'] },
          pesos: { type: 'object' },
          origem_endereco: { type: ['string', 'null'] },
          origem_lat: { type: ['number', 'null'] },
          origem_lon: { type: ['number', 'null'] },
        },
      },
    },
  }, async (req) => {
    const orgId = req.auth!.orgId;
    const b = req.body as {
      cnaes_alvo?: number[];
      territorio_municipios?: number[];
      territorio_raio_km?: number | null;
      pesos?: Record<string, number>;
      origem_endereco?: string | null;
      origem_lat?: number | null;
      origem_lon?: number | null;
    };
    const hasOrigem = 'origem_endereco' in b || 'origem_lat' in b || 'origem_lon' in b;
    const rows = await query(
      `INSERT INTO target_profiles (org_id, cnaes_alvo, territorio_municipios, territorio_raio_km, pesos,
                                    origem_endereco, origem_lat, origem_lon)
       VALUES ($1, COALESCE($2::int[],'{}'::int[]), COALESCE($3::int[],'{}'::int[]), $4::int,
               COALESCE($5::jsonb,'{"cnae":0.5,"proximidade":0.3,"porte":0.2}'::jsonb),
               $7::text, $8::double precision, $9::double precision)
       ON CONFLICT (org_id) DO UPDATE SET
         cnaes_alvo = COALESCE($2::int[], target_profiles.cnaes_alvo),
         territorio_municipios = COALESCE($3::int[], target_profiles.territorio_municipios),
         territorio_raio_km = $4::int,
         pesos = COALESCE($5::jsonb, target_profiles.pesos),
         origem_endereco = CASE WHEN $6 THEN $7::text ELSE target_profiles.origem_endereco END,
         origem_lat = CASE WHEN $6 THEN $8::double precision ELSE target_profiles.origem_lat END,
         origem_lon = CASE WHEN $6 THEN $9::double precision ELSE target_profiles.origem_lon END
       RETURNING org_id, cnaes_alvo, territorio_municipios, territorio_raio_km, pesos,
                 origem_endereco, origem_lat, origem_lon`,
      [orgId, b.cnaes_alvo ?? null, b.territorio_municipios ?? null, b.territorio_raio_km ?? null,
        b.pesos ? JSON.stringify(b.pesos) : null,
        hasOrigem, b.origem_endereco ?? null, b.origem_lat ?? null, b.origem_lon ?? null],
    );
    return { profile: rows[0] };
  });

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

  // Resolve labels for already-selected municipio ids (profile UI chips).
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
