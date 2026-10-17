import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { one, pool } from '../src/db.ts';
import { config } from '../src/config.ts';

const run = Date.now();
const ownerEmail = `leads.owner.${run}@teste.com`;
let app: FastifyInstance;
let ownerToken: string;
let otherToken: string;
let leadId: string;

async function register(email: string): Promise<string> {
  const response = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { org_nome: `Org ${email}`, email, senha: 'senha123' },
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { token: string }).token;
}

const auth = (token: string): Record<string, string> => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  app = await buildApp({ logger: false, leadsAdminEmail: ownerEmail });
  await app.ready();
  ownerToken = await register(ownerEmail);
  otherToken = await register(`leads.other.${run}@teste.com`);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('pedidos de demonstração', () => {
  it('formulário público salva pedido normalizado', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/leads',
      payload: {
        nome: ' Maria Silva ', email: 'MARIA@EMPRESA.COM', telefone: ' (11) 99999-9999 ',
        empresa: ' Empresa Exemplo ', mensagem: ' Quero conhecer o sistema. ',
      },
    });
    expect(response.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/api/leads', headers: auth(ownerToken) });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { leads: Array<{ id: string; email: string; nome: string; status: string }> };
    const lead = body.leads.find((item) => item.email === 'maria@empresa.com');
    expect(lead).toMatchObject({ nome: 'Maria Silva', status: 'novo' });
    leadId = lead!.id;
  });

  it('bloqueia leitura para qualquer outro login', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/leads', headers: auth(otherToken) });
    expect(response.statusCode).toBe(403);
  });

  it('login autorizado atualiza status', async () => {
    const response = await app.inject({
      method: 'PATCH', url: `/api/leads/${leadId}`, headers: auth(ownerToken), payload: { status: 'contatado' },
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { lead: { status: string } }).lead.status).toBe('contatado');
  });
});

describe('códigos de convite (cadastro fechado)', () => {
  it('só o dono gerencia; código é de uso único', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/convites', headers: auth(otherToken) })).statusCode).toBe(403);
    const codigo = `T${run}`.slice(0, 20);
    const criado = await app.inject({ method: 'POST', url: '/api/convites', headers: auth(ownerToken), payload: { codigo: codigo.toLowerCase() } });
    expect(criado.statusCode).toBe(201);
    expect(criado.json().convite.codigo).toBe(codigo);
    expect((await app.inject({ method: 'POST', url: '/api/convites', headers: auth(ownerToken), payload: { codigo } })).statusCode).toBe(409);

    config.signupEnabled = false;
    try {
      const cad = (email: string, convite?: string) => app.inject({
        method: 'POST', url: '/api/auth/register',
        payload: { org_nome: `Convidado ${run}`, email, senha: 'senha123', ...(convite && { convite }) },
      });
      expect((await app.inject({ method: 'GET', url: '/api/config' })).json()).toEqual({ signup_enabled: false, signup_convite: true });
      expect((await cad(`conv.sem.${run}@teste.com`)).statusCode).toBe(403);
      expect((await cad(`conv.errado.${run}@teste.com`, 'NAOEXISTE')).statusCode).toBe(403);
      // Código inválido não deixa usuário nem org para trás.
      const sobra = await pool.query(
        `SELECT (SELECT count(*) FROM users WHERE email LIKE $1)::int AS u,
                (SELECT count(*) FROM organizations WHERE nome = $2)::int AS o`, [`conv.%.${run}@teste.com`, `Convidado ${run}`]);
      expect(sobra.rows[0]).toEqual({ u: 0, o: 0 });
      expect((await cad(`conv.ok.${run}@teste.com`, ` ${codigo.toLowerCase()} `)).statusCode).toBe(201);
      expect((await cad(`conv.reuso.${run}@teste.com`, codigo)).statusCode).toBe(403);
    } finally {
      config.signupEnabled = true;
    }

    const lista = (await app.inject({ method: 'GET', url: '/api/convites', headers: auth(ownerToken) })).json().convites;
    expect(lista.find((c: { codigo: string }) => c.codigo === codigo)).toMatchObject({ org_nome: `Convidado ${run}` });
    expect((await app.inject({ method: 'DELETE', url: `/api/convites/${codigo}`, headers: auth(ownerToken) })).statusCode).toBe(404);
  });

  it('landing conta visita do dia', async () => {
    const dia = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;
    const before = (await one<{ visitas: number }>(`SELECT visitas FROM landing_visits WHERE dia = ${dia}`))?.visitas ?? 0;
    const response = await app.inject({ method: 'POST', url: '/api/landing/visit' });
    expect(response.statusCode).toBe(204);
    const after = await one<{ visitas: number }>(`SELECT visitas FROM landing_visits WHERE dia = ${dia}`);
    expect(after!.visitas).toBe(before + 1);
  });

  it('libera Referer cross-origin (OSM bloqueia tiles sem ele)', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/landing/visit' });
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
