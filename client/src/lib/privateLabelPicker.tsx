import { useEffect, useState } from 'react';
import { api } from './api.ts';
import type { PrivateLabel } from './types.ts';
import { Icon } from './icons.tsx';
import { Btn } from './ui.tsx';
import { toast } from './toast.tsx';

// Pill de uma private label com o ponto na cor escolhida (cor null → cinza).
export function LabelPill({ label, onRemove }: { label: PrivateLabel; onRemove?: () => void }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-700">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: label.cor || '#94a3b8' }} />
      <span className="truncate">{label.nome}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remover ${label.nome}`}
          className="grid h-3.5 w-3.5 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700">
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  );
}

const basePath = (kind: 'company' | 'contact', id: number): string =>
  `/api/${kind === 'company' ? 'companies' : 'contacts'}/${id}/private-labels`;

// Editor auto-contido das private labels de uma empresa OU de um contato. Carrega
// as labels atuais da entidade, e no modo edição mostra o catálogo inteiro em
// checkboxes. Salvar faz PUT do conjunto e invalida o cache do catálogo (contagens).
//
// Auto-gating: se o GET falhar (403 sem permissão, rota ausente) o componente some
// inteiro. Assim ele pode ser embutido em modais compartilhados sem que o pai
// precise consultar o contexto de auth — que nem sempre existe (testes, modais
// montados fora do AuthProvider). O servidor continua sendo a autoridade.
export function EntityLabels({ kind, id, canEdit = true, title }: {
  kind: 'company' | 'contact'; id: number; canEdit?: boolean; title?: string;
}): React.JSX.Element | null {
  const [current, setCurrent] = useState<PrivateLabel[]>([]);
  const [all, setAll] = useState<PrivateLabel[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    setOculto(false);
    void api.get<{ labels: PrivateLabel[] }>(basePath(kind, id))
      .then((r) => setCurrent(r.labels ?? []))
      .catch(() => setOculto(true));
  }, [kind, id]);

  if (oculto) return null;

  const openEdit = async (): Promise<void> => {
    setSel(new Set(current.map((l) => l.id)));
    setEditing(true);
    if (!all) {
      try {
        const r = await api.get<{ labels: PrivateLabel[] }>('/api/private-labels');
        setAll(r.labels ?? []);
      } catch { setAll([]); }
    }
  };

  const toggle = (lid: number): void =>
    setSel((s) => { const n = new Set(s); n.has(lid) ? n.delete(lid) : n.add(lid); return n; });

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await api.put(basePath(kind, id), { label_ids: [...sel] });
      api.invalidate('/api/private-labels'); // atualiza contagens no catálogo
      setCurrent((all ?? []).filter((l) => sel.has(l.id)));
      setEditing(false);
      toast.success('Private labels atualizadas.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };

  // Título opcional: quem embute (ex.: CompanyModal) não sabe se o bloco vai
  // aparecer, então o cabeçalho vem daqui para sumir junto.
  const wrap = (children: React.ReactNode): React.JSX.Element => (
    <div className="mt-4">
      {title && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>}
      {children}
    </div>
  );
  const out = (children: React.ReactNode): React.JSX.Element =>
    (title ? wrap(children) : <>{children}</>);

  if (editing) {
    return out(
      <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-3">
        {all === null ? (
          <p className="py-2 text-center text-xs text-ink-400">Carregando…</p>
        ) : all.length === 0 ? (
          <p className="py-2 text-center text-xs text-ink-400">Nenhuma private label cadastrada ainda.</p>
        ) : (
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {all.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} className="h-4 w-4 accent-brand-500" />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.cor || '#94a3b8' }} />
                <span className="truncate text-ink-700">{l.nome}</span>
              </label>
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Btn>
          <Btn size="sm" icon="check" onClick={() => void save()} disabled={busy}>{busy ? '…' : 'Salvar'}</Btn>
        </div>
      </div>,
    );
  }

  return out(
    <div className="flex flex-wrap items-center gap-1.5">
      {current.length === 0 ? (
        <span className="text-xs text-ink-300">Sem private labels</span>
      ) : current.map((l) => <LabelPill key={l.id} label={l} />)}
      {canEdit && (
        <button type="button" onClick={() => void openEdit()}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 px-2 py-0.5 text-[11px] font-medium text-ink-500 hover:border-brand-400 hover:text-brand-600">
          <Icon name="plus" size={11} /> Editar
        </button>
      )}
    </div>,
  );
}
