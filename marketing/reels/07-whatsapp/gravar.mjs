// Reel "WhatsApp no sistema": node marketing/reels/07-whatsapp/gravar.mjs
// Na org demo o WhatsApp é circuito fechado (nada sai de verdade). Responde uma
// conversa, deixa nota interna e, no fim, apaga as duas e devolve a conversa como estava.
import { gravar, sql, BASE } from '../lib.mjs';

const CONVERSA = 'Lanchonete Central'; // a conversa com mais histórico na demo
const NA_LISTA = 'Fernando Ramos';      // a lista mostra o nome do contato, não o da empresa
const RESPOSTA = 'Oi! O pedido de vocês sai amanhã cedo e chega até quinta.';
const NOTA = 'Pediu 5% de desconto no próximo pedido. Ver com a Juliana.';
const q = (t) => t.replaceAll("'", "''");

const [chatId, antes] = sql(`select id, row_to_json(c)::text from (select id, last_message_at, last_preview, nao_lidas
  from whatsapp_chats where org_id = 47 and nome = '${q(CONVERSA)}') c`).split('|');

await gravar(new URL('.', import.meta.url).pathname, async ({ p, marca, pausa, digitar }) => {
  try {
    await p.goto(`${BASE}/whatsapp`);
    const item = p.locator('button', { has: p.getByText(NA_LISTA, { exact: true }) }).first();
    await item.waitFor();
    await pausa(1800);

    await marca('conversa');
    await item.click();
    await p.getByPlaceholder('Digite uma mensagem…').waitFor();
    await pausa(2200);

    await marca('responder');
    const caixa = p.getByPlaceholder('Digite uma mensagem…');
    await caixa.click();
    await digitar(caixa, RESPOSTA, 55);
    await pausa(300);
    await p.getByRole('button', { name: 'Enviar', exact: true }).click();
    await pausa(1500);

    await marca('nota');
    await p.locator('button[title="Nota interna (não enviada ao contato)"]').click();
    const nota = p.getByPlaceholder('Nota interna — só a equipe vê…');
    await nota.click();
    await digitar(nota, NOTA, 55);
    await pausa(300);
    await p.getByRole('button', { name: 'Salvar nota' }).click();
    await pausa(2200);
    await marca('fim');
  } finally {
    sql(`delete from whatsapp_messages where org_id = 47 and chat_id = ${Number(chatId)}
      and corpo in ('${q(RESPOSTA)}', '${q(NOTA)}')`);
    sql(`update whatsapp_chats c set last_message_at = a.last_message_at, last_preview = a.last_preview,
      nao_lidas = a.nao_lidas from json_populate_record(null::whatsapp_chats, '${q(antes)}'::json) a
      where c.id = ${Number(chatId)} and c.org_id = 47`);
  }
});
