// Planejador de rotas: /optimize (origem, veículo, geocode, OSRM mockado,
// erros) e persistência (POST/GET/DELETE /api/routes).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { query } from '../src/db.ts';
import { makeApp, register, bearer, makeCompany, closeAll, type Session } from './helpers.ts';

const SP = 3550308;

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

let app: FastifyInstance;
let a: Session;
let b: Session;
let c1: number;
let c2: number;

// resposta OSRM /trip p/ origem + 2 paradas, visitadas na ordem invertida (2,1)
const osrmOk = {
  code: 'Ok',
  trips: [{
    distance: 30_000, duration: 3_600,
    geometry: { coordinates: [[-46.6, -23.5], [-46.7, -23.6], [-46.8, -23.7]] },
    legs: [{ distance: 10_000, duration: 1_200 }, { distance: 12_000, duration: 1_300 },
      { distance: 8_000, duration: 1_100 }],
  }],
  waypoints: [{ waypoint_index: 0 }, { waypoint_index: 2 }, { waypoint_index: 1 }],
};

beforeAll(async () => {
  app = await makeApp();
  a = await register(app, 'rota.a');
  b = await register(app, 'rota.b');
  c1 = await makeCompany({ municipioId: SP, lat: -23.55, lon: -46.63 });
  c2 = await makeCompany({ municipioId: SP, lat: -23.60, lon: -46.70 });
  // geocode pré-cacheado: o optimize não toca Nominatim (só o OSRM é mockado)
  for (const [cid, lat, lon] of [[c1, -23.55, -46.63], [c2, -23.60, -46.70]] as const) {
    await query(
      `INSERT INTO company_geocode (company_id, lat, lon, precisao, fonte)
       VALUES ($1,$2,$3,'rua','nominatim') ON CONFLICT (company_id) DO NOTHING`,
      [cid, lat, lon]);
  }
});
afterAll(async () => { vi.unstubAllGlobals(); await closeAll(app); });

const inj = (s: Session, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown):
  ReturnType<FastifyInstance['inject']> =>
  app.inject({ method, url, headers: bearer(s.token), payload });

const setOrigem = (s: Session): Promise<unknown> =>
  query('UPDATE organizations SET origem_lat = -23.5, origem_lon = -46.6 WHERE id = $1', [s.user.org_id]);

describe('POST /api/routes/optimize', () => {
  it('sem origem cadastrada -> 400', async () => {
    const r = await inj(a, 'POST', '/api/routes/optimize', { company_ids: [c1] });
    expect(r.statusCode).toBe(400);
  });

  it('veículo de outra org -> 404; empresa sem localização -> 400', async () => {
    await setOrigem(a);
    const vb = (await app.inject({ method: 'POST', url: '/api/vehicles', headers: bearer(b.token),
      payload: { nome: 'Carro B', consumo_kml: 10 } })).json() as { vehicle: { id: number } };
    expect((await inj(a, 'POST', '/api/routes/optimize',
      { company_ids: [c1], vehicle_id: vb.vehicle.id })).statusCode).toBe(404);

    // empresa sem geocode nem geom -> nenhuma localizada
    const semGeo = await makeCompany();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) }); // nominatim falha
    expect((await inj(a, 'POST', '/api/routes/optimize',
      { company_ids: [semGeo] })).statusCode).toBe(400);
  });

  it('OSRM indisponível -> 502 (status e code!=Ok)', async () => {
    await setOrigem(a);
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    expect((await inj(a, 'POST', '/api/routes/optimize', { company_ids: [c1, c2] })).statusCode).toBe(502);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ code: 'NoRoute' }) });
    expect((await inj(a, 'POST', '/api/routes/optimize', { company_ids: [c1, c2] })).statusCode).toBe(502);
  });

  it('sucesso: ordem otimizada, métricas, combustível e skipped', async () => {
    await setOrigem(a);
    const v = (await inj(a, 'POST', '/api/vehicles',
      { nome: 'Fiorino', consumo_kml: 10, preco_litro: 6 }) as Awaited<ReturnType<FastifyInstance['inject']>>)
      .json() as { vehicle: { id: number } };

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, json: async () => osrmOk });
    const r = await inj(a, 'POST', '/api/routes/optimize',
      { company_ids: [c1, c2, c1], vehicle_id: v.vehicle.id }); // c1 duplicado -> dedup
    expect(r.statusCode).toBe(200);
    const j = r.json() as {
      stops: { company_id: number; seq: number; leg_dist_km: number | null }[];
      dist_km: number; litros: number | null; custo_total: number | null; skipped: number[];
    };
    expect(j.dist_km).toBe(30);
    expect(j.litros).toBe(3);        // 30km / 10km-l
    expect(j.custo_total).toBe(18);  // 3l * R$6
    expect(j.skipped).toEqual([]);
    // waypoint_index inverte a ordem: c2 visitada antes de c1
    expect(j.stops.map((s) => s.company_id)).toEqual([c2, c1]);
    expect(j.stops[0]!.leg_dist_km).not.toBeNull();
  });
});

