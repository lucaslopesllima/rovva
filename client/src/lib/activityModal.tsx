import { useState } from 'react';
import { api } from './api.ts';
import { Btn, Card, cn } from './ui.tsx';
import { Icon, type IconName } from './icons.tsx';

// Modal de criação de atividade/compromisso. Reutilizado na Agenda e no Funil.
const inputCls = 'w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200';

const TIPOS: { v: string; label: string; icon: IconName; chip: string }[] = [
  { v: 'tarefa', label: 'Tarefa', icon: 'check', chip: 'bg-brand-50 text-brand-700' },
  { v: 'ligacao', label: 'Ligação', icon: 'phone', chip: 'bg-sky-50 text-sky-700' },
  { v: 'visita', label: 'Visita', icon: 'mapPin', chip: 'bg-amber-50 text-amber-700' },
  { v: 'reuniao', label: 'Reunião', icon: 'users', chip: 'bg-violet-50 text-violet-700' },
];

export type FunnelCompany = { company_id: number; label: string };

const toLocalInput = (d: Date): string => {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export type EditableActivity = { id: number; titulo: string; tipo: string; start_at: string; company_id: number | null };

export function ActivityCreateModal({ preset, funnel, presetCompanyId, activity, onClose, onSaved }: {
  preset: Date; funnel: FunnelCompany[]; presetCompanyId?: number | null;
  activity?: EditableActivity;  // se presente → modo edição (PATCH)
  onClose: () => void; onSaved: () => void;
}): React.JSX.Element {
  const editando = !!activity;
  const [titulo, setTitulo] = useState(activity?.titulo ?? '');
  const [tipo, setTipo] = useState(activity?.tipo ?? 'tarefa');
  const [start, setStart] = useState(toLocalInput(activity ? new Date(activity.start_at) : preset));
  const [companyId, setCompanyId] = useState<number | null>(activity ? activity.company_id : (presetCompanyId ?? null));
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!titulo || !start) return;
    setBusy(true);
    try {
      const body = { titulo, tipo, start_at: new Date(start).toISOString(), company_id: companyId };
      if (editando) await api.patch(`/api/activities/${activity!.id}`, body);
      else await api.post('/api/activities', body);
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-ink-950/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-4 shadow-pop">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">{editando ? 'Editar atividade' : 'Nova atividade'}</h3>
            <button onClick={onClose} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100">
              <Icon name="x" size={17} />
            </button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar para cliente" className={inputCls} />
            <div className="grid grid-cols-4 gap-1.5">
              {TIPOS.map((t) => (
                <button key={t.v} type="button" onClick={() => setTipo(t.v)}
                  className={cn('flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-semibold transition',
                    tipo === t.v ? 'border-transparent ' + t.chip : 'border-ink-200 text-ink-500 hover:bg-ink-50')}>
                  <Icon name={t.icon} size={16} />{t.label}
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
        </div>
      </Card>
    </div>
  );
}
