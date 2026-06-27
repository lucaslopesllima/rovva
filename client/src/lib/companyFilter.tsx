import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.ts';
import type { Municipio } from './types.ts';
import { maskSearchCNPJ } from './format.ts';
import { Btn, cn } from './ui.tsx';
import { Icon } from './icons.tsx';

// Filtro de empresas reutilizado no Funil e na Prospecção (Recomendadas).
// No modo recommend, a barra também guarda a configuração da recomendação
// (território, raio e pesos do score) — que antes vinha do perfil-alvo e agora
// vive aqui, persistida no navegador e enviada ao /api/recommend a cada busca.

const inputCls = 'w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200';
const onlyDigits = (s: string): string => s.replace(/\D/g, '');
const parseCodes = (s: string): number[] => s.split(/[,\s]+/).map((x) => onlyDigits(x)).filter(Boolean).map(Number);
const parseUfs = (s: string): string[] => s.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => x.length === 2);
const PORTE_OPTS = [
  { v: 'micro', l: 'Micro' }, { v: 'pequeno', l: 'Pequeno' },
  { v: 'demais', l: 'Demais' }, { v: 'nao_informado', l: 'Não informado' },
];

export interface Pesos { cnae: number; proximidade: number; porte: number }
export const DEFAULT_PESOS: Pesos = { cnae: 0.5, proximidade: 0.3, porte: 0.2 };

// Config da recomendação compartilhada entre telas (busca + mapa de cobertura).
// Guardada fora do filtro por-tela porque o território é um conceito global.
interface RecoCfg { munis: Municipio[]; raio: number | ''; pesos: Pesos }
const RECO_KEY = 'companyFilter:reco';

function loadRecoCfg(): RecoCfg {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RECO_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as Partial<RecoCfg>;
      return { munis: p.munis ?? [], raio: p.raio ?? '', pesos: { ...DEFAULT_PESOS, ...p.pesos } };
    }
  } catch { /* storage indisponível */ }
  return { munis: [], raio: '', pesos: { ...DEFAULT_PESOS } };
}

// Lido por outras telas (ex.: mapa de cobertura) que precisam do mesmo território.
export function loadTerritorioIds(): number[] {
  return loadRecoCfg().munis.map((m) => m.id);
}

// Mínimo que um item precisa expor para ser filtrável.
export interface FilterableCompany {
  razao_social: string; nome_fantasia: string | null; cnpj: string;
  cnae_principal: number; uf: string; municipio_id: number | null; porte: string;
}

export interface CompanyFilter {
  fq: string; setFq: (s: string) => void;
  fCnae: string; setFCnae: (s: string) => void;
  fUf: string; setFUf: (s: string) => void;
  fPorte: string; setFPorte: (s: string) => void;
  usarAlvo: boolean; setUsarAlvo: (b: boolean) => void;
  // config da recomendação (modo recommend)
  territorio: Municipio[]; setTerritorio: (m: Municipio[]) => void;
  raio: number | ''; setRaio: (r: number | '') => void;
  pesos: Pesos; setPesos: (p: Pesos) => void;
  filtroAtivo: boolean;
  limpar: () => void;
  apply: <T extends FilterableCompany>(items: T[]) => T[];
}

interface Persisted { fq: string; fCnae: string; fUf: string; fPorte: string; usarAlvo: boolean }

function loadSaved(key: string): Persisted | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch { return null; }
}

