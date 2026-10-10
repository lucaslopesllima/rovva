ALTER TYPE commission_status ADD VALUE IF NOT EXISTS 'parcial';

ALTER TABLE represented_companies
  ADD COLUMN comissao_modalidade text NOT NULL DEFAULT 'faturamento' CHECK (comissao_modalidade IN ('faturamento','liquidez')),
  ADD COLUMN comissao_prazo_tipo text NOT NULL DEFAULT 'dias' CHECK (comissao_prazo_tipo IN ('dias','mes_seguinte')),
  ADD COLUMN comissao_prazo integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT represented_commission_deadline CHECK (
    (comissao_prazo_tipo = 'dias' AND comissao_prazo BETWEEN 0 AND 365) OR
    (comissao_prazo_tipo = 'mes_seguinte' AND comissao_prazo BETWEEN 1 AND 31));

ALTER TABLE commission_entries
  ADD COLUMN modalidade text NOT NULL DEFAULT 'faturamento' CHECK (modalidade IN ('faturamento','liquidez')),
  ADD COLUMN prazo_tipo text NOT NULL DEFAULT 'dias',
  ADD COLUMN prazo integer NOT NULL DEFAULT 0;

CREATE FUNCTION commission_due_date(event_date date, deadline_type text, deadline integer)
RETURNS date LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT CASE WHEN deadline_type = 'mes_seguinte'
    THEN LEAST((date_trunc('month', event_date) + interval '1 month')::date + deadline - 1,
               (date_trunc('month', event_date) + interval '2 months - 1 day')::date)
    ELSE event_date + deadline END
$$;

CREATE TABLE commission_releases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  commission_id bigint NOT NULL REFERENCES commission_entries(id) ON DELETE CASCADE,
  request_id uuid,
  valor_cliente numeric(18,6) CHECK (valor_cliente > 0),
  valor numeric(18,6) NOT NULL CHECK (valor >= 0),
  data date NOT NULL,
  vencimento date NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commission_id, request_id)
);
CREATE INDEX commission_releases_due_idx ON commission_releases (vencimento);

CREATE TABLE commission_receipts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  commission_id bigint NOT NULL REFERENCES commission_entries(id) ON DELETE CASCADE,
  request_id uuid,
  valor numeric(18,6) NOT NULL,
  data date NOT NULL,
  observacao text,
  finance_entry_id bigint REFERENCES finance_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commission_id, request_id)
);
CREATE INDEX commission_receipts_date_idx ON commission_receipts (data);

-- Preserva valores e espelhos existentes; datas antigas não são recalculadas.
INSERT INTO commission_releases (commission_id, valor, data, vencimento)
SELECT e.id, e.valor_previsto, COALESCE((o.faturado_em AT TIME ZONE 'America/Sao_Paulo')::date, e.competencia),
       COALESCE((o.faturado_em AT TIME ZONE 'America/Sao_Paulo')::date, e.competencia)
FROM commission_entries e JOIN orders o ON o.id = e.order_id;

INSERT INTO commission_receipts (commission_id, valor, data, observacao, finance_entry_id)
SELECT id, valor_recebido, COALESCE(recebida_em, competencia), 'Recebimento anterior ao histórico de parcelas', finance_entry_id
FROM commission_entries WHERE valor_recebido IS NOT NULL;

CREATE VIEW commission_balances AS
SELECT e.*,
       COALESCE(r.liberado, 0) AS valor_liberado,
       COALESCE(r.cliente_pago, 0) AS valor_cliente_pago,
       CASE WHEN e.status = 'cancelada' THEN 0 ELSE GREATEST(COALESCE(r.liberado, 0) - COALESCE(e.valor_recebido, 0), 0) END AS saldo_liberado,
       CASE WHEN e.status = 'cancelada' THEN 0 ELSE GREATEST(e.valor_previsto - COALESCE(e.valor_recebido, 0), 0) END AS saldo_previsto,
       r.vencimento
FROM commission_entries e
LEFT JOIN LATERAL (
  SELECT SUM(valor) AS liberado, SUM(valor_cliente) AS cliente_pago,
         MIN(vencimento) FILTER (WHERE acumulado > COALESCE(e.valor_recebido, 0) + 0.01) AS vencimento
  FROM (
    SELECT valor, valor_cliente, vencimento,
           SUM(valor) OVER (ORDER BY vencimento, id) AS acumulado
    FROM commission_releases WHERE commission_id = e.id
  ) releases
) r ON true;
