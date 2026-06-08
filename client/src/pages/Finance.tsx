import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import type { Activity, FinanceEntry, KanbanCard, RepresentedCompany } from '../lib/types.ts';
import { Badge, Btn, Card, EmptyState, PageHeader, Segmented, Spinner, StatCard, cn, type Tone } from '../lib/ui.tsx';
import { Icon } from '../lib/icons.tsx';

const inputCls = 'w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200';

const brl = (v: number): string => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string): string => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
const todayStr = (): string => new Date().toISOString().slice(0, 10);

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'warn' },
  liquidado: { label: 'Liquidado', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
};

/* opções de vínculo (empresa prospect / representada / compromisso) */
type Opt = { id: number; label: string };

export function Finance(): React.JSX.Element {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<'todos' | 'receber' | 'pagar'>('todos');
  const [status, setStatus] = useState<'todos' | 'pendente' | 'liquidado' | 'cancelado'>('todos');
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [adding, setAdding] = useState(false);

  // dropdown sources
  const [companies, setCompanies] = useState<Opt[]>([]);
  const [represented, setRepresented] = useState<Opt[]>([]);
  const [activities, setActivities] = useState<Opt[]>([]);

  const load = async (): Promise<void> => {
    const r = await api.get<{ entries: FinanceEntry[] }>('/api/finance');
    setEntries(r.entries);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    void api.get<{ cards: KanbanCard[] }>('/api/kanban').then((r) => {
      const seen = new Set<number>();
      const opts: Opt[] = [];
      for (const c of r.cards) {
        if (seen.has(c.company_id)) continue;
        seen.add(c.company_id);
        opts.push({ id: c.company_id, label: c.nome_fantasia || c.razao_social });
      }
      opts.sort((a, b) => a.label.localeCompare(b.label));
      setCompanies(opts);
    }).catch(() => undefined);
    void api.get<{ empresas: RepresentedCompany[] }>('/api/represented').then((r) => {
      setRepresented(r.empresas.map((e) => ({ id: e.id, label: e.nome })));
    }).catch(() => undefined);
    void api.get<{ activities: Activity[] }>('/api/activities').then((r) => {
      setActivities(r.activities.map((a) => ({ id: a.id, label: a.titulo })));
    }).catch(() => undefined);
  }, []);

  const filtered = useMemo(() => entries.filter((e) =>
    (kind === 'todos' || e.kind === kind) && (status === 'todos' || e.status === status)
  ), [entries, kind, status]);

  // KPIs (somente lançamentos não cancelados)
  const kpis = useMemo(() => {
    let receberAberto = 0, pagarAberto = 0, recebido = 0, pago = 0;
    for (const e of entries) {
      const v = Number(e.valor);
      if (e.status === 'cancelado') continue;
      if (e.kind === 'receber') { e.status === 'liquidado' ? (recebido += v) : (receberAberto += v); }
      else { e.status === 'liquidado' ? (pago += v) : (pagarAberto += v); }
    }
    return { receberAberto, pagarAberto, recebido, pago, saldo: receberAberto - pagarAberto };
  }, [entries]);

  const remove = async (e: FinanceEntry): Promise<void> => {
    setEntries((xs) => xs.filter((x) => x.id !== e.id));
    await api.del(`/api/finance/${e.id}`);
  };
  const liquidar = async (e: FinanceEntry): Promise<void> => {
    const next = e.status === 'liquidado' ? 'pendente' : 'liquidado';
    await api.patch(`/api/finance/${e.id}`, {
      status: next, liquidacao_data: next === 'liquidado' ? todayStr() : null,
    });
    void load();
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <PageHeader title="Financeiro" subtitle="Contas a pagar e a receber"
        actions={<Btn icon="plus" onClick={() => setAdding(true)}>Lançamento</Btn>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="A receber (aberto)" value={brl(kpis.receberAberto)} icon="arrowDown" tone="success" />
        <StatCard label="A pagar (aberto)" value={brl(kpis.pagarAberto)} icon="arrowUp" tone="danger" />
        <StatCard label="Saldo previsto" value={brl(kpis.saldo)} icon="wallet" tone={kpis.saldo >= 0 ? 'brand' : 'danger'} />
        <StatCard label="Realizado" value={brl(kpis.recebido - kpis.pago)} sub={`+${brl(kpis.recebido)} · −${brl(kpis.pago)}`} icon="trendingUp" tone="info" />
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <Segmented value={kind} onChange={setKind} options={[
          { value: 'todos', label: 'Todos', icon: 'list' },
          { value: 'receber', label: 'A receber', icon: 'arrowDown' },
          { value: 'pagar', label: 'A pagar', icon: 'arrowUp' },
        ]} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-600 outline-none focus:border-brand-400">
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="liquidado">Liquidados</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </Card>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState icon="wallet" title="Nenhum lançamento" hint="Adicione uma conta a pagar ou a receber." />
      ) : (
        <div className="min-h-0 flex-1 space-y-2 overflow-auto">
          {filtered.map((e) => (
            <Row key={e.id} e={e} onEdit={() => setEditing(e)} onRemove={() => remove(e)} onLiquidar={() => liquidar(e)} />
          ))}
        </div>
      )}

      {(adding || editing) && (
        <FinanceModal entry={editing} companies={companies} represented={represented} activities={activities}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); void load(); }} />
      )}
    </div>
  );
}

