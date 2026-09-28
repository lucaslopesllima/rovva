// POST/GET /api/companies/:id/contatos-site — mapeamento do site em segundo
// plano. O mapeamento em si é testado em contatos-site.test.ts; aqui só o
// contrato da rota: auth, trava da URL (só site achado pelo servidor), estados
// salvos (lendo -> pronto/erro/interrompido) e que nada vira contato sozinho.
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const { buscarContatosNoSite } = vi.hoisted(() => ({ buscarContatosNoSite: vi.fn() }));
vi.mock('../src/contatos_site.ts', () => ({ buscarContatosNoSite }));

const { makeApp, register, bearer, makeCompany, closeAll } = await import('./helpers.ts');
const { query } = await import('../src/db.ts');

let app: FastifyInstance;
let s: Awaited<ReturnType<typeof register>>;
beforeAll(async () => { app = await makeApp(); s = await register(app, 'co-cts'); });
beforeEach(() => buscarContatosNoSite.mockReset());
afterAll(() => closeAll(app));

const SITE = 'https://www.acme.com.br/';

// Empresa com o site já achado pela investigação (rota dominio).
const comSite = async (campo: 'site' | 'resultado' = 'site', url = SITE): Promise<number> => {
  const id = await makeCompany({ razao: 'ACME LTDA' });
  const v = campo === 'site' ? { site_url: url } : { local: { site: url } };
  await query(`INSERT INTO company_busca_web (company_id, ${campo}) VALUES ($1, $2)`, [id, JSON.stringify(v)]);
  return id;
};

const iniciar = (id: number, siteUrl = SITE, token = s.token) =>
  app.inject({ method: 'POST', url: `/api/companies/${id}/contatos-site`, headers: bearer(token), payload: { site_url: siteUrl } });
const estado = async (id: number) =>
  (await app.inject({ method: 'GET', url: `/api/companies/${id}/contatos-site`, headers: bearer(s.token) })).json().contatos_site;
const terminar = (id: number) => vi.waitFor(async () => expect((await estado(id)).status).not.toBe('lendo'));

const contato = {
  nome: 'Silvio Zanon', cargo: 'Gerente', rotulo: 'Departamento Técnico',
  email: 'silvio@acme.com.br', telefone: '4935417021', whatsapp: '49988321048',
  origem: 'https://www.acme.com.br/contato',
};

describe('contatos-site (mapeamento em segundo plano)', () => {
  it('POST responde na hora com "lendo"; o GET acompanha até "pronto"', async () => {
    const id = await comSite();
    let fim!: (v: unknown) => void;
    buscarContatosNoSite.mockImplementationOnce((_u: string, aoLer: (n: number) => void) => {
      aoLer(3);
      return new Promise((r) => { fim = r; });
    });

    const r = await iniciar(id);
    expect(r.statusCode).toBe(202);
    expect(r.json()).toEqual({ url: SITE, status: 'lendo', paginas_lidas: 0 });
    await vi.waitFor(async () => expect(await estado(id)).toMatchObject({ status: 'lendo', paginas_lidas: 3 }));

    fim({ contatos: [contato], paginas: [SITE], bloqueado: false });
    await terminar(id);
    expect(await estado(id)).toEqual({ url: SITE, status: 'pronto', contatos: [contato], paginas: [SITE], bloqueado: false });
    expect(buscarContatosNoSite).toHaveBeenCalledWith(SITE, expect.any(Function));
  });

  it('site do Google Maps salvo também vale', async () => {
    const id = await comSite('resultado', 'https://maps.acme.com.br/');
    buscarContatosNoSite.mockResolvedValueOnce({ contatos: [], paginas: [], bloqueado: false });
    expect((await iniciar(id, 'https://maps.acme.com.br/')).statusCode).toBe(202);
    await terminar(id);
    expect((await estado(id)).status).toBe('pronto');
  });

  // A linha é vista por todas as organizações: URL arbitrária do navegador não roda.
  it('URL que o servidor não achou -> 400, sem mapear', async () => {
    const id = await comSite();
    const r = await iniciar(id, 'https://golpe.example.com/');
    expect(r.statusCode).toBe(400);
    expect(buscarContatosNoSite).not.toHaveBeenCalled();
  });

  it('falha no mapeamento vira "erro", não fica lendo', async () => {
    const id = await comSite();
    buscarContatosNoSite.mockRejectedValueOnce(new Error('navegador caiu'));
    await iniciar(id);
    await terminar(id);
    expect((await estado(id)).status).toBe('erro');
  });

  it('"lendo" salvo sem job vivo (app reiniciou) -> interrompido', async () => {
    const id = await comSite();
    await query(`UPDATE company_busca_web SET contatos_site = '{"url":"x","status":"lendo"}' WHERE company_id = $1`, [id]);
    expect((await estado(id)).status).toBe('interrompido');
  });

  it('investigar de novo no meio: resultado velho não sobrescreve', async () => {
    const id = await comSite();
    let fim!: (v: unknown) => void;
    buscarContatosNoSite.mockImplementationOnce(() => new Promise((r) => { fim = r; }));
    await iniciar(id);
    await query('UPDATE company_busca_web SET contatos_site = NULL WHERE company_id = $1', [id]); // rota dominio
    fim({ contatos: [contato], paginas: [SITE], bloqueado: false });
    await new Promise((r) => setTimeout(r, 50));
    expect(await estado(id)).toBeNull();
  });

  it('nada vira contato sozinho', async () => {
    const id = await comSite();
    buscarContatosNoSite.mockResolvedValueOnce({ contatos: [contato], paginas: [SITE], bloqueado: false });
    await iniciar(id);
    await terminar(id);
    const linhas = await query<{ n: string }>('SELECT count(*) AS n FROM contacts WHERE email = $1', [contato.email]);
    expect(Number(linhas[0]!.n)).toBe(0);
  });

  it('URL ausente -> 400; sem token -> 401', async () => {
    const id = await comSite();
    const semUrl = await app.inject({ method: 'POST', url: `/api/companies/${id}/contatos-site`, headers: bearer(s.token), payload: {} });
    expect(semUrl.statusCode).toBe(400);
    const semToken = await app.inject({ method: 'POST', url: `/api/companies/${id}/contatos-site`, payload: { site_url: SITE } });
    expect(semToken.statusCode).toBe(401);
    expect(buscarContatosNoSite).not.toHaveBeenCalled();
  });
});