describe('optimize: geocodificação sob demanda', () => {
  it('origem geocodificada do endereço da org + empresa geocodificada na hora', async () => {
    const fresh = await register(app, 'rota.geo');
    // org com endereço mas sem origem cacheada
    await app.inject({ method: 'PATCH', url: '/api/account', headers: bearer(fresh.token),
      payload: { logradouro: 'Av. C', numero: '5', cidade: 'São Paulo', uf: 'SP' } });
    // empresa com endereço e sem cache de geocode
    const cid = await makeCompany({ municipioId: SP, lat: -23.58, lon: -46.66 });
    await query(`UPDATE companies SET logradouro = 'Rua D', numero = '9', cep = '01001000' WHERE id = $1`, [cid]);

    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('nominatim')) {
        return { ok: true, json: async () => ([{ lat: '-23.52', lon: '-46.62', addresstype: 'building' }]) };
      }
      return { ok: true, json: async () => osrmOk }; // OSRM
    });

    const r = await app.inject({ method: 'POST', url: '/api/routes/optimize', headers: bearer(fresh.token),
      payload: { company_ids: [cid, c1] } });
    expect(r.statusCode).toBe(200);
    // geocode da empresa foi cacheado
    const cached = await query('SELECT precisao FROM company_geocode WHERE company_id = $1', [cid]);
    expect(cached).toHaveLength(1);
    // origem da org foi cacheada
    const org = await query<{ origem_lat: number | null }>(
      'SELECT origem_lat FROM organizations WHERE id = $1', [fresh.user.org_id]);
    expect(org[0]!.origem_lat).not.toBeNull();
  });

  it('empresa sem endereço cai no centroide do município (sem cache)', async () => {
    await setOrigem(a);
    const soCentroide = await makeCompany({ municipioId: SP, lat: -23.57, lon: -46.64 });
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: unknown) =>
      String(url).includes('nominatim')
        ? { ok: false, json: async () => ({}) }
        : { ok: true, json: async () => osrmOk });
    const r = await app.inject({ method: 'POST', url: '/api/routes/optimize', headers: bearer(a.token),
      payload: { company_ids: [soCentroide, c1] } });
    expect(r.statusCode).toBe(200);
    expect(await query('SELECT 1 FROM company_geocode WHERE company_id = $1', [soCentroide])).toHaveLength(0);
  });
});

describe('POST/GET/DELETE /api/routes', () => {
  it('stop com empresa inexistente -> FK estoura, ROLLBACK e 500', async () => {
    const r = await inj(a, 'POST', '/api/routes', {
      nome: 'Rota Quebrada', origem_lat: -23.5, origem_lon: -46.6,
      stops: [{ company_id: 999_999_999, seq: 0, lat: -23.6, lon: -46.7 }],
    });
    expect(r.statusCode).toBe(500);
    const list = await inj(a, 'GET', '/api/routes');
    expect((list.json() as { routes: { nome: string }[] }).routes
      .some((x) => x.nome === 'Rota Quebrada')).toBe(false); // rollback
  });

  it('persiste, lista, detalha e apaga; veículo alheio 404; rota alheia 404', async () => {
    const vb = (await app.inject({ method: 'POST', url: '/api/vehicles', headers: bearer(b.token),
      payload: { nome: 'Carro B2', consumo_kml: 9 } })).json() as { vehicle: { id: number } };
    const body = {
      nome: 'Rota SP', origem_lat: -23.5, origem_lon: -46.6,
      dist_km: 30, dur_min: 60, preco_litro: 6, litros: 3, custo_total: 18,
      geometry: { coordinates: [[-23.5, -46.6]] },
      stops: [
        { company_id: c2, seq: 0, lat: -23.6, lon: -46.7, leg_dist_km: 12, leg_dur_min: 21.7 },
        { company_id: c1, seq: 1, lat: -23.55, lon: -46.63 },
      ],
    };
    expect((await inj(a, 'POST', '/api/routes', { ...body, vehicle_id: vb.vehicle.id })).statusCode).toBe(404);

    const saved = await inj(a, 'POST', '/api/routes', body);
    expect(saved.statusCode).toBe(201);
    const routeId = (saved.json() as { route: { id: number } }).route.id;

    const list = await inj(a, 'GET', '/api/routes');
    expect((list.json() as { routes: { id: number; paradas: string }[] }).routes
      .some((x) => x.id === routeId)).toBe(true);

    const detail = await inj(a, 'GET', `/api/routes/${routeId}`);
    const dj = detail.json() as { stops: { company_id: number | string }[] };
    expect(dj.stops.map((s) => Number(s.company_id))).toEqual([c2, c1]);

    expect((await inj(b, 'GET', `/api/routes/${routeId}`)).statusCode).toBe(404);
    expect((await inj(b, 'DELETE', `/api/routes/${routeId}`)).statusCode).toBe(404);
    expect((await inj(a, 'DELETE', `/api/routes/${routeId}`)).statusCode).toBe(200);
    expect((await inj(a, 'GET', `/api/routes/${routeId}`)).statusCode).toBe(404);
  });
});
