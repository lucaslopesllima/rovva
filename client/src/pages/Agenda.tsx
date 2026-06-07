import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import type { Activity, KanbanCard } from '../lib/types.ts';
import { Btn, Card, EmptyState, PageHeader, Segmented, Spinner, cn } from '../lib/ui.tsx';
import { Icon, type IconName } from '../lib/icons.tsx';

/* ── tipo metadata (color + icon per activity kind) ─────── */
const TIPO: Record<string, { label: string; icon: IconName; dot: string; chip: string }> = {
  tarefa:  { label: 'Tarefa',   icon: 'check',  dot: '#039855', chip: 'bg-brand-50 text-brand-700' },
  ligacao: { label: 'Ligação',  icon: 'phone',  dot: '#0284c7', chip: 'bg-sky-50 text-sky-700' },
  visita:  { label: 'Visita',   icon: 'mapPin', dot: '#d97706', chip: 'bg-amber-50 text-amber-700' },
  reuniao: { label: 'Reunião',  icon: 'users',  dot: '#7c3aed', chip: 'bg-violet-50 text-violet-700' },
};
const TIPOS = Object.keys(TIPO);
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const inputCls = 'w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200';

/* ── date helpers ───────────────────────────────────────── */
const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth() + n, 1);
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(d.getDate() + n); return x; };
const startOfWeek = (d: Date): Date => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -d.getDay());
const WEEK_START_HOUR = 6;
const WEEK_END_HOUR = 22;
const HOUR_PX = 48;
const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sameDay = (a: Date, b: Date): boolean => dayKey(a) === dayKey(b);
const fmtTime = (iso: string): string => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDayLong = (d: Date): string => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
const toLocalInput = (d: Date): string => {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* empresa no funil → opção do dropdown de vínculo */
type FunnelCompany = { company_id: number; label: string };

export function Agenda(): React.JSX.Element {
  const [items, setItems] = useState<Activity[]>([]);
  const [funnel, setFunnel] = useState<FunnelCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [view, setView] = useState<'mes' | 'semana' | 'lista'>('mes');
  const [tipoFilter, setTipoFilter] = useState<Set<string>>(new Set(TIPOS));
  const [status, setStatus] = useState<'todos' | 'pendente' | 'feito'>('todos');
  const [addAt, setAddAt] = useState<Date | null>(null);     // add-modal open + preset date
  const [dayOpen, setDayOpen] = useState<Date | null>(null); // day-detail modal

  const today = useMemo(() => new Date(), []);

  const load = async (): Promise<void> => {
    const r = await api.get<{ activities: Activity[] }>('/api/activities');
    setItems(r.activities);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  // Empresas do funil para vincular numa atividade (uma opção por company_id).
  useEffect(() => {
    void api.get<{ cards: KanbanCard[] }>('/api/kanban').then((r) => {
      const seen = new Set<number>();
      const opts: FunnelCompany[] = [];
      for (const c of r.cards) {
        if (seen.has(c.company_id)) continue;
        seen.add(c.company_id);
        opts.push({ company_id: c.company_id, label: c.nome_fantasia || c.razao_social });
      }
      opts.sort((a, b) => a.label.localeCompare(b.label));
      setFunnel(opts);
    }).catch(() => undefined);
  }, []);

  const toggle = async (a: Activity): Promise<void> => {
    const next = a.status === 'feito' ? 'pendente' : 'feito';
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    await api.patch(`/api/activities/${a.id}`, { status: next });
  };
  const remove = async (a: Activity): Promise<void> => {
    setItems((xs) => xs.filter((x) => x.id !== a.id));
    await api.del(`/api/activities/${a.id}`);
  };

  // filtered set used by every view
  const filtered = useMemo(() => items.filter((a) =>
    tipoFilter.has(a.tipo) && (status === 'todos' || a.status === status)
  ), [items, tipoFilter, status]);

  // events grouped by calendar day
  const byDay = useMemo(() => {
    const m: Record<string, Activity[]> = {};
    for (const a of filtered) (m[dayKey(new Date(a.start_at))] ??= []).push(a);
    for (const k in m) m[k]!.sort((x, y) => x.start_at.localeCompare(y.start_at));
    return m;
  }, [filtered]);

  // 6-week grid starting on the Sunday before the 1st
  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const s = startOfWeek(weekAnchor);
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  }, [weekAnchor]);

  const goPrev = (): void => view === 'semana' ? setWeekAnchor((d) => addDays(d, -7)) : setCursor((c) => addMonths(c, -1));
  const goNext = (): void => view === 'semana' ? setWeekAnchor((d) => addDays(d, 7)) : setCursor((c) => addMonths(c, 1));
  const goToday = (): void => { setCursor(startOfMonth(new Date())); setWeekAnchor(new Date()); };
  const navLabel = view === 'semana'
    ? `${weekDays[0]!.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDays[6]!.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
    : cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const toggleTipo = (t: string): void => setTipoFilter((s) => {
    const n = new Set(s);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });

  const pendentes = filtered.filter((a) => a.status !== 'feito').length;

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <PageHeader title="Agenda" subtitle={`${pendentes} atividade(s) pendente(s)`}
        actions={<Btn icon="plus" onClick={() => setAddAt(new Date())}>Adicionar</Btn>} />

      {/* ── control panel ─────────────────────────────── */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-1">
          <button onClick={goPrev} aria-label="Anterior"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100">
            <Icon name="chevronRight" size={18} className="rotate-180" />
          </button>
          <button onClick={goToday}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-ink-100">Hoje</button>
          <button onClick={goNext} aria-label="Próximo"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100">
            <Icon name="chevronRight" size={18} />
          </button>
          <span className="ml-2 text-base font-bold capitalize tracking-tight text-ink-900">{navLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* tipo filters */}
          <div className="flex flex-wrap gap-1">
            {TIPOS.map((t) => {
              const on = tipoFilter.has(t);
              return (
                <button key={t} onClick={() => toggleTipo(t)}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                    on ? 'border-transparent ' + TIPO[t]!.chip : 'border-ink-200 text-ink-400 hover:bg-ink-50')}>
                  <span className="h-2 w-2 rounded-full" style={{ background: on ? TIPO[t]!.dot : '#cbd5e1' }} />
                  {TIPO[t]!.label}
                </button>
              );
            })}
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-600 outline-none focus:border-brand-400">
            <option value="todos">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="feito">Concluídos</option>
          </select>
          <Segmented value={view} onChange={setView} options={[
            { value: 'mes', label: 'Mês', icon: 'calendar' },
            { value: 'semana', label: 'Semana', icon: 'columns' },
            { value: 'lista', label: 'Lista', icon: 'list' },
          ]} />
        </div>
      </Card>

      {/* ── calendar / list ───────────────────────────── */}
      {loading ? (
        <Spinner />
      ) : view === 'mes' ? (
        <MonthGrid grid={grid} cursor={cursor} today={today} byDay={byDay} onDay={setDayOpen} />
      ) : view === 'semana' ? (
        <WeekView days={weekDays} today={today} byDay={byDay}
          onDay={setDayOpen}
          onSlot={(d) => setAddAt(d)} />
      ) : (
        <ListView byDay={byDay} onToggle={toggle} onRemove={remove} onAdd={() => setAddAt(new Date())} />
      )}

      {addAt && (
        <AddModal preset={addAt} funnel={funnel} onClose={() => setAddAt(null)}
          onSaved={() => { setAddAt(null); void load(); }} />
      )}
      {dayOpen && (
        <DayModal date={dayOpen} events={byDay[dayKey(dayOpen)] ?? []}
          onClose={() => setDayOpen(null)}
          onToggle={toggle} onRemove={remove}
          onAdd={() => { const d = new Date(dayOpen); d.setHours(9, 0, 0, 0); setDayOpen(null); setAddAt(d); }} />
      )}
    </div>
  );
}

/* ── month grid (Google-Calendar style) ─────────────────── */
function MonthGrid({ grid, cursor, today, byDay, onDay }: {
  grid: Date[]; cursor: Date; today: Date; byDay: Record<string, Activity[]>; onDay: (d: Date) => void;
}): React.JSX.Element {
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-ink-200/70">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-400">{w}</div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {grid.map((d, i) => {
          const out = d.getMonth() !== cursor.getMonth();
          const isToday = sameDay(d, today);
          const evs = byDay[dayKey(d)] ?? [];
          return (
            <button key={i} onClick={() => onDay(d)}
              className={cn('flex min-h-[88px] flex-col gap-1 border-b border-r border-ink-100 p-1.5 text-left transition-colors hover:bg-ink-50',
                i % 7 === 6 && 'border-r-0', out && 'bg-ink-50/40')}>
              <span className={cn('tabnums grid h-6 w-6 place-items-center rounded-full text-xs font-semibold',
                isToday ? 'bg-brand-600 text-white' : out ? 'text-ink-300' : 'text-ink-600')}>
                {d.getDate()}
              </span>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {evs.slice(0, 3).map((a) => (
                  <span key={a.id}
                    className={cn('flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-medium',
                      TIPO[a.tipo]?.chip ?? 'bg-ink-100 text-ink-600', a.status === 'feito' && 'line-through opacity-60')}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TIPO[a.tipo]?.dot ?? '#94a3b8' }} />
                    <span className="tabnums shrink-0">{fmtTime(a.start_at)}</span>
                    <span className="truncate">{a.titulo}</span>
                  </span>
                ))}
                {evs.length > 3 && <span className="px-1 text-[10px] font-semibold text-ink-400">+{evs.length - 3} mais</span>}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ── week view (time-grid, Google-Calendar style) ───────── */
function WeekView({ days, today, byDay, onDay, onSlot }: {
  days: Date[]; today: Date; byDay: Record<string, Activity[]>;
  onDay: (d: Date) => void; onSlot: (d: Date) => void;
}): React.JSX.Element {
  const hours = Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR }, (_, i) => WEEK_START_HOUR + i);
  const bodyH = hours.length * HOUR_PX;
  const cols = '56px repeat(7, minmax(0, 1fr))';

  const pos = (a: Activity): { top: number; height: number } => {
    const s = new Date(a.start_at);
    const startMin = s.getHours() * 60 + s.getMinutes() - WEEK_START_HOUR * 60;
    const end = a.end_at ? new Date(a.end_at) : null;
    const durMin = end ? Math.max((end.getTime() - s.getTime()) / 60000, 30) : 45;
    return {
      top: Math.max(0, Math.min((startMin / 60) * HOUR_PX, bodyH - 22)),
      height: Math.max((durMin / 60) * HOUR_PX, 26),
    };
  };

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      {/* day headers */}
      <div className="grid border-b border-ink-200/70" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <button key={i} onClick={() => onDay(d)} className="flex flex-col items-center gap-0.5 border-l border-ink-100 py-2 hover:bg-ink-50">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{WEEKDAYS[d.getDay()]}</span>
              <span className={cn('tabnums grid h-7 w-7 place-items-center rounded-full text-sm font-bold', isToday ? 'bg-brand-600 text-white' : 'text-ink-700')}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      {/* scrollable time body */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid" style={{ gridTemplateColumns: cols, height: bodyH }}>
          {/* time gutter */}
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="tabnums absolute right-1 -translate-y-1/2 text-[10px] font-medium text-ink-400" style={{ top: (h - WEEK_START_HOUR) * HOUR_PX }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {days.map((d, di) => {
            const evs = byDay[dayKey(d)] ?? [];
            return (
              <div key={di} className="relative border-l border-ink-100"
                onClick={(e) => {
                  const hour = Math.min(WEEK_END_HOUR - 1, WEEK_START_HOUR + Math.floor(e.nativeEvent.offsetY / HOUR_PX));
                  const dd = new Date(d); dd.setHours(hour, 0, 0, 0); onSlot(dd);
                }}>
                {hours.map((h) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-ink-100" style={{ top: (h - WEEK_START_HOUR) * HOUR_PX }} />
                ))}
                {evs.map((a) => {
                  const { top, height } = pos(a);
                  const done = a.status === 'feito';
                  return (
                    <button key={a.id} onClick={(e) => { e.stopPropagation(); onDay(d); }}
                      className={cn('absolute left-0.5 right-0.5 overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left text-[10px] shadow-card',
                        TIPO[a.tipo]?.chip ?? 'bg-ink-100 text-ink-600', done && 'line-through opacity-60')}
                      style={{ top, height, borderColor: TIPO[a.tipo]?.dot ?? '#94a3b8' }}>
                      <span className="block truncate font-semibold">{a.titulo}</span>
                      <span className="tabnums block truncate opacity-80">{fmtTime(a.start_at)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ── list view ──────────────────────────────────────────── */
function ListView({ byDay, onToggle, onRemove, onAdd }: {
  byDay: Record<string, Activity[]>; onToggle: (a: Activity) => void; onRemove: (a: Activity) => void; onAdd: () => void;
}): React.JSX.Element {
  const days = Object.entries(byDay).sort((a, b) => (a[1][0]?.start_at ?? '').localeCompare(b[1][0]?.start_at ?? ''));
  if (days.length === 0) {
    return <EmptyState icon="calendar" title="Nenhuma atividade" hint="Ajuste os filtros ou adicione uma atividade." />;
  }
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-auto">
      {days.map(([k, list]) => (
        <div key={k}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{fmtDayLong(new Date(list[0]!.start_at))}</p>
          <div className="space-y-2">
            {list.map((a) => <Row key={a.id} a={a} onToggle={onToggle} onRemove={onRemove} />)}
          </div>
        </div>
      ))}
      <Btn variant="soft" icon="plus" onClick={onAdd}>Adicionar atividade</Btn>
    </div>
  );
}

function Row({ a, onToggle, onRemove }: { a: Activity; onToggle: (a: Activity) => void; onRemove: (a: Activity) => void }): React.JSX.Element {
  const done = a.status === 'feito';
  return (
    <Card className="flex items-center gap-3 p-3">
      <button onClick={() => onToggle(a)} aria-label="Concluir"
        className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition',
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-ink-300 text-transparent hover:border-brand-400')}>
        <Icon name="check" size={14} />
      </button>
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', TIPO[a.tipo]?.chip ?? 'bg-ink-100 text-ink-500', done && 'opacity-50')}>
        <Icon name={TIPO[a.tipo]?.icon ?? 'check'} size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', done ? 'text-ink-400 line-through' : 'text-ink-800')}>{a.titulo}</p>
        <p className="truncate text-xs text-ink-400">{fmtTime(a.start_at)} · {TIPO[a.tipo]?.label ?? a.tipo}{a.razao_social ? ` · ${a.razao_social}` : ''}</p>
      </div>
      <button onClick={() => onRemove(a)} aria-label="Excluir"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-300 hover:bg-rose-50 hover:text-rose-500">
        <Icon name="x" size={16} />
      </button>
    </Card>
  );
}

/* ── modal shell ────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-ink-950/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-4 shadow-pop" >
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold capitalize text-ink-900">{title}</h3>
            <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100">
              <Icon name="x" size={17} />
            </button>
          </div>
          {children}
        </div>
      </Card>
    </div>
  );
}

/* ── add modal ──────────────────────────────────────────── */
function AddModal({ preset, funnel, onClose, onSaved }: {
  preset: Date; funnel: FunnelCompany[]; onClose: () => void; onSaved: () => void;
}): React.JSX.Element {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('tarefa');
  const [start, setStart] = useState(toLocalInput(preset));
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!titulo || !start) return;
    setBusy(true);
    try {
      await api.post('/api/activities', {
        titulo, tipo, start_at: new Date(start).toISOString(), company_id: companyId,
      });
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Nova atividade" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar para cliente" className={inputCls} />
        <div className="grid grid-cols-4 gap-1.5">
          {TIPOS.map((t) => (
            <button key={t} type="button" onClick={() => setTipo(t)}
              className={cn('flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition',
                tipo === t ? 'border-transparent ' + TIPO[t]!.chip : 'border-ink-200 text-ink-500 hover:bg-ink-50')}>
              <Icon name={TIPO[t]!.icon} size={16} />{TIPO[t]!.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-ink-600">Quando</span>
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={cn(inputCls, 'mt-1')} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-600">Empresa do funil</span>
          <select value={companyId ?? ''} onChange={(e) => setCompanyId(e.target.value === '' ? null : Number(e.target.value))} className={cn(inputCls, 'mt-1')}>
            <option value="">Sem vínculo</option>
            {funnel.map((f) => <option key={f.company_id} value={f.company_id}>{f.label}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" type="button" onClick={onClose}>Cancelar</Btn>
          <Btn icon="check" type="submit" disabled={busy}>{busy ? '…' : 'Salvar'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

/* ── day-detail modal ───────────────────────────────────── */
function DayModal({ date, events, onClose, onToggle, onRemove, onAdd }: {
  date: Date; events: Activity[]; onClose: () => void;
  onToggle: (a: Activity) => void; onRemove: (a: Activity) => void; onAdd: () => void;
}): React.JSX.Element {
  return (
    <Modal title={fmtDayLong(date)} onClose={onClose}>
      <div className="space-y-2">
        {events.length === 0
          ? <p className="py-6 text-center text-sm text-ink-400">Nenhuma atividade neste dia.</p>
          : events.map((a) => <Row key={a.id} a={a} onToggle={onToggle} onRemove={onRemove} />)}
      </div>
      <Btn variant="soft" icon="plus" onClick={onAdd} className="mt-3 w-full">Adicionar neste dia</Btn>
    </Modal>
  );
}
