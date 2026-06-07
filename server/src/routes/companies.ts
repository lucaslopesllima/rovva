import type { FastifyInstance } from 'fastify';
import { one } from '../db.ts';
import { requireAuth } from '../auth.ts';

// Read-only lookup into the global companies pool (mesma fonte do recommend/funil).
export function companyRoutes(app: FastifyInstance): void {
  app.get('/api/companies/:id', {
    preHandler: requireAuth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const company = await one(
      `SELECT c.id, c.cnpj, c.razao_social, c.nome_fantasia,
              c.cnae_principal, cr.descricao AS cnae_descricao, c.cnae_secundarios,
              c.uf, c.municipio_id, m.nome AS cidade, c.regiao,
              c.porte, c.capital_social, c.situacao_cadastral, c.source,
              ST_Y(c.geom::geometry) AS lat, ST_X(c.geom::geometry) AS lon,
              c.raw_data
       FROM companies c
       LEFT JOIN municipios m ON m.id = c.municipio_id
       LEFT JOIN cnae_reference cr ON cr.codigo = c.cnae_principal
       WHERE c.id = $1`,
      [id],
    );
    if (!company) return reply.code(404).send({ error: 'empresa não encontrada' });
    return { company };
  });
}
