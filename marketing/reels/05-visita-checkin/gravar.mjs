// Reel "Visita com check-in": node marketing/reels/05-visita-checkin/gravar.mjs
// Cria 3 visitas de hoje (fora do vídeo), grava check-in + relatório na primeira
// e apaga tudo no fim, devolvendo a data de contato original do cliente.
import { gravar, BASE } from '../lib.mjs';

// o vídeo se passa às 10h de hoje: relógio do navegador (hora do check-in) e visitas
// DIA=2026-10-01 grava como se fosse o dia da postagem (padrão: hoje)
const hoje = process.env.DIA ?? new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const as = (hora) => new Date(`${hoje}T${hora}:00-03:00`);
const VISITAS = [ // empresas fictícias do funil da demo, em Campinas
  { hora: '10:00', company_id: 81126168, titulo: 'Visita — Padaria Mangueira' },
  { hora: '11:30', company_id: 81126184, titulo: 'Visita — Supermercado Terra Nova' },
  { hora: '14:00', company_id: 81126228, titulo: 'Visita — Açougue Santa Clara' },
];

await gravar(new URL('.', import.meta.url).pathname, async ({ p, marca, pausa, digitar, api }) => {
  await p.clock.setSystemTime(as('10:07'));
  await p.goto(`${BASE}/`);
  const { relationships } = await api('GET', '/api/relationships?limit=200');
  const rel = relationships.find((r) => Number(r.company_id) === VISITAS[0].company_id);
  const criadas = [];
  for (const v of VISITAS) {
    const r = await api('POST', '/api/activities', {
      tipo: 'visita', titulo: v.titulo, company_id: v.company_id, start_at: as(v.hora).toISOString(),
    });
    criadas.push(r.activity?.id ?? r.id);
  }
  try {
    await p.goto(`${BASE}/agenda`);
    const linha = p.locator('div', { has: p.getByText(VISITAS[0].titulo, { exact: true }) })
      .filter({ has: p.locator('button[aria-label="Registrar visita"]') }).last();
    await linha.waitFor();
    await pausa(1500);

    await marca('checkin');
    await linha.locator('button[aria-label="Registrar visita"]').click();
    await pausa(1000);
    await p.getByRole('button', { name: 'Check-in', exact: true }).click();
    await p.getByRole('button', { name: 'Refazer' }).waitFor();
    await pausa(1500);

    await marca('relatorio');
    await p.locator('select', { has: p.locator('option', { hasText: 'Em negociação' }) }).selectOption('Em negociação');
    await pausa(500);
    const proximo = p.getByPlaceholder('Ex.: enviar proposta até sexta');
    await proximo.click();
    await digitar(proximo, 'Enviar proposta até sexta');
    const obs = p.getByPlaceholder('Como foi a visita?');
    await obs.click();
    await digitar(obs, 'Gostou da linha nova de pães.');
    await pausa(600);

    await marca('salvar');
    await p.getByRole('button', { name: 'Salvar visita' }).click();
    await pausa(2600);
    await marca('fim');
  } finally {
    for (const id of criadas.filter(Boolean)) await api('DELETE', `/api/activities/${id}`);
    if (rel) await api('PATCH', `/api/relationships/${rel.id}`, { data_contato: rel.data_contato });
  }
}, { contexto: { permissions: ['geolocation'], geolocation: { latitude: -22.9049, longitude: -47.0471 } } });
