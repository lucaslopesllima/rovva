// Reel "Rota do dia pronta": node marketing/reels/02-rota-do-dia/gravar.mjs
// Empresas fictícias do funil da demo (Campinas), partida = endereço da conta.
import { gravar, BASE } from '../lib.mjs';

const PARADAS = ['Padaria Mangueira', 'Distribuidora Nossa Casa', 'Supermercado Terra Nova',
  'Açougue Santa Clara', 'Padaria Trigo Dourado', 'Mercado Marambaia'];

await gravar(new URL('.', import.meta.url).pathname, async ({ p, marca, pausa, rolarAte, api }) => {
  await p.goto(`${BASE}/rotas`);
  await p.getByText('Empresas do funil', { exact: true }).waitFor();
  await pausa(2000);

  await marca('selecionar');
  for (const nome of PARADAS) {
    const item = p.locator('button', { has: p.getByText(nome, { exact: true }) });
    await rolarAte(item, 'center', 450);
    await item.click();
    await pausa(200);
  }
  await pausa(500);

  const veiculo = p.locator('select', { has: p.locator('option', { hasText: 'Sem veículo' }) });
  await rolarAte(veiculo, 'center');
  await veiculo.selectOption({ index: 3 });
  await pausa(900);

  await marca('otimizar');
  const otimizar = p.getByRole('button', { name: 'Otimizar rota' });
  await rolarAte(otimizar, 'center');
  await otimizar.click();
  await p.getByText('Custo estimado').first().waitFor({ timeout: 30000 });
  await pausa(400);
  await marca('custos');
  await rolarAte(p.getByText('Custo estimado').first(), 'center');
  await pausa(2300);

  await marca('mapa');
  await rolarAte(p.locator('.leaflet-container'), 'center');
  await pausa(2800);

  await marca('salvar');
  await rolarAte(p.getByText('Sequência de visitas', { exact: true }));
  await pausa(1800);
  await p.getByRole('button', { name: 'Salvar rota' }).click();
  await pausa(1200);
  const salvo = p.waitForResponse((r) => r.url().endsWith('/api/routes') && r.request().method() === 'POST');
  await p.getByRole('button', { name: 'Salvar', exact: true }).click();
  const rotaId = (await (await salvo).json()).route?.id;
  await p.getByText('Rota salva.').waitFor();
  await pausa(2200);
  await marca('fim');

  // desfaz pra próxima gravação sair igual
  if (rotaId) await api('DELETE', `/api/routes/${rotaId}`);
});
