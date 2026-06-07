import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { api, ApiError } from '../lib/api.ts';
import type { Recommendation } from '../lib/types.ts';
import { Btn, Badge, Card, EmptyState, PageHeader, ScoreBar, Segmented, Spinner, StatCard, cn, type Tone } from '../lib/ui.tsx';
import { Icon } from '../lib/icons.tsx';
import { CompanyFilterBar, useCompanyFilter } from '../lib/companyFilter.tsx';
import { CompanyModal } from '../lib/companyModal.tsx';

const MATCH_COLOR: Record<string, string> = {
  classe: '#039855', divisao: '#0284c7', secao: '#12b76a', nenhum: '#94a3b8',
};
const MATCH_LABEL: Record<string, string> = {
  classe: 'CNAE exato', divisao: 'Mesma divisão', secao: 'Mesma seção', nenhum: 'Sem match',
};
const MATCH_TONE: Record<string, Tone> = {
  classe: 'success', divisao: 'info', secao: 'brand', nenhum: 'neutral',
};

function FitBounds({ recs }: { recs: Recommendation[] }): null {
  const map = useMap();
  useEffect(() => {
    const pts = recs.filter((r) => r.lat && r.lon).map((r) => [r.lat, r.lon] as [number, number]);
    if (pts.length > 0) map.fitBounds(pts as LatLngBoundsExpression, { padding: [40, 40], maxZoom: 13 });
  }, [recs, map]);
  return null;
}

