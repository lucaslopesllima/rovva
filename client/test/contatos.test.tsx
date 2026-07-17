// Página de Contatos (Cadastros): CRUD, vínculo com empresa-prospect,
// validação de e-mail e gating por permissão.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Contatos } from '../src/pages/Contatos.tsx';
import { api } from '../src/lib/api.ts';
import { useAuth, type User } from '../src/lib/auth.tsx';
import { toast } from '../src/lib/toast.tsx';
import { confirmDialog } from '../src/lib/confirm.ts';

// Empresa devolvida pelo CompanySearch (controlável por teste).
const hoisted = vi.hoisted(() => ({
  companyHit: {
    id: 99, cnpj: '12345678000199', razao_social: 'Fornecedor RS',
    nome_fantasia: 'RS Marca', telefone1: '4830001111', email: 'contato@rs.com',
  } as Record<string, unknown>,
}));

vi.mock('../src/lib/api.ts', async (orig) => {
  const real = await orig() as Record<string, unknown>;
  return { ...real, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), invalidate: vi.fn() } };
});
vi.mock('../src/lib/auth.tsx', () => {
  const useAuth = vi.fn();
  return { useAuth, useOptionalUser: () => useAuth().user ?? null };
});
vi.mock('../src/lib/toast.tsx', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../src/lib/confirm.ts', () => ({ confirmDialog: vi.fn() }));
vi.mock('../src/lib/companySearch.tsx', () => ({
  CompanySearch: ({ onPick }: { onPick: (c: unknown) => void }) => (
    <button type="button" onClick={() => onPick(hoisted.companyHit)}>mock-pick</button>
  ),
}));

const m = vi.mocked(api);
const useAuthMock = vi.mocked(useAuth);
const toastMock = vi.mocked(toast);
const confirmMock = vi.mocked(confirmDialog);

const admin: User = { id: 1, email: 'a@b.c', role: 'admin', org_id: 1, org_nome: 'Org' };

// Fixtures reatribuíveis por teste antes do render.
let reps: Record<string, unknown>[];
let contacts: Record<string, unknown>[];

function setAuth(over: { user?: Partial<User>; can?: (c: string) => boolean } = {}): void {
  useAuthMock.mockReturnValue({
    user: { ...admin, ...(over.user ?? {}) }, loading: false,
    login: vi.fn(), register: vi.fn(), refresh: vi.fn(), logout: vi.fn(),
    can: over.can ?? (() => true), isOffice: true,
  });
}

beforeEach(() => {
  m.get.mockReset(); m.post.mockReset(); m.put.mockReset(); m.patch.mockReset(); m.del.mockReset();
  toastMock.success.mockReset(); toastMock.error.mockReset();
  confirmMock.mockReset(); confirmMock.mockResolvedValue(true);
  reps = []; contacts = [];
  setAuth();
  m.get.mockImplementation(async (p: string) => {
    if (p === '/api/represented') return { empresas: reps };
    if (p === '/api/contacts') return { contacts };
    return {};
  });
});

describe('Contatos', () => {
  const rep = { id: 5, nome: 'ACME', cnpj: null, segmento: null, site: null, contato: null, notas: null, ativo: true };
  const contact = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 10, nome: 'Maria', cargo: 'Compradora', email: 'maria@x.com', telefone: '4899', represented_id: 5, ...over,
  });

  it('cria contato com validação de e-mail', async () => {
    reps = [rep];
    m.post.mockResolvedValueOnce({ contact: contact({ id: 11, nome: 'Novo' }) });
    render(<Contatos />);
    await screen.findByText('Nenhum contato');
    await userEvent.click(screen.getByRole('button', { name: 'Novo' }));

    // submit sem nome: nada
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(m.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByPlaceholderText('Nome *'), 'Novo');
    // e-mail inválido p/ o EMAIL_RE (exige ponto) mas válido p/ o input type=email
    await userEvent.type(screen.getByPlaceholderText('E-mail'), 'a@b');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(toastMock.error).toHaveBeenCalledWith('E-mail inválido.');
    expect(m.post).not.toHaveBeenCalled();

    // corrige e-mail, escolhe representada, telefone com máscara
    await userEvent.clear(screen.getByPlaceholderText('E-mail'));
    await userEvent.type(screen.getByPlaceholderText('E-mail'), 'novo@x.com');
    await userEvent.selectOptions(screen.getByRole('combobox'), '5');
    await userEvent.type(screen.getByPlaceholderText('Telefone'), '48999998888');
    await userEvent.type(screen.getByPlaceholderText(/Cargo/), 'Gerente');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith('/api/contacts', expect.objectContaining({ nome: 'Novo', represented_id: 5 })));
    expect(toastMock.success).toHaveBeenCalledWith('Contato criado.');
  });

  it('vincula, troca e remove a empresa-prospect do contato', async () => {
    m.post.mockResolvedValueOnce({ contact: contact({ id: 21, nome: 'Com Empresa', company_id: 99, company_name: 'RS Marca' }) });
    render(<Contatos />);
    await screen.findByText('Nenhum contato');
    await userEvent.click(screen.getByRole('button', { name: 'Novo' }));
    await userEvent.type(screen.getByPlaceholderText('Nome *'), 'Com Empresa');

    // escolhe empresa via CompanySearch -> vira chip com nome fantasia
    await userEvent.click(screen.getByRole('button', { name: 'mock-pick' }));
    expect(await screen.findByText('RS Marca')).toBeInTheDocument();

    // remove -> volta o buscador
    await userEvent.click(screen.getByLabelText('Remover empresa'));
    expect(screen.getByRole('button', { name: 'mock-pick' })).toBeInTheDocument();

    // escolhe de novo e salva -> company_id vai no body
    await userEvent.click(screen.getByRole('button', { name: 'mock-pick' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith('/api/contacts', expect.objectContaining({ nome: 'Com Empresa', company_id: 99 })));

    // badge da empresa aparece na lista
    expect(await screen.findByText('RS Marca')).toBeInTheDocument();
  });

  it('edição de contato pré-carrega a empresa vinculada', async () => {
    contacts = [contact({ company_id: 99, company_name: 'RS Marca' })];
    m.patch.mockResolvedValueOnce({ contact: contact({ company_id: null, company_name: null }) });
    render(<Contatos />);
    // badge na linha
    expect(await screen.findByText('RS Marca')).toBeInTheDocument();

    // abre edição: chip preenchido; remove e salva -> company_id null no body
    await userEvent.click(screen.getAllByLabelText('Editar')[0]!);
    await userEvent.click(screen.getByLabelText('Remover empresa'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.patch).toHaveBeenCalledWith('/api/contacts/10', expect.objectContaining({ company_id: null })));
  });

  it('erro ao criar contato', async () => {
    m.post.mockRejectedValueOnce(new Error('c-fail'));
    render(<Contatos />);
    await screen.findByText('Nenhum contato');
    await userEvent.click(screen.getByRole('button', { name: 'Novo' }));
    await userEvent.type(screen.getByPlaceholderText('Nome *'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('c-fail'));

    // cancela o formulário novo (onCancel)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByPlaceholderText('Nome *')).not.toBeInTheDocument();
  });

  it('lista, edita e exclui contatos (com badges de cargo/representada)', async () => {
    reps = [rep];
    contacts = [contact(), contact({ id: 12, nome: 'Sem vinculo', cargo: null, email: null, telefone: null, represented_id: null })];
    m.patch.mockResolvedValueOnce({ contact: contact({ nome: 'Maria editada' }) });
    m.del.mockResolvedValueOnce({});
    render(<Contatos />);
    expect(await screen.findByText('Maria')).toBeInTheDocument();
    expect(screen.getByText('Compradora')).toBeInTheDocument();
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('sem contato')).toBeInTheDocument();

    // editar -> patch
    await userEvent.click(screen.getAllByLabelText('Editar')[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(m.patch).toHaveBeenCalledWith('/api/contacts/10', expect.objectContaining({ nome: 'Maria' })));
    expect(toastMock.success).toHaveBeenCalledWith('Contato salvo.');

    // excluir
    await userEvent.click(screen.getAllByLabelText('Excluir')[0]!);
    await waitFor(() => expect(m.del).toHaveBeenCalledWith('/api/contacts/10'));
    expect(toastMock.success).toHaveBeenCalledWith('Contato excluído.');
  });

  it('erros de edição/exclusão de contato', async () => {
    contacts = [contact()];
    render(<Contatos />);
    await screen.findByText('Maria');

    // update falha
    m.patch.mockRejectedValueOnce(new Error('cu-fail'));
    await userEvent.click(screen.getAllByLabelText('Editar')[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('cu-fail'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // delete cancelado
    confirmMock.mockResolvedValueOnce(false);
    await userEvent.click(screen.getAllByLabelText('Excluir')[0]!);
    expect(m.del).not.toHaveBeenCalled();

    // delete falha
    m.del.mockRejectedValueOnce(new Error('cd'));
    await userEvent.click(screen.getAllByLabelText('Excluir')[0]!);
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Não foi possível excluir o contato.'));
  });

  it('gating: sem permissões esconde ações', async () => {
    contacts = [contact()];
    setAuth({ can: () => false });
    render(<Contatos />);
    await screen.findByText('Maria');
    expect(screen.queryByRole('button', { name: 'Novo' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Excluir')).not.toBeInTheDocument();
  });
});
