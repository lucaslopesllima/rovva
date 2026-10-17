// Fase 4: Dashboard agrega KPIs, funil, agenda, alertas e ranking.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../src/pages/Dashboard.tsx';
import { useAuth, type User } from '../src/lib/auth.tsx';
import { api } from '../src/lib/api.ts';

vi.mock('../src/lib/auth.tsx', () => {
  const useAuth = vi.fn();
  return { useAuth, useOptionalUser: () => useAuth().user ?? null };
});
vi.mock('../src/lib/api.ts', () => ({ api: { get: vi.fn() }, ApiError: class extends Error {} }));

const useAuthMock = vi.mocked(useAuth);
const m = vi.mocked(api);
const admin: User = { id: 1, email: 'a@b.c', role: 'admin', org_id: 1, nome: 'Chefe' };

const DATA = {
  competencia: '2026-06', inatividade_dias: 30,
  funil: [{ id: 1, nome: 'Prospecção', ordem: 1, qtd: 3, valor: '5000' }],
  vendas: { total: 1500, qtd: 2, meta: 3000 },
  comissoes: { previsto: 150, recebido: 50, divergentes: 1 },
  agenda: [{ id: 9, tipo: 'visita', titulo: 'Visitar ACME', start_at: '2026-06-13T14:00:00Z', company_id: 7, razao_social: 'ACME LTDA' }],
  alertas: {
    sem_contato: [{ id: 2, company_id: 7, razao_social: 'ACME LTDA', nome_fantasia: 'ACME', ultimo_contato: '2020-01-01', dias: 99 }],
    parados: [],
    sem_pedido: [],
  },
  ranking: [{ user_id: 1, nome: 'Chefe', email: 'a@b.c', total: '1500', qtd: 2 }],
};

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: admin, loading: false, login: vi.fn(), register: vi.fn(), refresh: vi.fn(), logout: vi.fn(), can: () => true, isOffice: true });
  m.get.mockReset();
  m.get.mockImplementation(async (p: string) => {
    if (p.startsWith('/api/dashboard')) return DATA;
    if (p === '/api/users') return { users: [] };
    return {};
  });
});

const mount = (): ReturnType<typeof render> => render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe('Dashboard', () => {
  it('mostra KPIs, funil, agenda, alerta e ranking', async () => {
    mount();
    expect(await screen.findByText('Vendas do mês')).toBeInTheDocument();
    expect(screen.getByText('Prospecção')).toBeInTheDocument();
    expect(screen.getByText('Visitar ACME')).toBeInTheDocument();
    expect(screen.getByText('99 dias')).toBeInTheDocument();
    expect(screen.getByText('Ranking de vendas do mês')).toBeInTheDocument();
  });

  it('chama o dashboard com a competência do mês', async () => {
    mount();
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    expect(vi.mocked(m.get).mock.calls.some(([p]) => String(p).startsWith('/api/dashboard?competencia='))).toBe(true);
  });

  it('estados vazios (funil/agenda/sem contato) e lista de parados', async () => {
    const DATA2 = {
      ...DATA, funil: [], agenda: [], vendas: { total: 0, qtd: 0, meta: 0 },
      alertas: {
        sem_contato: [],
        parados: [{ id: 3, company_id: 8, razao_social: 'BETA SA', nome_fantasia: null, stage: 'Proposta', desde: '2020-01-01', dias: 45 }],
        sem_pedido: [],
      },
      ranking: [],
    };
    m.get.mockImplementation(async (p: string) => p.startsWith('/api/dashboard') ? DATA2 : { users: [] });
    mount();
    expect(await screen.findByText('Funil vazio')).toBeInTheDocument();
    expect(screen.getByText('Nada para hoje')).toBeInTheDocument();
    expect(screen.getByText('Tudo em dia.')).toBeInTheDocument();
    expect(screen.getByText('BETA SA')).toBeInTheDocument();
    expect(screen.getByText('45 dias')).toBeInTheDocument();
    expect(screen.getByText('Toda a carteira comprou nos últimos 30 dias.')).toBeInTheDocument();
  });

  it('clientes sem pedido: card mostra 8 e "ver todos" abre modal com a lista inteira', async () => {
    const sem_pedido = Array.from({ length: 10 }, (_, i) => ({
      company_id: 100 + i, razao_social: `CLIENTE ${i}`, nome_fantasia: null, telefone1: i === 0 ? '11912345678' : null,
      relationship_id: i === 0 ? 50 : null, ultimo_pedido: '2026-01-15', dias: 120 - i * 10,
    }));
    m.get.mockImplementation(async (p: string) => p.startsWith('/api/dashboard') ? { ...DATA, alertas: { ...DATA.alertas, sem_pedido } } : { users: [], contacts: [] });
    mount();
    expect(await screen.findByText('CLIENTE 0')).toHaveAttribute('href', '/funil?relationship_id=50');
    expect(screen.queryByText('CLIENTE 9')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos (10)' }));
    expect(await screen.findByText('CLIENTE 9')).toBeInTheDocument();
    expect(screen.getAllByText('15/01/2026').length).toBeGreaterThan(8);
    // agendar WhatsApp: abre o modal de atividade já no tipo WhatsApp com o telefone do cliente
    fireEvent.click(screen.getByRole('button', { name: 'Agendar WhatsApp para CLIENTE 0' }));
    expect(await screen.findByDisplayValue('(11) 91234-5678')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Texto da mensagem…')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' }).at(-1)!);
    await waitFor(() => expect(screen.queryByPlaceholderText('Texto da mensagem…')).not.toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('CLIENTE 9')).not.toBeInTheDocument());
  });

  it('troca a competência do mês', async () => {
    mount();
    await screen.findByText('Vendas do mês');
    fireEvent.change(screen.getByLabelText('Competência'), { target: { value: '2026-05' } });
    await waitFor(() => expect(vi.mocked(m.get).mock.calls.some(([p]) => String(p).includes('competencia=2026-05'))).toBe(true));
  });
});