export function Recommend(): React.JSX.Element {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [offset, setOffset] = useState(0);
  const [done, setDone] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'lista' | 'mapa'>('lista');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const filter = useCompanyFilter('prospeccao');
  const LIMIT = 20;

  const load = async (off: number): Promise<void> => {
    setLoading(true);
    setErr('');
    try {
      const r = await api.get<{ results: Recommendation[]; page: { count: number } }>(
        `/api/recommend?limit=${LIMIT}&offset=${off}`,
      );
      setRecs((prev) => (off === 0 ? r.results : [...prev, ...r.results]));
      setDone(r.results.length < LIMIT);
      setOffset(off + r.results.length);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao buscar recomendações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(0); /* eslint-disable-next-line */ }, []);

  const addToFunnel = async (rec: Recommendation): Promise<void> => {
    try {
      await api.post('/api/relationships', { company_id: Number(rec.id) });
      setAdded((s) => new Set(s).add(rec.id));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const visibleRecs = useMemo(() => filter.apply(recs), [filter.apply, recs]);
  const oculto = recs.length - visibleRecs.length;

  const center = useMemo<[number, number]>(() => {
    const first = visibleRecs.find((r) => r.lat && r.lon);
    return first ? [first.lat, first.lon] : [-15.78, -47.93];
  }, [visibleRecs]);

  // analytics KPIs derived from the visible (filtered) recommendations
  const kpi = useMemo(() => {
    const n = visibleRecs.length;
    const avg = n ? visibleRecs.reduce((s, r) => s + r.score, 0) / n : 0;
    const exact = visibleRecs.filter((r) => r.reason.cnae_match === 'classe').length;
    const dists = visibleRecs.filter((r) => r.reason.distancia_km != null).map((r) => r.reason.distancia_km);
    const near = dists.length ? Math.min(...dists) : 0;
    return { n, avg, exact, near };
  }, [visibleRecs]);

  if (err && recs.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">{err}</p>
          <Link to="/config" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Configurar perfil-alvo <Icon name="chevronRight" size={15} />
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 p-4 sm:p-6">
        <PageHeader
          title="Empresas recomendadas"
          subtitle={`${recs.length} no seu território · ranqueadas por fit`}
          actions={
            <div className="flex items-center gap-2">
              <Btn variant={filter.filtroAtivo ? 'primary' : 'soft'} icon="search" onClick={() => setFiltersOpen((v) => !v)}>
                Filtros{oculto > 0 ? ` · ${oculto} ocultos` : ''}
              </Btn>
              <Segmented value={view} onChange={setView} options={[
                { value: 'lista', label: 'Lista', icon: 'list' },
                { value: 'mapa', label: 'Mapa', icon: 'map' },
              ]} />
            </div>
          }
        />

        {filtersOpen && <CompanyFilterBar f={filter} />}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={oculto > 0 ? 'Recomendações (filtradas)' : 'Recomendações'} value={kpi.n} icon="building" tone="brand" />
          <StatCard label="Score médio" value={(kpi.avg * 100).toFixed(0)} sub="de 100" icon="trendingUp" tone="success" />
          <StatCard label="CNAE exato" value={kpi.exact} sub="match de classe" icon="target" tone="info" />
          <StatCard label="Mais próxima" value={`${kpi.near.toFixed(0)} km`} icon="mapPin" tone="warn" />
        </div>
      </div>

      {view === 'mapa' ? (
        <div className="min-h-0 flex-1 px-4 pb-4 sm:px-6 sm:pb-6">
          <Card className="h-full overflow-hidden p-0">
            <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitBounds recs={visibleRecs} />
              {visibleRecs.filter((r) => r.lat && r.lon).map((r) => (
                <CircleMarker key={r.id} center={[r.lat, r.lon]} radius={7}
                  pathOptions={{ color: MATCH_COLOR[r.reason.cnae_match], fillOpacity: 0.7 }}>
                  <Popup>
                    <div className="space-y-1">
                      <p className="font-semibold">{r.razao_social}</p>
                      <p className="text-xs">Score {(r.score * 100).toFixed(0)} · {r.reason.distancia_km} km</p>
                      <button onClick={() => setViewing(Number(r.id))} className="text-xs font-semibold text-brand-700 underline">Ver dados da empresa</button>
                      {added.has(r.id)
                        ? <span className="text-xs text-emerald-600">✓ no funil</span>
                        : <button onClick={() => addToFunnel(r)} className="text-xs font-semibold text-brand-700 underline">+ Adicionar ao funil</button>}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </Card>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-4 pb-4 sm:px-6 sm:pb-6">
          {visibleRecs.map((r) => (
            <RecCard key={r.id} rec={r} added={added.has(r.id)} onAdd={() => addToFunnel(r)} onView={() => setViewing(Number(r.id))} />
          ))}
          {!loading && recs.length > 0 && visibleRecs.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-400">Nenhuma recomendação bate com os filtros.</p>
          )}
          {loading && <Spinner />}
          {!loading && !done && (
            <Btn variant="ghost" onClick={() => load(offset)}
              className="w-full border border-ink-200 bg-white text-ink-600 hover:bg-ink-50">
              Carregar mais
            </Btn>
          )}
          {recs.length === 0 && !loading && (
            <EmptyState icon="building" title="Nenhuma empresa nova no território"
              hint="Ajuste seus CNAEs-alvo ou amplie o território no Perfil-alvo." />
          )}
        </div>
      )}

      {viewing !== null && <CompanyModal companyId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function RecCard({ rec, added, onAdd, onView }: { rec: Recommendation; added: boolean; onAdd: () => void; onView: () => void }): React.JSX.Element {
  const c = rec.reason.componentes;
  const score = rec.score * 100;
  return (
    <Card className="p-4 transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-500">
            <Icon name="building" size={20} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="truncate font-semibold text-ink-900">{rec.nome_fantasia || rec.razao_social}</p>
              <button type="button" onClick={onView} title="Ver dados da empresa"
                className="shrink-0 rounded-md p-0.5 text-ink-300 transition hover:bg-ink-100 hover:text-brand-600">
                <Icon name="eye" size={15} />
              </button>
            </div>
            <p className="truncate text-xs text-ink-400">{rec.razao_social} · {rec.uf}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={cn('tabnums text-xl font-bold', score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-brand-600' : 'text-ink-500')}>
            {score.toFixed(0)}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">score</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone={MATCH_TONE[rec.reason.cnae_match]}>{MATCH_LABEL[rec.reason.cnae_match]}</Badge>
        <Badge tone="neutral">CNAE {rec.cnae_principal}</Badge>
        <Badge tone="neutral"><Icon name="mapPin" size={12} />{rec.reason.distancia_km} km</Badge>
        <Badge tone="neutral">porte {rec.reason.porte}</Badge>
      </div>

      <div className="mt-3 flex gap-2">
        <ScoreBar label="CNAE" value={c.cnae} />
        <ScoreBar label="Prox." value={c.proximidade} />
        <ScoreBar label="Porte" value={c.porte} />
      </div>

      <div className="mt-3">
        {added
          ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600"><Icon name="check" size={16} /> Adicionado ao funil</span>
          : <Btn size="sm" icon="plus" onClick={onAdd}>Adicionar ao funil</Btn>}
      </div>
    </Card>
  );
}
