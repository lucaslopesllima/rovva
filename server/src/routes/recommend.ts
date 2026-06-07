import type { FastifyInstance } from 'fastify';
import { one, withClient } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { config } from '../config.ts';
import { buildRecommendQuery, type RecommendProfile } from '../sql/recommend.ts';

export function recommendRoutes(app: FastifyInstance): void {
  app.get('/api/recommend', {
    preHandler: requireAuth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req, reply) => {
    const orgId = req.auth!.orgId;
    const { limit = 20, offset = 0 } = req.query as { limit?: number; offset?: number };

    const profile = await one<RecommendProfile>(
      `SELECT cnaes_alvo, territorio_municipios, territorio_raio_km, pesos
       FROM target_profiles WHERE org_id = $1`,
      [orgId],
    );
    if (!profile) return reply.code(400).send({ error: 'perfil-alvo não configurado' });
    if ((!profile.territorio_municipios || profile.territorio_municipios.length === 0)) {
      return reply.code(400).send({ error: 'defina o território (municípios) no perfil-alvo' });
    }

    const { text, params } = buildRecommendQuery({ orgId, profile, limit, offset });

    // Run in a tx on a single connection so SET LOCAL work_mem applies to the recommendation sort.
    const result = await withClient(async (client) => {
      await client.query('BEGIN');
      await client.query(`SET LOCAL work_mem = '${config.recommendWorkMem}'`);
      const r = await client.query(text, params);
      await client.query('COMMIT');
      return r.rows;
    });

    return { results: result, page: { limit, offset, count: result.length } };
  });
}