function Row({ e, onEdit, onRemove, onLiquidar }: {
  e: FinanceEntry; onEdit: () => void; onRemove: () => void; onLiquidar: () => void;
}): React.JSX.Element {
  const receber = e.kind === 'receber';
  const vencido = e.status === 'pendente' && e.vencimento < todayStr();
  const links = [e.company_nome, e.represented_nome, e.activity_titulo].filter(Boolean) as string[];
  return (
    <Card className="flex items-center gap-3 p-3">
      <button onClick={onLiquidar} title={e.status === 'liquidado' ? 'Reabrir' : 'Marcar liquidado'}
        className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl transition',
          e.status === 'liquidado' ? 'bg-emerald-500 text-white'
            : receber ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              : 'bg-rose-50 text-rose-600 hover:bg-rose-100')}>
        <Icon name={e.status === 'liquidado' ? 'check' : receber ? 'arrowDown' : 'arrowUp'} size={17} />
      </button>

      <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Editar">
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-semibold', e.status === 'cancelado' ? 'text-ink-400 line-through' : 'text-ink-800')}>
            {e.descricao}
          </p>
          <p className="truncate text-xs text-ink-400">
            Venc. {fmtDate(e.vencimento)}
            {e.categoria ? ` · ${e.categoria}` : ''}
            {links.length ? ` · ${links.join(' · ')}` : ''}
          </p>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('tabnums text-sm font-bold', receber ? 'text-emerald-600' : 'text-rose-600')}>
          {receber ? '+' : '−'} {brl(Number(e.valor))}
        </span>
        <Badge tone={vencido ? 'danger' : STATUS_META[e.status]!.tone}>
          {vencido ? 'Vencido' : STATUS_META[e.status]!.label}
        </Badge>
      </div>

      <button onClick={onRemove} aria-label="Excluir"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-300 hover:bg-rose-50 hover:text-rose-500">
        <Icon name="x" size={16} />
      </button>
    </Card>
  );
}

function FinanceModal({ entry, companies, represented, activities, onClose, onSaved }: {
  entry: FinanceEntry | null; companies: Opt[]; represented: Opt[]; activities: Opt[];
  onClose: () => void; onSaved: () => void;
}): React.JSX.Element {
  const [kind, setKind] = useState<'receber' | 'pagar'>(entry?.kind ?? 'receber');
  const [descricao, setDescricao] = useState(entry?.descricao ?? '');
  const [valor, setValor] = useState(entry ? String(entry.valor) : '');
  const [vencimento, setVencimento] = useState(entry?.vencimento ?? todayStr());
  const [categoria, setCategoria] = useState(entry?.categoria ?? '');
  const [notas, setNotas] = useState(entry?.notas ?? '');
  const [companyId, setCompanyId] = useState<number | null>(entry?.company_id ?? null);
  const [representedId, setRepresentedId] = useState<number | null>(entry?.represented_id ?? null);
  const [activityId, setActivityId] = useState<number | null>(entry?.activity_id ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    const v = Number(valor.replace(',', '.'));
    if (!descricao || !vencimento || !Number.isFinite(v) || v <= 0) return;
    setBusy(true);
    try {
      const body = {
        kind, descricao, valor: v, vencimento,
        categoria: categoria || null, notas: notas || null,
        company_id: companyId, represented_id: representedId, activity_id: activityId,
      };
      if (entry) await api.patch(`/api/finance/${entry.id}`, body);
      else await api.post('/api/finance', body);
      onSaved();
    } finally { setBusy(false); }
  };

  const sel = (val: number | null, set: (n: number | null) => void, opts: Opt[], placeholder: string): React.JSX.Element => (
    <select value={val ?? ''} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} className={cn(inputCls, 'mt-1')}>
      <option value="">{placeholder}</option>
      {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-ink-950/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-4 shadow-pop">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">{entry ? 'Editar lançamento' : 'Novo lançamento'}</h3>
            <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100">
              <Icon name="x" size={17} />
            </button>
          </div>
          <form onSubmit={submit} className="max-h-[70vh] space-y-3 overflow-auto pr-1">
            <div className="grid grid-cols-2 gap-1.5">
              {(['receber', 'pagar'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={cn('flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition',
                    kind === k
                      ? (k === 'receber' ? 'border-transparent bg-emerald-50 text-emerald-700' : 'border-transparent bg-rose-50 text-rose-600')
                      : 'border-ink-200 text-ink-500 hover:bg-ink-50')}>
                  <Icon name={k === 'receber' ? 'arrowDown' : 'arrowUp'} size={15} />
                  {k === 'receber' ? 'A receber' : 'A pagar'}
                </button>
              ))}
            </div>
            <input autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-semibold text-ink-600">Valor (R$)</span>
                <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={cn(inputCls, 'mt-1')} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-ink-600">Vencimento</span>
                <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={cn(inputCls, 'mt-1')} />
              </label>
            </div>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria (opcional)" className={inputCls} />
            <label className="block">
              <span className="text-xs font-semibold text-ink-600">Empresa prospect</span>
              {sel(companyId, setCompanyId, companies, 'Sem vínculo')}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600">Empresa representada</span>
              {sel(representedId, setRepresentedId, represented, 'Sem vínculo')}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600">Compromisso</span>
              {sel(activityId, setActivityId, activities, 'Sem vínculo')}
            </label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)" rows={2} className={inputCls} />
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
              <Btn icon="check" type="submit" disabled={busy}>{busy ? '…' : 'Salvar'}</Btn>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
