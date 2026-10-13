// Busca por CNPJ completo na prospecção: a recomendação esconde quem já está no
// funil e quem está fora do território. Sem o cnpj_match a tela dizia "nenhuma
// empresa" para um CNPJ que existe na base.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeApp, register, bearer, makeCompany, closeAll, type Session } from './helpers.ts';
import { query } from '../src/db.ts';

const CAMPINAS = 3509502;
const SAO_PAULO = 3550308;

let app: FastifyInstance;
let a: Session;
let id = 0;
let cnpj = '';

const rec = (munis: number, q: string): ReturnType<FastifyInstance['inject']> =>
  app.inject({ method: 'GET', url: `/api/recommend?munis=${munis}&q=${encodeURIComponent(q)}`, headers: bearer(a.token) });
const mask = (d: string): string => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

beforeAll(async () => {
  app = await makeApp();
  a = await register(app, 'rec.cnpj');
  id = await makeCompany({ municipioId: CAMPINAS, lat: -22.9, lon: -47.06 });
  cnpj = (await query<{ cnpj: string }>('SELECT cnpj FROM companies WHERE id = $1', [id]))[0]!.cnpj;
});

afterAll(() => closeAll(app));

describe('recommend: cnpj_match', () => {
  it('CNPJ que aparece na lista não traz cnpj_match', async () => {
    const r = (await rec(CAMPINAS, mask(cnpj))).json() as { results: { id: number }[]; cnpj_match: unknown };
    expect(r.results.map((x) => Number(x.id))).toContain(id);
    expect(r.cnpj_match).toBeNull();
  });

  it('fora do território: devolve a empresa com in_funnel=false', async () => {
    const r = (await rec(SAO_PAULO, mask(cnpj))).json() as { results: unknown[]; cnpj_match: { id: number; in_funnel: boolean } };
    expect(r.results).toHaveLength(0);
    expect(Number(r.cnpj_match.id)).toBe(id);
    expect(r.cnpj_match.in_funnel).toBe(false);
  });

  it('já no funil: some da lista e volta com in_funnel=true', async () => {
    await query('INSERT INTO company_relationships (org_id, company_id) VALUES ($1, $2)', [a.user.org_id, id]);
    const r = (await rec(CAMPINAS, mask(cnpj))).json() as { results: unknown[]; cnpj_match: { id: number; in_funnel: boolean } };
    expect(r.results).toHaveLength(0);
    expect(Number(r.cnpj_match.id)).toBe(id);
    expect(r.cnpj_match.in_funnel).toBe(true);
  });
});
