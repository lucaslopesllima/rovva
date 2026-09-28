// Reel "Pedido e comissão": node marketing/reels/06-pedido-comissao/gravar.mjs
// Lança um pedido, envia, fatura (gera a comissão) e mostra o extrato de comissões.
// Pedido faturado não se exclui pela API: a limpeza apaga direto no Postgres de
// dev (itens e comissão caem junto, ON DELETE CASCADE).
import { gravar, sql, BASE } from '../lib.mjs';

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
    // quantidade de pedido de verdade: com qtd 1 o valor (e a comissão) fica irrisório
    for (const [i, qtd] of [[1, '30'], [2, '20']]) {
      await mostruario.selectOption({ index: i });
      await pausa(500);
      const q = p.locator(`input[aria-label="Qtd * item ${i}"]`);
      await q.fill('');
      await digitar(q, qtd);
      await pausa(400);
    }
    await pausa(500);
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
    await p.getByRole('button', { name: 'Abrir menu' }).click();
    await pausa(700);
    await p.getByRole('link', { name: 'Comissões' }).last().click();
    await p.getByText('A receber').first().waitFor();
    await pausa(3200);
    await marca('fim');
  } finally {
    if (pedidoId) sql(`delete from orders where id = ${Number(pedidoId)} and org_id = 47`);
  }
});