// storageKey separa a persistência por tela (funil vs prospecção).
export function useCompanyFilter(storageKey = 'default'): CompanyFilter {
  const key = `companyFilter:${storageKey}`;
  const saved = useMemo(() => loadSaved(key), [key]);
  const reco = useMemo(() => loadRecoCfg(), []);

  const [fq, setFq] = useState(saved?.fq ?? '');
  const [fCnae, setFCnae] = useState(saved?.fCnae ?? '');
  const [fUf, setFUf] = useState(saved?.fUf ?? '');
  const [fPorte, setFPorte] = useState(saved?.fPorte ?? '');
  const [usarAlvo, setUsarAlvo] = useState(saved?.usarAlvo ?? true);
  const [territorio, setTerritorio] = useState<Municipio[]>(reco.munis);
  const [raio, setRaio] = useState<number | ''>(reco.raio);
  const [pesos, setPesos] = useState<Pesos>(reco.pesos);

  // Persiste o estado do filtro a cada mudança.
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ fq, fCnae, fUf, fPorte, usarAlvo }));
    } catch { /* storage indisponível */ }
  }, [key, fq, fCnae, fUf, fPorte, usarAlvo]);

  // Persiste a config da recomendação (compartilhada).
  useEffect(() => {
    try {
      localStorage.setItem(RECO_KEY, JSON.stringify({ munis: territorio, raio, pesos }));
    } catch { /* storage indisponível */ }
  }, [territorio, raio, pesos]);

  const muniIds = useMemo(() => territorio.map((m) => m.id), [territorio]);

  const apply = useMemo(() => {
    const cnaes = parseCodes(fCnae);
    const ufs = parseUfs(fUf);
    const muniSet = new Set(muniIds);
    const qd = onlyDigits(fq);
    const ql = fq.trim().toLowerCase();
    return <T extends FilterableCompany>(items: T[]): T[] => items.filter((c) => {
      if (ql) {
        const hay = `${c.razao_social} ${c.nome_fantasia ?? ''}`.toLowerCase();
        if (!(hay.includes(ql) || (qd !== '' && c.cnpj.includes(qd)))) return false;
      }
      if (cnaes.length && !cnaes.includes(c.cnae_principal)) return false;
      if (fPorte && c.porte !== fPorte) return false;
      if (ufs.length) {
        if (!ufs.includes(c.uf)) return false;             // UF da tela sobrescreve território
      } else if (usarAlvo && muniSet.size > 0) {
        if (c.municipio_id == null || !muniSet.has(c.municipio_id)) return false;
      }
      return true;
    });
  }, [fq, fCnae, fUf, fPorte, usarAlvo, muniIds]);

  const filtroAtivo = fq.trim() !== '' || fCnae.trim() !== '' || fUf.trim() !== '' || fPorte !== '' || usarAlvo;
  const limpar = (): void => { setFq(''); setFCnae(''); setFUf(''); setFPorte(''); setUsarAlvo(false); };

  return {
    fq, setFq, fCnae, setFCnae, fUf, setFUf, fPorte, setFPorte, usarAlvo, setUsarAlvo,
    territorio, setTerritorio, raio, setRaio, pesos, setPesos,
    filtroAtivo, limpar, apply,
  };
}

