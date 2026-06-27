// useCompanyFilter: filtragem client-side e persistência do filtro de empresas.
// O perfil-alvo foi removido; o território (municípios) agora vive no filtro,
// persistido no navegador (companyFilter:reco) e aplicado ao client-side.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCompanyFilter, type FilterableCompany } from '../src/lib/companyFilter.tsx';
import type { Municipio } from '../src/lib/types.ts';

// O hook não consulta a API; mock evita rede caso o módulo seja exercitado.
vi.mock('../src/lib/api.ts', () => ({ api: { get: vi.fn().mockResolvedValue({ ufs: [], municipios: [] }) } }));

const co = (over: Partial<FilterableCompany>): FilterableCompany => ({
  razao_social: 'Empresa Padrão LTDA', nome_fantasia: null, cnpj: '11222333000144',
  cnae_principal: 4781400, uf: 'SP', municipio_id: 100, porte: 'pequeno', ...over,
});
const mun = (id: number, uf = 'SP'): Municipio => ({ id, nome: `Cidade ${id}`, uf, regiao: 'Sudeste' });

beforeEach(() => { localStorage.clear(); });

describe('useCompanyFilter', () => {
  it('restringe ao território (municipio_id) com usarAlvo ligado por padrão', () => {
    const { result } = renderHook(() => useCompanyFilter('t1'));
    expect(result.current.usarAlvo).toBe(true);
    act(() => result.current.setTerritorio([mun(100)]));
    const dentro = co({});
    const fora = co({ municipio_id: 999 });
    expect(result.current.apply([dentro, fora])).toEqual([dentro]);
  });

  it('filtra por texto (razão/fantasia/cnpj), cnae e porte', () => {
    const { result } = renderHook(() => useCompanyFilter('t2'));
    act(() => result.current.setUsarAlvo(false));

    act(() => result.current.setFq('padaria'));
    const padaria = co({ razao_social: 'Padaria Pão Quente' });
    expect(result.current.apply([padaria, co({})])).toEqual([padaria]);

    act(() => result.current.setFq('11222333'));
    expect(result.current.apply([co({})])).toHaveLength(1); // bate no CNPJ

    act(() => { result.current.setFq(''); result.current.setFCnae('1111111'); });
    expect(result.current.apply([co({})])).toHaveLength(0);

    act(() => { result.current.setFCnae(''); result.current.setFPorte('micro'); });
    expect(result.current.apply([co({ porte: 'micro' }), co({})])).toHaveLength(1);
  });

  it('UF da tela sobrescreve o território', () => {
    const { result } = renderHook(() => useCompanyFilter('t3'));
    act(() => result.current.setTerritorio([mun(100)]));
    act(() => result.current.setFUf('sc, pr'));
    const sc = co({ uf: 'SC', municipio_id: 999 }); // fora do território, mas UF manda
    expect(result.current.apply([sc, co({ uf: 'SP' })])).toEqual([sc]);
  });

  it('limpar zera os filtros e desliga o território', () => {
    const { result } = renderHook(() => useCompanyFilter('t4'));
    act(() => { result.current.setFq('x'); result.current.setTerritorio([mun(100)]); });
    expect(result.current.filtroAtivo).toBe(true);
    act(() => result.current.limpar());
    expect(result.current.fq).toBe('');
    expect(result.current.usarAlvo).toBe(false);
    expect(result.current.filtroAtivo).toBe(false);
  });

  it('persiste o filtro e o território no localStorage', async () => {
    const { result } = renderHook(() => useCompanyFilter('t5'));
    act(() => { result.current.setFCnae('4781400'); result.current.setTerritorio([mun(100)]); });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('companyFilter:t5')!) as { fCnae: string };
      expect(saved.fCnae).toBe('4781400');
      const reco = JSON.parse(localStorage.getItem('companyFilter:reco')!) as { munis: Municipio[] };
      expect(reco.munis.map((mn) => mn.id)).toEqual([100]);
    });
  });

  it('estado salvo tem precedência sobre o default', () => {
    localStorage.setItem('companyFilter:t6',
      JSON.stringify({ fq: 'salvo', fCnae: '999', fUf: '', fPorte: '', usarAlvo: false }));
    const { result } = renderHook(() => useCompanyFilter('t6'));
    expect(result.current.fq).toBe('salvo');
    expect(result.current.fCnae).toBe('999');
    expect(result.current.usarAlvo).toBe(false);
  });
});
