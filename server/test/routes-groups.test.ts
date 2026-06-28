// RBAC fino por grupo: catálogo de permissões, CRUD de grupos, e o enforcement
// de requirePermission (403 sem a permissão, 201 com ela, bypass do admin).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeApp, register, bearer, mail, makeCompany, closeAll, type Session } from './helpers.ts';

let app: FastifyInstance;
let a: Session;     // org A (admin)

const inj = (s: Session, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown):
  ReturnType<FastifyInstance['inject']> =>
  app.inject({ method, url, headers: bearer(s.token), payload });

// Cria um usuário no grupo informado e devolve a sessão logada.
async function userInGroup(tag: string, groupId: number | null): Promise<Session> {
  const email = mail(tag);
  const r = await inj(a, 'POST', '/api/users', { nome: tag, email, senha: 'provisoria1', group_id: groupId });
  expect(r.statusCode).toBe(201);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, senha: 'provisoria1' } });
  return login.json() as Session;
}

beforeAll(async () => {
  app = await makeApp();
  a = await register(app, 'grp.a');
});
afterAll(async () => { await closeAll(app); });

describe('catálogo e grupos padrão', () => {
  it('catálogo lista os códigos do sistema', async () => {
    const r = await inj(a, 'GET', '/api/permissions/catalog');
    expect(r.statusCode).toBe(200);
    const codes = (r.json() as { permissions: { code: string }[] }).permissions.map((p) => p.code);
    expect(codes).toContain('orders.create');
    expect(codes).toContain('groups.list');
  });

  it('register semeia os grupos padrão da org', async () => {
    const r = await inj(a, 'GET', '/api/groups');
    expect(r.statusCode).toBe(200);
    const nomes = (r.json() as { groups: { nome: string; is_admin: boolean }[] }).groups.map((g) => g.nome);
    expect(nomes).toEqual(expect.arrayContaining(['Administrador', 'Vendedor', 'Gerente', 'Financeiro']));
  });
});

describe('enforcement por permissão', () => {
  it('403 sem a permissão, 201 com ela, admin faz bypass', async () => {
    // grupo só-leitura de pedidos
    const created = await inj(a, 'POST', '/api/groups', {
      nome: 'Leitura Pedidos', permissions: ['orders.list', 'orders.read'],
    });
    expect(created.statusCode).toBe(201);
    const gid = Number((created.json() as { group: { id: number } }).group.id);

    const leitor = await userInGroup('grp.leitor', gid);
    expect((await inj(leitor, 'GET', '/api/orders')).statusCode).toBe(200);          // tem orders.list
    // corpo válido (passa o schema) mas sem relationships.create → barra no preHandler
    const cid = await makeCompany();
    expect((await inj(leitor, 'POST', '/api/relationships', { company_id: cid })).statusCode).toBe(403);

    // concede relationships.create e o usuário passa a criar
    const upd = await inj(a, 'PATCH', `/api/groups/${gid}`, {
      permissions: ['orders.list', 'orders.read', 'relationships.create'],
    });
    expect(upd.statusCode).toBe(200);
    // o token do leitor segue válido e relê as permissões atualizadas a cada request.
    const novo = await inj(leitor, 'POST', '/api/relationships', { company_id: cid });
    expect(novo.statusCode).toBe(201);

    // admin cria pedido-relacionamento sem ter permissão explícita (bypass)
    const cid2 = await makeCompany();
    expect((await inj(a, 'POST', '/api/relationships', { company_id: cid2 })).statusCode).toBe(201);
  });

  it('sem groups.list o usuário não acessa a API de grupos', async () => {
    // Vendedor padrão não tem groups.list
    const vend = await userInGroup('grp.vend', null); // null → grupo padrão (Vendedor) pelo papel rep
    expect((await inj(vend, 'GET', '/api/groups')).statusCode).toBe(403);
  });
});

describe('CRUD de grupos: proteções', () => {
  it('não exclui grupo em uso nem o Administrador; exclui grupo vazio', async () => {
    const g = await inj(a, 'POST', '/api/groups', { nome: 'Descartável', permissions: [] });
    const gid = Number((g.json() as { group: { id: number } }).group.id);

    // com usuário dentro → 409
    await userInGroup('grp.tmp', gid);
    expect((await inj(a, 'DELETE', `/api/groups/${gid}`)).statusCode).toBe(409);

    // grupo Administrador é fixo
    const groups = (await inj(a, 'GET', '/api/groups')).json() as { groups: { id: number; is_admin: boolean }[] };
    const adminId = groups.groups.find((x) => x.is_admin)!.id;
    expect((await inj(a, 'PATCH', `/api/groups/${adminId}`, { nome: 'x' })).statusCode).toBe(400);
    expect((await inj(a, 'DELETE', `/api/groups/${adminId}`)).statusCode).toBe(400);

    // grupo vazio sem usuários → 200
    const vazio = await inj(a, 'POST', '/api/groups', { nome: 'Vazio', permissions: [] });
    const vid = Number((vazio.json() as { group: { id: number } }).group.id);
    expect((await inj(a, 'DELETE', `/api/groups/${vid}`)).statusCode).toBe(200);
  });

  it('códigos inválidos são descartados ao salvar', async () => {
    const g = await inj(a, 'POST', '/api/groups', { nome: 'Filtra', permissions: ['orders.list', 'inexistente.xpto'] });
    expect(g.statusCode).toBe(201);
    expect((g.json() as { group: { permissions: string[] } }).group.permissions).toEqual(['orders.list']);
  });
});
