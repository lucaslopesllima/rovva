// Reel "Pedido e comissão": node marketing/reels/06-pedido-comissao/gravar.mjs
// Lança um pedido, envia, fatura (gera a comissão) e mostra o extrato de comissões.
// Pedido faturado não se exclui pela API: a limpeza apaga direto no Postgres de
// dev (itens e comissão caem junto, ON DELETE CASCADE).
import { execFileSync } from 'node:child_process';
import { gravar, BASE } from '../lib.mjs';

const REPO = new URL('../../../', import.meta.url).pathname;

await gravar(new URL('.', import.meta.url).pathname, async ({ p, marca, pausa, digitar }) => {
  let pedidoId;
  try {
    await p.goto(`${BASE}/pedidos`);
    const novo = p.getByRole('button', { name: 'Novo pedido' });
    await novo.waitFor();
    await pausa(1800);

    await marca('pedido');
    await novo.click();
    const cliente = p.locator('select', { has: p.locator('option', { hasText: 'Escolha o cliente' }) });
    await cliente.waitFor();
    await pausa(600);
    await cliente.selectOption({ label: 'Padaria Mangueira' });
    await pausa(600);
    await p.locator('select', { has: p.locator('option', { hasText: 'Escolha a representada' }) }).selectOption({ index: 1 });
    await pausa(700);
    const mostruario = p.locator('select[aria-label="Adicionar item do mostruário"]');
    await mostruario.selectOption({ index: 1 });
    await pausa(600);
    await mostruario.selectOption({ index: 2 });
    await pausa(900);
    const salvo = p.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST');
    await p.getByRole('button', { name: 'Salvar pedido' }).click();
    pedidoId = (await (await salvo).json()).order?.id;
    await pausa(1200);

    await marca('faturar');
    await p.getByRole('button', { name: 'Enviar', exact: true }).first().click();
    await pausa(1200);
    await p.getByRole('button', { name: 'Faturar', exact: true }).first().click();
    const nf = p.getByPlaceholder('Número da NF');
    await nf.click();
    await digitar(nf, '4521');
    await p.getByRole('button', { name: 'Faturar', exact: true }).last().click();
    await pausa(1800);

    await marca('comissao');
    await p.goto(`${BASE}/comissoes`);
    await p.getByText('A receber').first().waitFor();
    await pausa(3200);
    await marca('fim');
  } finally {
    if (pedidoId) execFileSync('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c',
      `psql -U $POSTGRES_USER -d $POSTGRES_DB -qc "delete from orders where id = ${Number(pedidoId)} and org_id = 47"`], { cwd: REPO });
  }
});
