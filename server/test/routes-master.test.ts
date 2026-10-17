// Usuário master (config.masterEmail): lista todas as orgs, troca a org do token
// e opera como admin nela. Qualquer outro usuário leva 403.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// config lê MASTER_EMAIL no import — tem que estar setado antes dos helpers.
const MASTER = vi.hoisted(() => {
  const email = `master.${Date.now()}@teste.com`;
  process.env.MASTER_EMAIL = email;
  return email;
});

import type { FastifyInstance } from 'fastify';
import { makeApp, register, bearer, closeAll, type Session } from './helpers.ts';

let app: FastifyInstance;
let outra: Session;
let master: Session;

beforeAll(async () => {
  app = await makeApp();
  outra = await register(app, 'master.alvo');
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { org_nome: 'Org Master', email: MASTER, senha: 'senha123' },
  });
  expect(r.statusCode).toBe(201);
  master = r.json() as Session;
});
afterAll(async () => { await closeAll(app); });

describe('master', () => {
  it('usuário comum não lista nem troca org', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/auth/orgs', headers: bearer(outra.token) })).statusCode).toBe(403);
    const r = await app.inject({
      method: 'POST', url: '/api/auth/switch-org', headers: bearer(outra.token), payload: { org_id: master.user.org_id },
    });
    expect(r.statusCode).toBe(403);
  });

  it('master troca de org e opera como admin nela', async () => {
    const orgs = await app.inject({ method: 'GET', url: '/api/auth/orgs', headers: bearer(master.token) });
    expect(orgs.statusCode).toBe(200);
    const ids = (orgs.json() as { orgs: { id: number }[] }).orgs.map((o) => Number(o.id));
    expect(ids).toContain(Number(outra.user.org_id));

    const sw = await app.inject({
      method: 'POST', url: '/api/auth/switch-org', headers: bearer(master.token), payload: { org_id: Number(outra.user.org_id) },
    });
    expect(sw.statusCode).toBe(200);
    const token = (sw.json() as { token: string }).token;

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(token) });
    const u = (me.json() as { user: { org_id: number; is_master: boolean; is_admin: boolean } }).user;
    expect(Number(u.org_id)).toBe(Number(outra.user.org_id));
    expect(u.is_master).toBe(true);
    expect(u.is_admin).toBe(true);

    // rota admin-only da org alvo responde com os dados dela
    const users = await app.inject({ method: 'GET', url: '/api/users', headers: bearer(token) });
    expect(users.statusCode).toBe(200);
  });
});
