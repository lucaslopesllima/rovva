import type { FastifyRequest } from 'fastify';
import { withClient } from './db.ts';
import { audit } from './audit.ts';

const fail = (statusCode: number, message: string): never => { throw Object.assign(new Error(message), { statusCode }); };

export interface CommissionPayment {
  valor: number; data: string; observacao?: string | null; request_id?: string;
}

// Trava a comissão antes de somar: duas parcelas simultâneas não perdem saldo.
export async function recordCommissionPayment(
  req: FastifyRequest, id: number, payment: CommissionPayment,
  kind: 'cliente' | 'parcela' | 'total', tolerancia = 0.01,
): Promise<string> {
  const status = await withClient(async (c) => {
    await c.query('BEGIN');
    try {
      const { rows: [entry] } = await c.query(
        `SELECT e.*, o.total AS order_total, o.numero, o.company_id, o.status AS order_status,
                r.nome AS represented_nome
         FROM commission_entries e JOIN orders o ON o.id = e.order_id
         JOIN represented_companies r ON r.id = e.represented_id
         WHERE e.id = $1 AND e.org_id = $2 FOR UPDATE OF e`, [id, req.auth!.orgId],
      );
      if (!entry) fail(404, 'Comissão não encontrada.');
      if (payment.request_id) {
        const table = kind === 'cliente' ? 'commission_releases' : 'commission_receipts';
        const { rows: [prior] } = await c.query(
          `SELECT ${kind === 'cliente' ? 'valor_cliente' : 'valor'} = $3::numeric
                    AND data = $4::date AND observacao IS NOT DISTINCT FROM $5::text AS same
           FROM ${table} WHERE commission_id = $1 AND request_id = $2`,
          [id, payment.request_id, payment.valor, payment.data, payment.observacao ?? null],
        );
        if (prior) {
          if (!prior.same) fail(409, 'Identificador já utilizado para outra parcela. Reabra o formulário.');
          await c.query('COMMIT'); return entry.status as string;
        }
      }
      if (entry.status === 'cancelada' || entry.order_status === 'cancelado') fail(409, 'Comissão cancelada.');
      const { rows: [date] } = await c.query('SELECT $1::date <= current_date AS valid', [payment.data]);
      if (!date.valid) fail(400, 'Informe a data de um recebimento já realizado.');

      if (kind !== 'total') {
        const { rows: [cents] } = await c.query('SELECT $1::numeric = ROUND($1::numeric, 2) AS valid', [payment.valor]);
        if (!cents.valid) fail(400, 'Use no máximo duas casas decimais.');
      }

      if (kind === 'cliente') {
        if (entry.modalidade !== 'liquidez') fail(409, 'Pagamento do cliente é usado apenas na modalidade por recebimento.');
        const { rows: [amount] } = await c.query(
          `SELECT COALESCE(SUM(valor_cliente), 0) + $2::numeric AS pago,
                  COALESCE(SUM(valor_cliente), 0) + $2::numeric <= ROUND($3::numeric, 2) AS valid,
                  ROUND($4::numeric * (COALESCE(SUM(valor_cliente), 0) + $2::numeric) / NULLIF(ROUND($3::numeric, 2), 0), 2)
                    - COALESCE(SUM(valor), 0) AS liberacao
           FROM commission_releases WHERE commission_id = $1`,
          [id, payment.valor, entry.order_total, entry.valor_previsto],
        );
        if (!amount.valid || amount.liberacao == null) fail(400, 'Pagamento supera o saldo do pedido.');
        await c.query(
          `INSERT INTO commission_releases (commission_id, request_id, valor_cliente, valor, data, vencimento, observacao)
           VALUES ($1,$2,$3,$4,$5,commission_due_date($5::date,$6,$7),$8)`,
          [id, payment.request_id, payment.valor, amount.liberacao, payment.data, entry.prazo_tipo, entry.prazo, payment.observacao ?? null],
        );
      } else {
        const { rows: [amount] } = await c.query(
          `SELECT CASE WHEN $3 THEN $2::numeric ELSE $2::numeric - COALESCE(valor_recebido, 0) END AS delta,
                  CASE WHEN $3 THEN COALESCE(valor_recebido, 0) + $2::numeric ELSE $2::numeric END AS total,
                  valor_liberado
           FROM commission_balances WHERE id = $1`, [id, payment.valor, kind === 'parcela'],
        );
        const { rows: [check] } = await c.query(
          'SELECT $1::numeric <= ROUND($2::numeric, 2) AS valid, $3::numeric = 0 AS unchanged',
          [amount.total, amount.valor_liberado, amount.delta],
        );
        if (!check.valid && entry.modalidade === 'liquidez') fail(400, 'Recebimento supera a comissão liberada pelos pagamentos do cliente.');
        if (!check.unchanged) {
          const { rows: [finance] } = await c.query(
            `INSERT INTO finance_entries
              (org_id, kind, descricao, valor, vencimento, liquidacao_data, status, categoria, company_id, represented_id, owner_user_id)
             VALUES ($1,'receber',$2,$3,$4,$4,'liquidado','comissao',$5,$6,$7) RETURNING id`,
            [entry.org_id, `${kind === 'total' ? 'Conciliação' : 'Parcela'} de comissão pedido #${entry.numero} · ${entry.represented_nome}`,
              amount.delta, payment.data, entry.company_id, entry.represented_id, entry.user_id],
          );
          await c.query(
            `INSERT INTO commission_receipts (commission_id, request_id, valor, data, observacao, finance_entry_id)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, payment.request_id, amount.delta, payment.data, payment.observacao ?? (kind === 'total' ? 'Ajuste do total acumulado' : null), finance.id],
          );
          await c.query('UPDATE commission_entries SET finance_entry_id = $2 WHERE id = $1', [id, finance.id]);
        }
        await c.query(
          `UPDATE commission_entries SET valor_recebido = $2, recebida_em = $3,
             observacao = COALESCE($4, observacao),
             status = CASE WHEN abs($2::numeric - valor_previsto) <= $5 THEN 'recebida'
                           WHEN $2::numeric > valor_previsto OR NOT $6 THEN 'divergente'
                           WHEN $2::numeric > 0 THEN 'parcial' ELSE 'prevista' END::commission_status
           WHERE id = $1`,
          [id, amount.total, payment.data, payment.observacao ?? null, tolerancia, kind === 'parcela'],
        );
      }
      const { rows: [updated] } = await c.query('SELECT status FROM commission_entries WHERE id = $1', [id]);
      await c.query('COMMIT');
      return updated.status as string;
    } catch (e) {
      await c.query('ROLLBACK');
      if ((e as { code?: string }).code === '22008' || (e as { code?: string }).code === '22007') fail(400, 'Data inválida.');
      throw e;
    }
  });
  await audit(req, 'commission', id, kind === 'cliente' ? 'release' : 'settle', { ...payment, modalidade_registro: kind, status });
  return status;
}
