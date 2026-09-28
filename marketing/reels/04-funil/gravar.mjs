// Reel "Funil": node marketing/reels/04-funil/gravar.mjs
// Move um card de Avaliação para Negociação pelo botão → (arrastar não funciona
// no celular) e devolve o card à etapa original no fim.
import { gravar, BASE } from '../lib.mjs';

await gravar(new URL('.', import.meta.url).pathname, async ({ p, marca, pausa, api }) => {
  const board = p.waitForResponse((r) => r.url().endsWith('/api/kanban'));
  await p.goto(`${BASE}/funil`);
  const { cards } = await (await board).json();
  const coluna = (nome) => p.locator('div.snap-center', { has: p.locator('span', { hasText: new RegExp(`^${nome}$`) }) });
  const irPara = async (nome, ms = 1100) => {
    await coluna(nome).evaluate((el) => el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
    await pausa(ms);
  };
  await coluna('Prospecção').waitFor();
  // a tela lembra se os indicadores estavam abertos: começa fechado pra abrir na cena
  const indicadores = p.getByRole('button', { name: /Indicadores/ });
  if (await indicadores.getAttribute('aria-expanded') === 'true') await indicadores.click();
  await pausa(1500);

  await marca('indicadores');
  await indicadores.click();
  await p.getByText('Valor em funil').waitFor();
  await pausa(2000);

  await marca('etapas');
  for (const etapa of ['Conscientização', 'Interesse', 'Avaliação']) await irPara(etapa);

  await marca('mover');
  const card = coluna('Avaliação').locator('button[aria-label="Mover para outra etapa"]').first();
  const movido = p.waitForRequest((r) => r.method() === 'PATCH' && /\/api\/relationships\/\d+$/.test(r.url()));
  await card.click();
  await pausa(1500); // tempo pra quem assiste ler o menu de etapas
  await p.getByRole('menuitem', { name: 'Negociação' }).click();
  const relId = Number((await movido).url().split('/').pop());
  await pausa(700);

  await marca('negociacao');
  await irPara('Negociação', 2200);
  await marca('fim');

  const original = cards.find((c) => Number(c.id) === relId)?.stage_id;
  if (original != null) await api('PATCH', `/api/relationships/${relId}`, { stage_id: Number(original) });
});