export function CompanyFilterBar({ f, recommend = false }: { f: CompanyFilter; recommend?: boolean }): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ink-200/70 bg-surface p-3 shadow-card">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">Nome / CNPJ</span>
            <input value={f.fq} onChange={(e) => f.setFq(maskSearchCNPJ(e.target.value))} placeholder="Razão, fantasia ou CNPJ" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">{recommend ? 'CNAEs-alvo (códigos)' : 'CNAE (códigos)'}</span>
            <input value={f.fCnae} onChange={(e) => f.setFCnae(e.target.value)} placeholder="Ex.: 4781400, 4782201" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">UF</span>
            <input value={f.fUf} onChange={(e) => f.setFUf(e.target.value)} placeholder="Ex.: SC, PR" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-500">Porte</span>
            <select value={f.fPorte} onChange={(e) => f.setFPorte(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {PORTE_OPTS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </label>
        </div>
        {!recommend && (
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <label className={cn('inline-flex items-center gap-2 text-xs font-medium text-ink-600', f.territorio.length === 0 && 'opacity-50')}>
              <input type="checkbox" checked={f.usarAlvo} onChange={(e) => f.setUsarAlvo(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-300" disabled={f.territorio.length === 0} />
              Restringir ao território
              {f.territorio.length > 0 && <span className="text-ink-400">({f.territorio.length} municípios)</span>}
            </label>
            <span className="text-xs text-ink-400">UF da tela sobrescreve o território.</span>
            <div className="ml-auto">
              <Btn size="sm" variant="ghost" type="button" onClick={f.limpar}>Limpar</Btn>
            </div>
          </div>
        )}
      </div>
      {recommend && <RecommendConfig f={f} />}
    </div>
  );
}

// Painel de configuração do score (modo recommend): território (municípios + UF
// inteiro), raio opcional e pesos. Migrado da antiga tela de Perfil-alvo.
function RecommendConfig({ f }: { f: CompanyFilter }): React.JSX.Element {
  const [munQ, setMunQ] = useState('');
  const [munResults, setMunResults] = useState<Municipio[]>([]);
  const [ufs, setUfs] = useState<{ uf: string; total: number }[]>([]);
  const munDebounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    void api.get<{ ufs: { uf: string; total: number }[] }>('/api/municipios/ufs')
      .then((r) => setUfs(r?.ufs ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (munDebounce.current) clearTimeout(munDebounce.current);
    if (munQ.trim().length < 1) { setMunResults([]); return; }
    munDebounce.current = window.setTimeout(async () => {
      const r = await api.get<{ municipios: Municipio[] }>(`/api/municipios/search?q=${encodeURIComponent(munQ.trim())}`);
      setMunResults(r?.municipios ?? []);
    }, 250);
  }, [munQ]);

  const sel = f.territorio;
  const addMun = (m: Municipio): void => {
    if (!sel.some((x) => x.id === m.id)) f.setTerritorio([...sel, m]);
    setMunQ(''); setMunResults([]);
  };
  const removeMun = (id: number): void => f.setTerritorio(sel.filter((x) => x.id !== id));
  const removeUf = (uf: string): void => f.setTerritorio(sel.filter((x) => x.uf !== uf));
  const toggleUf = async (uf: string, full: boolean): Promise<void> => {
    if (full) { removeUf(uf); return; }
    const novos = (await api.get<{ municipios: Municipio[] }>(`/api/municipios/by-uf?uf=${uf}`))?.municipios ?? [];
    const ids = new Set(sel.map((m) => m.id));
    f.setTerritorio([...sel, ...novos.filter((m) => !ids.has(m.id))]);
  };

  const countByUf: Record<string, number> = {};
  for (const m of sel) countByUf[m.uf] = (countByUf[m.uf] ?? 0) + 1;
  const isFull = (uf: string, total: number): boolean => (countByUf[uf] ?? 0) === total && total > 0;
  const fullUfs = ufs.filter((u) => isFull(u.uf, u.total)).map((u) => u.uf);
  const looseCities = sel.filter((m) => !fullUfs.includes(m.uf)).sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* Território */}
      <div className="rounded-2xl border border-ink-200/70 bg-surface p-3 shadow-card">
        <h4 className="text-sm font-semibold text-ink-900">Território</h4>
        <p className="mt-0.5 text-xs text-ink-400">Onde a recomendação busca. O raio (km) é opcional — recomenda por proximidade ao centro do território.</p>

        <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Por estado</p>
        <div className="flex flex-wrap gap-1">
          {ufs.map((u) => {
            const full = isFull(u.uf, u.total);
            const partial = !full && (countByUf[u.uf] ?? 0) > 0;
            return (
              <button key={u.uf} onClick={() => void toggleUf(u.uf, full)} title={`${u.total} municípios`}
                className={cn('rounded-lg px-2 py-1 text-xs font-bold transition-colors',
                  full ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : partial ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                    : 'bg-ink-100 text-ink-500 hover:bg-ink-200')}>
                {u.uf}{partial && <span className="ml-1 font-medium opacity-70">{countByUf[u.uf]}</span>}
              </button>
            );
          })}
        </div>

        <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Por cidade</p>
        <div className="relative">
          <Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={munQ} onChange={(e) => setMunQ(e.target.value)} placeholder="Buscar cidade (ex.: Blumenau)…" className={cn(inputCls, 'pl-9')} />
          {munResults.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-ink-200 bg-surface py-1 shadow-pop">
              {munResults.map((m) => {
                const on = sel.some((x) => x.id === m.id);
                return (
                  <button key={m.id} onClick={() => addMun(m)} disabled={on}
                    className={cn('flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50 disabled:opacity-40', on && 'cursor-default')}>
                    <span className="truncate text-ink-700"><Icon name="mapPin" size={13} className="mr-1.5 inline text-ink-400" />{m.nome}</span>
                    <span className="shrink-0 text-xs font-semibold text-ink-400">{on ? 'adicionado' : m.uf}</span>
                  </button>
                );
              })}
            </div>
          )}
          {munQ.trim().length >= 1 && munResults.length === 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm text-ink-400 shadow-pop">
              Nenhuma cidade encontrada para “{munQ.trim()}”.
            </div>
          )}
        </div>

        {sel.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {fullUfs.map((uf) => (
              <button key={uf} onClick={() => removeUf(uf)}
                className="inline-flex items-center gap-1 rounded-full bg-ink-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-ink-900">
                <Icon name="layers" size={12} /> {uf} inteiro · {countByUf[uf]} <Icon name="x" size={12} />
              </button>
            ))}
            {looseCities.map((m) => (
              <button key={m.id} onClick={() => removeMun(m.id)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700">
                {m.nome} <span className="text-brand-200">· {m.uf}</span> <Icon name="x" size={12} />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-400">Nenhum município selecionado — defina o território para buscar.</p>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-semibold text-ink-600">Raio (km) — opcional</span>
          <input type="number" min={0} value={f.raio} onChange={(e) => f.setRaio(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="ex.: 50" className={cn(inputCls, 'mt-1 w-32')} />
        </label>
      </div>

      {/* Pesos do score */}
      <div className="rounded-2xl border border-ink-200/70 bg-surface p-3 shadow-card">
        <h4 className="text-sm font-semibold text-ink-900">Pesos do score</h4>
        <p className="mt-0.5 text-xs text-ink-400">Quanto cada fator influencia o ranqueamento.</p>
        {(['cnae', 'proximidade', 'porte'] as const).map((k) => (
          <label key={k} className="mt-3 block">
            <div className="flex justify-between text-xs font-semibold text-ink-600">
              <span className="capitalize">{k}</span><span className="tabnums text-brand-600">{f.pesos[k].toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={f.pesos[k]}
              onChange={(e) => f.setPesos({ ...f.pesos, [k]: Number(e.target.value) })}
              className="mt-1.5 w-full accent-brand-600" />
          </label>
        ))}
        <div className="mt-4 flex justify-end">
          <Btn size="sm" variant="ghost" type="button" onClick={f.limpar}>Limpar filtros</Btn>
        </div>
      </div>
    </div>
  );
}
