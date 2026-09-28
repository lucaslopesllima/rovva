// Reel "Achar cliente no território": node marketing/reels/03-achar-cliente/gravar.mjs
// Busca real na base (Florianópolis/SC + padaria); adiciona uma ao funil e desfaz no fim.
import { gravar, BASE } from '../lib.mjs';

await gravar(new URL('.', import.meta.url).pathname, async ({ p, marca, pausa, digitar, rolarAte, api }) => {
  await p.goto(`${BASE}/prospeccao`);
  await p.getByText('Filtros da busca').waitFor();
  await pausa(1200);

  // troca a cidade sugerida pela conta por Florianópolis
  const chips = p.locator('button', { hasText: /· [A-Z]{2}\s*$/ }).filter({ has: p.locator('svg') });
  while (await chips.count()) { await chips.first().click(); await pausa(300); }
  const cidade = p.getByPlaceholder('Buscar cidade (ex.: Blumenau)…');
  await cidade.click();
  await digitar(cidade, 'Florianópolis');
  await p.locator('button', { hasText: 'Florianópolis' }).filter({ hasText: 'SC' }).first().click();
  await pausa(700);

  await marca('cnae');
  const cnae = p.getByPlaceholder('Atividade (ex.: padaria) ou código');
  await rolarAte(cnae, 'center', 500);
  await cnae.click();
  await digitar(cnae, 'padaria');
  await p.locator('button', { hasText: '1091102' }).first().click();
  await pausa(900);

  await marca('resultados');
  await p.getByRole('button', { name: /Ver resultados/ }).click();
  await p.getByText(/ranqueados por fit/).waitFor();
  await p.locator('[id^="empresa-"]').first().waitFor();
  await pausa(1500);
  await p.evaluate(() => {
    let el = document.querySelector('[id^="empresa-"]');
    while (el && el.scrollHeight <= el.clientHeight + 10) el = el.parentElement;
    el?.scrollBy({ top: 520, behavior: 'smooth' });
  });
  await pausa(1500);

  await marca('mapa');
  await p.getByRole('button', { name: /Mapa/ }).last().click();
  await p.locator('path.leaflet-interactive').first().waitFor();
  await pausa(2200);

  await marca('funil');
  // pinos seguem a ordem do ranking; pula nome que pega mal em vídeo
  const pinos = p.locator('path.leaflet-interactive');
  for (let i = 0; i < await pinos.count(); i++) {
    await pinos.nth(i).click({ force: true });
    const titulo = await p.locator('.leaflet-popup p').first().textContent();
    if (!/RECUPERA|FAL[EÊ]N|FALIDA|LIQUIDA/i.test(titulo ?? '')) break;
    await p.keyboard.press('Escape');
  }
  await pausa(1000);
  const criado = p.waitForResponse((r) => r.url().endsWith('/api/relationships') && r.request().method() === 'POST');
  await p.locator('.leaflet-popup button', { hasText: 'Adicionar ao funil' }).click();
  const relId = (await (await criado).json()).relationship?.id;
  await pausa(1500);
  await marca('fim');

  if (relId) await api('DELETE', `/api/relationships/${relId}`);
});
