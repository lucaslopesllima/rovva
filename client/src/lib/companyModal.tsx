import { useEffect, useState } from 'react';
import { api } from './api.ts';
import type { CompanyDetail } from './types.ts';
import { Spinner } from './ui.tsx';
import { Icon } from './icons.tsx';

// Modal só-leitura com todos os dados da empresa no banco. Usado no Funil e na Prospecção.
const PORTE_LABEL: Record<string, string> = {
  nao_informado: 'Não informado', micro: 'Microempresa', pequeno: 'Pequeno porte', demais: 'Demais',
};
const fmtCnpj = (s: string): string =>
  s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : s;
const fmtBrl = (n: number): string => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function InfoRow({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col border-b border-ink-100 py-2 last:border-0 sm:flex-row sm:gap-3">
      <span className="w-44 shrink-0 text-xs font-medium text-ink-400">{label}</span>
      <span className="text-sm text-ink-700">{value || <span className="text-ink-300">—</span>}</span>
    </div>
  );
}

export function CompanyModal({ companyId, onClose }: { companyId: number; onClose: () => void }): React.JSX.Element {
  const [data, setData] = useState<CompanyDetail | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setData(null); setErr(false);
    void api.get<{ company: CompanyDetail }>(`/api/companies/${companyId}`)
      .then((r) => setData(r.company)).catch(() => setErr(true));
  }, [companyId]);

  const raw = data?.raw_data && Object.keys(data.raw_data).length > 0 ? data.raw_data : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-ink-200 bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 p-5">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-ink-800">
            <Icon name="building" size={18} className="text-ink-400" /> Dados da empresa
          </h2>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {err ? (
            <p className="py-8 text-center text-sm text-ink-400">Não foi possível carregar.</p>
          ) : !data ? (
            <div className="py-8"><Spinner /></div>
          ) : (
            <>
              <InfoRow label="Razão social" value={data.razao_social} />
              <InfoRow label="Nome fantasia" value={data.nome_fantasia} />
              <InfoRow label="CNPJ" value={fmtCnpj(data.cnpj)} />
              <InfoRow label="CNAE principal" value={`${data.cnae_principal}${data.cnae_descricao ? ` — ${data.cnae_descricao}` : ''}`} />
              <InfoRow label="CNAEs secundários" value={data.cnae_secundarios?.length ? data.cnae_secundarios.join(', ') : null} />
              <InfoRow label="Cidade / UF" value={[data.cidade, data.uf].filter(Boolean).join(' · ')} />
              <InfoRow label="Região" value={data.regiao} />
              <InfoRow label="Porte" value={PORTE_LABEL[data.porte] ?? data.porte} />
              <InfoRow label="Capital social" value={fmtBrl(Number(data.capital_social))} />
              <InfoRow label="Situação cadastral" value={data.situacao_cadastral} />
              <InfoRow label="Fonte" value={data.source} />
              <InfoRow label="Coordenadas" value={data.lat != null && data.lon != null ? `${data.lat.toFixed(5)}, ${data.lon.toFixed(5)}` : null} />
              {raw && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-ink-400">Dados brutos (RFB)</p>
                  <pre className="overflow-x-auto rounded-xl bg-ink-50 p-3 text-xs text-ink-600">{JSON.stringify(raw, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
