// GET /api/companies/:id/dominio — descoberta do site próprio sob demanda.
// A descoberta em si é testada em enriquecimento.test.ts; aqui só o contrato da
// rota: auth, 404 e o repasse do resultado.
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const { descobrirDominio, buscarNaWeb } = vi.hoisted(() => ({ descobrirDominio: vi.fn(), buscarNaWeb: vi.fn() }));
vi.mock('../src/enriquecimento.ts', () => ({ descobrirDominio }));
vi.mock('../src/busca_web.ts', async (orig) => ({
  ...(await orig<typeof import('../src/busca_web.ts')>()), buscarNaWeb,
}));
const { BuscaWebDesligadaError } = await import('../src/busca_web.ts');

const { makeApp, register, bearer, makeCompany, closeAll } = await import('./helpers.ts');

let app: FastifyInstance;
let s: Awaited<ReturnType<typeof register>>;
beforeAll(async () => { app = await makeApp(); s = await register(app, 'co-dom'); });
beforeEach(() => descobrirDominio.mockClear());
afterAll(() => closeAll(app));

const buscar = (id: number, token = s.token) =>
  app.inject({ method: 'GET', url: `/api/companies/${id}/dominio`, headers: bearer(token) });

describe('GET /api/companies/:id/dominio', () => {
  it('devolve o domínio encontrado', async () => {
    const id = await makeCompany({ razao: 'ACME LTDA', fantasia: 'ACME' });
    const achado = {
      dominio: 'acme.com.br', site_url: 'https://www.acme.com.br/', site_status: 'vivo',
      status: 'achou', fonte: 'registrobr', confianca: 100,
    };
    descobrirDominio.mockResolvedValueOnce(achado);
    const r = await buscar(id);
    expect(r.statusCode).toBe(200);
    expect(r.json().dominio).toEqual(achado);
    // a rota passa o CNPJ e os nomes — é deles que saem os candidatos
    expect(descobrirDominio).toHaveBeenCalledWith(
      expect.objectContaining({ id, razao_social: 'ACME LTDA', nome_fantasia: 'ACME' }),
    );
  });

  it('salva o site e zera contatos lidos do site anterior; detalhe devolve', async () => {
    const id = await makeCompany({ razao: 'SALVA LTDA' });
    const { query } = await import('../src/db.ts');
    await query(`INSERT INTO company_busca_web (company_id, contatos_site) VALUES ($1, '{"url":"https://velho.com.br/"}')`, [id]);
    const achado = { dominio: 'salva.com.br', site_url: 'https://salva.com.br/', status: 'achou' };
    descobrirDominio.mockResolvedValueOnce(achado);
    await buscar(id);

    const det = (await app.inject({ method: 'GET', url: `/api/companies/${id}`, headers: bearer(s.token) })).json();
    expect(det.site).toEqual(achado);
    expect(det.contatos_site).toBeNull();
    expect(det.busca_web).toBeNull(); // Serper ainda não rodou
  });

  it('não encontrado devolve dominio null, não 404', async () => {
    const id = await makeCompany();
    descobrirDominio.mockResolvedValueOnce({
      dominio: null, site_url: null, site_status: null,
      status: 'nao_encontrado', fonte: 'registrobr', confianca: 0,
    });
    const r = await buscar(id);
    expect(r.statusCode).toBe(200);
    expect(r.json().dominio).toMatchObject({ dominio: null, status: 'nao_encontrado' });
  });

  it('empresa inexistente -> 404', async () => {
    const r = await buscar(999_999_999);
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe('empresa não encontrada');
    expect(descobrirDominio).not.toHaveBeenCalled();
  });

  it('sem token -> 401', async () => {
    const id = await makeCompany();
    const r = await app.inject({ method: 'GET', url: `/api/companies/${id}/dominio` });
    expect(r.statusCode).toBe(401);
  });
});

describe('GET /api/companies/:id/busca-web', () => {
  const web = (id: number) =>
    app.inject({ method: 'GET', url: `/api/companies/${id}/busca-web`, headers: bearer(s.token) });
  beforeEach(() => buscarNaWeb.mockReset());

  it('repassa o resultado, com nome e cidade da empresa', async () => {
    const id = await makeCompany({ razao: 'ACME LTDA', fantasia: 'ACME' });
    const achado = { local: null, redes: [{ rede: 'instagram', url: 'https://www.instagram.com/acme' }], contatos: [], links: [] };
    buscarNaWeb.mockResolvedValueOnce(achado);
    const r = await web(id);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ...achado, buscado_em: expect.any(String) });
    expect(buscarNaWeb).toHaveBeenCalledWith(expect.objectContaining({ razao_social: 'ACME LTDA', nome_fantasia: 'ACME', socios: [] }));
  });

  it('salva o resultado: 2ª chamada e o detalhe vêm do banco; atualizar refaz', async () => {
    const id = await makeCompany({ razao: 'CACHE LTDA' });
    const res = (n: number) => ({ local: null, redes: [], contatos: [], links: [{ titulo: `v${n}`, url: 'https://x.com' }], socios: [], pessoas: [] });
    buscarNaWeb.mockResolvedValueOnce(res(1)).mockResolvedValueOnce(res(2));

    const a = (await web(id)).json();
    expect(a.links[0].titulo).toBe('v1');
    expect(a.buscado_em).toBeTruthy();
    expect((await web(id)).json().links[0].titulo).toBe('v1');
    expect(buscarNaWeb).toHaveBeenCalledTimes(1);

    const det = await app.inject({ method: 'GET', url: `/api/companies/${id}`, headers: bearer(s.token) });
    expect(det.json().busca_web).toMatchObject({ links: [{ titulo: 'v1' }], buscado_em: expect.any(String) });

    const b = await app.inject({ method: 'GET', url: `/api/companies/${id}/busca-web?atualizar=true`, headers: bearer(s.token) });
    expect(b.json().links[0].titulo).toBe('v2');
    expect((await web(id)).json().links[0].titulo).toBe('v2');
    expect(buscarNaWeb).toHaveBeenCalledTimes(2);
  });

  it('sem chave -> 503; falha do Serper -> 502', async () => {
    const id = await makeCompany();
    buscarNaWeb.mockRejectedValueOnce(new BuscaWebDesligadaError());
    expect((await web(id)).statusCode).toBe(503);
    buscarNaWeb.mockRejectedValueOnce(new Error('x'));
    expect((await web(id)).statusCode).toBe(502);
  });

  it('empresa inexistente -> 404, sem gastar busca', async () => {
    expect((await web(999_999_999)).statusCode).toBe(404);
    expect(buscarNaWeb).not.toHaveBeenCalled();
  });
});
