// CompanyModal: modal só-leitura com todos os dados da empresa (RFB) + sócios,
// geolocalização (do banco ou sob demanda), telefone WhatsApp e dados brutos.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompanyModal } from '../src/lib/companyModal.tsx';
import { api, ApiError } from '../src/lib/api.ts';
import { toast } from '../src/lib/toast.tsx';
import type { CompanyDetail, Socio } from '../src/lib/types.ts';

vi.mock('../src/lib/api.ts', () => ({ api: { get: vi.fn(), post: vi.fn(), invalidate: vi.fn() }, ApiError: class extends Error { status: number; constructor(s: number, msg: string) { super(msg); this.status = s; } } }));
vi.mock('../src/lib/toast.tsx', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const m = vi.mocked(api);

const company = (over: Partial<CompanyDetail> = {}): CompanyDetail => ({
  id: 1, cnpj: '11222333000144', razao_social: 'Alvo Comercio LTDA', nome_fantasia: 'Loja Alvo',
  cnae_principal: 4781400, cnae_descricao: 'Comércio varejista', cnae_secundarios: [4711301, 4712100],
  uf: 'SP', municipio_id: 100, cidade: 'São Paulo', regiao: 'Sudeste',
  porte: 'micro', capital_social: '100000', situacao_cadastral: 'Ativa', source: 'RFB',
  logradouro: 'Rua XV', numero: '100', complemento: 'Sala 2', bairro: 'Centro', cep: '01001000',
  telefone1: '1133334444', telefone2: '11', email: 'a@b.c', fax: '1133335555',
  data_inicio_atividade: '2010-05-01', matriz_filial: 1,
  natureza_juridica: 2062, natureza_descricao: 'Sociedade LTDA',
  qualificacao_responsavel: 49, qualificacao_descricao: 'Sócio-administrador',
  ente_federativo: null,
  motivo_situacao: 0, motivo_descricao: 'Sem motivo',
  data_situacao_cadastral: '2010-05-01', situacao_especial: null,
  data_situacao_especial: null,
  nome_cidade_exterior: null, pais: null, pais_nome: 'Brasil',
  opcao_simples: 'S', data_opcao_simples: '2011-01-01', data_exclusao_simples: null,
  opcao_mei: 'N', data_opcao_mei: null, data_exclusao_mei: null,
  lat: -23.5, lon: -46.6, raw_data: { extra: 'x' },
  geo_lat: -23.55, geo_lon: -46.63, geo_precisao: 'rua',
  ...over,
});

const socio = (over: Partial<Socio> = {}): Socio => ({
  identificador: 2, nome: 'João', cnpj_cpf: '***123***', qualificacao: 49,
  qualificacao_descricao: 'Sócio', data_entrada: '2010-05-01', faixa_etaria: 5,
  nome_representante: null, representante_legal: null, ...over,
});

// GET do acompanhamento com o mapeamento já terminado.
const pronto = (c: unknown) => ({ contatos_site: { url: 'https://www.alvo.com.br/', status: 'pronto', ...(c as object) } });

const VAZIO = { local: null, redes: [], contatos: [], links: [], socios: [], buscado_em: '2026-09-20T12:00:00Z' };

beforeEach(() => {
  m.get.mockReset();
  m.post.mockReset();
  m.post.mockResolvedValue({ status: 'lendo' }); // início do mapeamento do site
  vi.mocked(toast.error).mockReset();
});

describe('CompanyModal', () => {
  it('erro no carregamento mostra mensagem', async () => {
    m.get.mockRejectedValue(new Error('falha'));
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('Não foi possível carregar.')).toBeInTheDocument();
  });

  it('renderiza todos os dados com geo do banco e sócios', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company(), socios: [socio(), socio({ identificador: null, cnpj_cpf: null, data_entrada: null, faixa_etaria: null, nome_representante: 'Repr X', nome: null, qualificacao_descricao: null })] };
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('Alvo Comercio LTDA')).toBeInTheDocument();
    expect(screen.getByText('11.222.333/0001-44')).toBeInTheDocument(); // fmtCnpj 14 dígitos
    expect(screen.getByText('Matriz')).toBeInTheDocument();
    expect(screen.getByText('Sociedade LTDA')).toBeInTheDocument();
    expect(screen.getByText(/-23.55000, -46.63000/)).toBeInTheDocument(); // geo do banco
    expect(screen.getByText('Repr X', { exact: false })).toBeInTheDocument();
    // dados brutos (raw_data não vazio)
    expect(screen.getByText(/Dados brutos/)).toBeInTheDocument();
  });

  it('sem geo no banco geocodifica sob demanda; sócios vazios; filial; fallbacks', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return {
        company: company({
          geo_lat: null, geo_lon: null, geo_precisao: null, nome_fantasia: null,
          matriz_filial: 2, natureza_descricao: null, natureza_juridica: 2062,
          porte: 'desconhecido', cnae_secundarios: [], pais_nome: null, pais: 76,
          opcao_simples: 'N', opcao_mei: null, raw_data: {},
          motivo_descricao: null, motivo_situacao: 5,
          qualificacao_descricao: null, qualificacao_responsavel: 49,
          data_inicio_atividade: 'texto-nao-data', cnpj: '123',
        }),
        socios: [],
      };
      if (p === '/api/companies/1/geocode') return { geocode: { lat: -1, lon: -2, precisao: 'inexistente' } };
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('Filial')).toBeInTheDocument();
    expect(screen.getByText('Nenhum sócio informado.')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument(); // fmtCnpj não-14
    expect(screen.getByText('desconhecido')).toBeInTheDocument(); // PORTE_LABEL fallback
    await waitFor(() => expect(screen.getByText(/-1.00000, -2.00000/)).toBeInTheDocument());
    expect(screen.getByText(/inexistente/)).toBeInTheDocument(); // PRECISAO_LABEL fallback
    // sem raw_data
    expect(screen.queryByText(/Dados brutos/)).not.toBeInTheDocument();
  });

  it('geocode sob demanda que falha é ignorado (fica "localizando…")', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company({ geo_lat: null, geo_lon: null }), socios: [] };
      if (p === '/api/companies/1/geocode') throw new Error('geo falhou');
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('localizando…')).toBeInTheDocument();
  });

  it('telefone abre WhatsApp; erro dispara toast', async () => {
    const orig = window.location;
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { href: '' } });
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company({ telefone2: null, fax: null }), socios: [] };
      return {};
    });
    m.post.mockResolvedValueOnce({ chat: { id: 7 } });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    const waBtn = screen.getByTitle('Abrir conversa no WhatsApp');
    await userEvent.click(waBtn);
    await waitFor(() => expect(window.location.href).toBe('/whatsapp?chat=7'));

    m.post.mockRejectedValueOnce(new ApiError(500, 'boom'));
    await userEvent.click(screen.getByTitle('Abrir conversa no WhatsApp'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'));
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: orig });
  });

  it('telefone curto (sem waLink) mostra texto sem botão', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company({ telefone1: '123', telefone2: null }), socios: [] };
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    expect(screen.queryByTitle('Abrir conversa no WhatsApp')).not.toBeInTheDocument();
  });

  // Conferência no WhatsApp (GET /api/companies/:id/whatsapp), disparada ao abrir.
  // Só o veredito `false` tira o atalho de conversa — pendente segura o link e
  // indeterminado (falha/Evolution fora) o mantém como sempre foi.
  it('enquanto confere mostra loading e não oferece o atalho', async () => {
    let liberar!: (v: unknown) => void;
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company({ telefone2: null }), socios: [] };
      if (p === '/api/companies/1/whatsapp') return new Promise((res) => { liberar = res; });
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('conferindo WhatsApp…')).toBeInTheDocument();
    expect(screen.queryByTitle('Abrir conversa no WhatsApp')).not.toBeInTheDocument();

    liberar({ whatsapp: { telefone1: true, telefone2: null } });
    expect(await screen.findByTitle('Abrir conversa no WhatsApp')).toBeInTheDocument();
    expect(screen.queryByText('conferindo WhatsApp…')).not.toBeInTheDocument();
  });

  it('número que não está no WhatsApp perde o link', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company({ telefone2: null, fax: null }), socios: [] };
      if (p === '/api/companies/1/whatsapp') return { whatsapp: { telefone1: false, telefone2: null } };
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('sem WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('(11) 3333-4444')).toBeInTheDocument(); // o número continua visível
    expect(screen.queryByTitle('Abrir conversa no WhatsApp')).not.toBeInTheDocument();
  });

  it('conferência indeterminada (ou que falha) mantém o atalho', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company({ telefone2: null, fax: null }), socios: [] };
      if (p === '/api/companies/1/whatsapp') throw new Error('rede caiu');
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    await waitFor(() => expect(screen.getByTitle('Abrir conversa no WhatsApp')).toBeInTheDocument());
    expect(screen.queryByText('sem WhatsApp')).not.toBeInTheDocument();
  });

  // Aviso de contabilidade: o servidor manda em quantas empresas o contato se
  // repete; sem o dado (script de carga ainda não rodou) nada é sinalizado.
  it('contato repetido em outras empresas ganha o aviso de contabilidade', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return {
        company: company({ telefone2: null, fax: null }), socios: [],
        compartilhado: { telefone1: 37, telefone2: null, email: 52 },
      };
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    expect(screen.getAllByText('provável contabilidade')).toHaveLength(2); // telefone1 + e-mail
    expect(screen.getAllByTitle(/aparece em 37 empresas diferentes/)[0]).toBeInTheDocument();
  });

  it('sem dado de contato compartilhado não mostra aviso', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company(), socios: [] }; // sem `compartilhado`
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    expect(screen.queryByText('provável contabilidade')).not.toBeInTheDocument();
  });

  it('telefone sai mascarado no padrão BR', async () => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return {
        company: company({ telefone1: '11933334444', telefone2: '1133334444', fax: null }), socios: [],
      };
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    expect(screen.getByText('(11) 93333-4444')).toBeInTheDocument(); // celular
    expect(screen.getByText('(11) 3333-4444')).toBeInTheDocument();  // fixo
  });

  // Raspagem dos contatos publicados no site. Depende do site já descoberto, e
  // nada do que ela devolve é gravado: só o que o usuário mandar adicionar.
  describe('contatos no site', () => {
    const SITE = {
      dominio: 'alvo.com.br', status: 'achou', site_url: 'https://www.alvo.com.br/',
      site_status: 'vivo', confianca: 100, fonte: 'registrobr', titular: null,
    };
    const CONTATOS = {
      contatos: [
        {
          nome: 'Silvio Zanon', cargo: 'Gerente', rotulo: 'Departamento Técnico',
          email: 'silvio@alvo.com.br', telefone: '4935417021', whatsapp: '49988321048',
          origem: 'https://www.alvo.com.br/contato',
        },
        {
          nome: null, cargo: null, rotulo: 'Departamento Vendas',
          email: 'vendas@alvo.com.br', telefone: null, whatsapp: null,
          origem: 'https://www.alvo.com.br/contato',
        },
      ],
      paginas: ['https://www.alvo.com.br/', 'https://www.alvo.com.br/contato'],
      bloqueado: false,
    };

    const abrirComSite = async (contatos: unknown = CONTATOS, site: unknown = SITE): Promise<void> => {
      m.get.mockImplementation(async (p: string) => {
        if (p === '/api/companies/1') return { company: company(), socios: [] };
        if (p === '/api/companies/1/dominio') return { dominio: site };
        if (p.startsWith('/api/companies/1/busca-web')) return VAZIO;
        if (p === '/api/companies/1/contatos-site') return pronto(contatos);
        return {};
      });
      m.post.mockImplementation(async () => {
        if (contatos instanceof Error) throw contatos;
        return { status: 'lendo' };
      });
      render(<CompanyModal companyId={1} onClose={vi.fn()} />);
      await screen.findByText('Alvo Comercio LTDA');
      await userEvent.click(screen.getByText('Investigar empresa'));
      await screen.findByText((site as { dominio: string }).dominio);
    };

    it('antes de investigar, a seção não aparece', async () => {
      m.get.mockImplementation(async (p: string) =>
        (p === '/api/companies/1' ? { company: company(), socios: [] } : {}));
      render(<CompanyModal companyId={1} onClose={vi.fn()} />);
      await screen.findByText('Alvo Comercio LTDA');
      expect(screen.queryByText('Contatos no site')).not.toBeInTheDocument();
    });

    it('investigar lê o site confirmado sozinho e diz qual leu', async () => {
      await abrirComSite();
      expect(await screen.findByText('Silvio Zanon')).toBeInTheDocument();
      expect(screen.getByText('lido de alvo.com.br')).toBeInTheDocument();
      expect(m.post).toHaveBeenCalledWith('/api/companies/1/contatos-site', { site_url: (SITE as { site_url: string }).site_url });
    });

    it('sem site no registro.br, lê o site do Google Maps', async () => {
      m.get.mockImplementation(async (p: string) => {
        if (p === '/api/companies/1') return { company: company(), socios: [] };
        if (p === '/api/companies/1/dominio') return { dominio: { ...SITE, dominio: null, site_url: null, status: 'nao_encontrado' } };
        if (p.startsWith('/api/companies/1/busca-web')) {
          return { ...VAZIO, local: { nome: 'Alvo', telefone: null, site: 'https://maps-alvo.com.br/', endereco: null, nota: null, avaliacoes: null, maps_url: null } };
        }
        if (p === '/api/companies/1/contatos-site') return pronto(CONTATOS);
        return {};
      });
      render(<CompanyModal companyId={1} onClose={vi.fn()} />);
      await screen.findByText('Alvo Comercio LTDA');
      await userEvent.click(screen.getByText('Investigar empresa'));
      expect(await screen.findByText('Silvio Zanon')).toBeInTheDocument();
      expect(screen.getByText('lido de maps-alvo.com.br')).toBeInTheDocument();
    });

    it('sem site nenhum, não tenta ler', async () => {
      m.get.mockImplementation(async (p: string) => {
        if (p === '/api/companies/1') return { company: company(), socios: [] };
        if (p === '/api/companies/1/dominio') return { dominio: { ...SITE, dominio: null, site_url: null, status: 'nao_encontrado' } };
        if (p.startsWith('/api/companies/1/busca-web')) return VAZIO;
        return {};
      });
      render(<CompanyModal companyId={1} onClose={vi.fn()} />);
      await screen.findByText('Alvo Comercio LTDA');
      await userEvent.click(screen.getByText('Investigar empresa'));
      await screen.findByText('nenhum site encontrado');
      expect(m.post).not.toHaveBeenCalled();
    });

    it('lista os contatos raspados, com pessoa e setor', async () => {
      await abrirComSite();
      expect(await screen.findByText('Silvio Zanon')).toBeInTheDocument();
      expect(screen.getByText(/Gerente · silvio@alvo\.com\.br/)).toBeInTheDocument();
      // telefone e WhatsApp saem mascarados, e o WhatsApp identificado
      expect(screen.getByText(/\(49\) 3541-7021 · \(49\) 98832-1048 \(WhatsApp\)/)).toBeInTheDocument();
      // contato institucional entra pelo rótulo do setor
      expect(screen.getByText('Departamento Vendas')).toBeInTheDocument();
      expect(screen.getAllByText('adicionar')).toHaveLength(2);
    });

    it('adicionar abre o cadastro já com a empresa e os canais preenchidos', async () => {
      await abrirComSite();
      await screen.findByText('Silvio Zanon');
      await userEvent.click(screen.getAllByText('adicionar')[0]!);

      expect(await screen.findByText('Novo contato')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nome *')).toHaveValue('Silvio Zanon');
      expect(screen.getByPlaceholderText('Cargo (ex.: Comprador)')).toHaveValue('Gerente');
      expect(screen.getByPlaceholderText('E-mail')).toHaveValue('silvio@alvo.com.br');
      // WhatsApp na frente do fixo: é por onde o representante fala
      expect(screen.getByPlaceholderText('Telefone')).toHaveValue('(49) 98832-1048');
      // empresa já selecionada, sem passar pela busca ("Loja Alvo" também está
      // na ficha atrás, então a checagem é dentro do chip do formulário)
      const chip = screen.getByLabelText('Remover empresa').parentElement!;
      expect(within(chip).getByText('Loja Alvo')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Empresa-prospect/)).not.toBeInTheDocument();
    });

    it('contato sem nome próprio entra com o setor no nome', async () => {
      await abrirComSite();
      await screen.findByText('Departamento Vendas');
      await userEvent.click(screen.getAllByText('adicionar')[1]!);
      expect(await screen.findByText('Novo contato')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nome *')).toHaveValue('Departamento Vendas');
      expect(screen.getByPlaceholderText('E-mail')).toHaveValue('vendas@alvo.com.br');
    });

    it('site sem contato publicado diz quantas páginas leu e oferece repetir', async () => {
      await abrirComSite({ contatos: [], paginas: ['https://www.alvo.com.br/'], bloqueado: false });
      expect(await screen.findByText(/nada publicado nas 1 página\(s\) lidas/)).toBeInTheDocument();
      await userEvent.click(screen.getByText('buscar de novo'));
      await waitFor(() => expect(m.post).toHaveBeenCalledTimes(2));
    });

    // colcci.com.br: 403 com página de WAF. Dizer "nada publicado" mandaria o
    // representante embora de um site que tem os contatos todos lá.
    it('site que barra robô não é anunciado como "sem contato"', async () => {
      await abrirComSite({ contatos: [], paginas: [], bloqueado: true });
      expect(await screen.findByText(/bloqueia leitura automática/)).toBeInTheDocument();
      expect(screen.queryByText(/nada publicado/)).not.toBeInTheDocument();
    });

    // Loja franqueada COLCCI: colcci.com.br é da AMC TEXTIL. A ficha mostra o
    // site, mas dizendo de quem é — senão o representante liga para a fábrica
    // achando que fala com a loja.
    it('site da marca é rotulado, com o titular', async () => {
      await abrirComSite(CONTATOS, {
        ...SITE, dominio: 'colcci.com.br', site_url: 'https://colcci.com.br/',
        fonte: 'marca', confianca: 40, titular: 'AMC TEXTIL LTDA',
      });
      expect(screen.getByText(/site da marca · AMC TEXTIL LTDA/)).toBeInTheDocument();
      expect(screen.queryByText('pelo e-mail da empresa')).not.toBeInTheDocument();
      // e o aviso acompanha a lista de contatos
      expect(await screen.findByText(/contatos de AMC TEXTIL LTDA, dona da marca/i)).toBeInTheDocument();
    });

    it('acompanha o progresso até terminar', async () => {
      let n = 0;
      m.get.mockImplementation(async (p: string) => {
        if (p === '/api/companies/1') return { company: company(), socios: [] };
        if (p === '/api/companies/1/dominio') return { dominio: SITE };
        if (p.startsWith('/api/companies/1/busca-web')) return VAZIO;
        if (p === '/api/companies/1/contatos-site') {
          return ++n === 1 ? { contatos_site: { url: 'x', status: 'lendo', paginas_lidas: 7 } } : pronto(CONTATOS);
        }
        return {};
      });
      render(<CompanyModal companyId={1} onClose={vi.fn()} />);
      await screen.findByText('Alvo Comercio LTDA');
      await userEvent.click(screen.getByText('Investigar empresa'));
      expect(await screen.findByText(/7 página\(s\) lida\(s\)/)).toBeInTheDocument();
      expect(await screen.findByText('Silvio Zanon', {}, { timeout: 5000 })).toBeInTheDocument();
    });

    it('reabrir no meio retoma; mapeamento interrompido avisa', async () => {
      m.get.mockImplementation(async (p: string) => {
        if (p === '/api/companies/1') {
          return { company: company(), socios: [], contatos_site: { url: 'https://www.alvo.com.br/', status: 'lendo' } };
        }
        if (p === '/api/companies/1/contatos-site') return { contatos_site: { url: 'x', status: 'interrompido' } };
        return {};
      });
      render(<CompanyModal companyId={1} onClose={vi.fn()} />);
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('A leitura do site foi interrompida — investigue de novo'));
    });

    it('falha na raspagem vira toast, sem quebrar o modal', async () => {
      await abrirComSite(new Error('site fora do ar'));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha ao ler o site'));
      expect(screen.queryByText('Contatos no site')).not.toBeInTheDocument();
    });
  });

  it('fecha no backdrop, no X e não fecha ao clicar no corpo', async () => {
    const onClose = vi.fn();
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company(), socios: [] };
      return {};
    });
    render(<CompanyModal companyId={1} onClose={onClose} />);
    await screen.findByText('Alvo Comercio LTDA');
    // clique no corpo interno não fecha (stopPropagation)
    await userEvent.click(screen.getByText('Alvo Comercio LTDA'));
    expect(onClose).not.toHaveBeenCalled();
    // X fecha (o Modal compartilhado dá aria-label ao botão — antes era anônimo)
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    // backdrop fecha; o role=dialog fica no painel interno acessível.
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CompanyModal — busca na internet', () => {
  const abrir = async (web: unknown): Promise<void> => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company(), socios: [] };
      if (p === '/api/companies/1/busca-web?atualizar=true') {
        if (web instanceof Error) throw web;
        return web;
      }
      if (p === '/api/companies/1/contatos-site') return pronto({ contatos: [], paginas: [], bloqueado: false });
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    await userEvent.click(screen.getByText('Investigar empresa'));
  };

  it('mostra Maps, redes, contatos e links, com aviso de conferir', async () => {
    await abrir({
      local: {
        nome: 'Loja Alvo Centro', telefone: '1133334444', site: 'https://alvo.com.br',
        endereco: 'Rua XV, 100', nota: 4.5, avaliacoes: 80, maps_url: 'https://maps/x',
      },
      redes: [{ rede: 'instagram', url: 'https://www.instagram.com/alvo' }],
      contatos: [{ nome: null, cargo: null, rotulo: 'Google Maps', email: null,
        telefone: '1133334444', whatsapp: null, origem: 'https://maps/x' }],
      links: [{ titulo: 'Loja Alvo - Contato', url: 'https://alvo.com.br/contato' }],
      socios: [
        { nome: 'JOÃO ALVO', titulo: 'João Alvo', url: 'https://br.linkedin.com/in/joao' },
        { nome: 'JOÃO ALVO', titulo: 'João Alvo - Itoupava Norte - Cylex', url: 'https://www.cylex.com.br/joao' },
      ],
      pessoas: [
        { nome: 'Ricardo Gerente', cargo: 'Gerente geral', url: 'https://br.linkedin.com/in/ricardo' },
        { nome: 'Sem Cargo', cargo: null, url: 'https://br.linkedin.com/in/semcargo' },
      ],
      buscado_em: '2026-09-20T12:00:00Z',
    });
    expect(await screen.findByText('Loja Alvo Centro')).toHaveAttribute('href', 'https://maps/x');
    expect(screen.getByText(/confira se é a mesma empresa/)).toBeInTheDocument();
    expect(screen.getByText('★ 4.5 (80)')).toBeInTheDocument();
    expect(screen.getByText('instagram')).toHaveAttribute('href', 'https://www.instagram.com/alvo');
    expect(screen.getByText('https://alvo.com.br')).toBeInTheDocument();
    expect(screen.getByText('Loja Alvo - Contato')).toBeInTheDocument();
    expect(screen.getByText('alvo.com.br ·')).toBeInTheDocument();
    // sócio aparece uma vez; cada link rotulado pelo site, título na dica
    expect(screen.getAllByText('JOÃO ALVO')).toHaveLength(1);
    expect(screen.getAllByText('LinkedIn').map((e) => e.getAttribute('href'))).toEqual([
      'https://br.linkedin.com/in/joao', 'https://br.linkedin.com/in/ricardo', 'https://br.linkedin.com/in/semcargo',
    ]);
    expect(screen.getByText('cylex.com.br')).toHaveAttribute('title', 'João Alvo - Itoupava Norte - Cylex');
    expect(screen.getByText('Pessoas no LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Gerente geral')).toBeInTheDocument();
    expect(screen.getByText('Sem Cargo')).toBeInTheDocument();
    // contato do Maps usa a mesma lista com "adicionar" dos contatos do site
    expect(screen.getByText('Google Maps')).toBeInTheDocument();
    expect(screen.getByTitle('Adicionar aos contatos')).toBeInTheDocument();
    expect(screen.getByText('Investigar de novo')).toBeInTheDocument();
    expect(screen.getByText('investigado em 20/09/2026')).toBeInTheDocument();
  });

  it('investigação completa salva: site, contatos do site e internet voltam ao abrir', async () => {
    m.get.mockImplementation(async (p: string) => (p === '/api/companies/1'
      ? { company: company(), socios: [],
        busca_web: VAZIO,
        site: { dominio: 'alvo.com.br', status: 'achou', site_url: 'https://alvo.com.br/', site_status: 'vivo',
          confianca: 100, fonte: 'registrobr', titular: null },
        contatos_site: { url: 'https://alvo.com.br/', paginas: ['https://alvo.com.br/'], bloqueado: false,
          contatos: [{ nome: 'Silvio Salvo', cargo: null, rotulo: null, email: 's@alvo.com.br', telefone: null, whatsapp: null, origem: 'https://alvo.com.br/' }] } }
      : {}));
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('alvo.com.br')).toHaveAttribute('href', 'https://alvo.com.br/');
    expect(screen.getByText('Silvio Salvo')).toBeInTheDocument();
    expect(screen.getByText('lido de alvo.com.br')).toBeInTheDocument();
    expect(screen.getByText('Investigar de novo')).toBeInTheDocument();
    // nada de busca: tudo veio do detalhe
    expect(m.get.mock.calls.map(([p]) => String(p)).filter((p) => /dominio|busca-web|contatos-site/.test(p))).toEqual([]);
  });

  it('busca salva aparece ao abrir, com a data, sem gastar crédito', async () => {
    m.get.mockImplementation(async (p: string) => (p === '/api/companies/1'
      ? { company: company(), socios: [], busca_web: {
        local: null, redes: [{ rede: 'instagram', url: 'https://www.instagram.com/alvo' }],
        contatos: [], links: [], socios: [], buscado_em: '2026-09-20T12:00:00Z' } }
      : {}));
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    expect(await screen.findByText('instagram')).toBeInTheDocument();
    expect(screen.getByText('investigado em 20/09/2026')).toBeInTheDocument();
    expect(m.get).not.toHaveBeenCalledWith(expect.stringContaining('busca-web'));
  });

  it('Maps sem link, nota nem site ainda mostra o nome', async () => {
    await abrir({
      local: { nome: 'Alvo Sem Link', telefone: null, site: null, endereco: 'Rua 1', nota: null, avaliacoes: null, maps_url: null },
      redes: [], contatos: [], links: [], socios: [], buscado_em: '2026-09-20T12:00:00Z',
    });
    expect(await screen.findByText('Alvo Sem Link')).not.toHaveAttribute('href');
  });

  it('nada encontrado', async () => {
    await abrir({ local: null, redes: [], contatos: [], links: [], socios: [], buscado_em: '2026-09-20T12:00:00Z' });
    expect(await screen.findByText('nada encontrado com o nome desta empresa nem dos sócios')).toBeInTheDocument();
  });

  it('erro da API vira toast (ex.: chave não configurada)', async () => {
    await abrir(new ApiError(503, 'busca na internet não configurada (SERPER_API_KEY)'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('busca na internet não configurada (SERPER_API_KEY)'));
    expect(screen.getByText('Investigar empresa')).toBeInTheDocument();
  });

  it('erro genérico', async () => {
    await abrir(new Error('x'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha na busca na internet'));
  });
});

describe('CompanyModal — investigar empresa', () => {
  const abrir = async (dominio: unknown, web: unknown, investigar = true): Promise<void> => {
    m.get.mockImplementation(async (p: string) => {
      if (p === '/api/companies/1') return { company: company(), socios: [], busca_web: investigar ? null : web };
      if (p === '/api/companies/1/dominio') return { dominio };
      if (p === '/api/companies/1/busca-web?atualizar=true') return web;
      if (p === '/api/companies/1/contatos-site') return pronto({ contatos: [], paginas: [], bloqueado: false });
      return {};
    });
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    if (investigar) await userEvent.click(screen.getByText('Investigar empresa'));
  };
  const SEM_SITE = { dominio: null, status: 'nao_encontrado', site_url: null, site_status: null, confianca: 0, fonte: 'registrobr', titular: null };

  it('um clique dispara registro.br e internet', async () => {
    await abrir(SEM_SITE, VAZIO);
    await waitFor(() => expect(m.get).toHaveBeenCalledWith('/api/companies/1/busca-web?atualizar=true'));
    expect(m.get).toHaveBeenCalledWith('/api/companies/1/dominio');
    expect(await screen.findByText('nenhum site encontrado')).toBeInTheDocument();
  });

  it('registro.br sem site, Maps com site: mostra o do Maps rotulado', async () => {
    await abrir(SEM_SITE, { ...VAZIO, local: { nome: 'Alvo', telefone: null, site: 'https://www.alvo.com.br/', endereco: null, nota: null, avaliacoes: null, maps_url: null } });
    expect(await screen.findByText('alvo.com.br')).toHaveAttribute('href', 'https://www.alvo.com.br/');
    expect(screen.getByText('pelo Google Maps')).toBeInTheDocument();
  });

  it('registro.br indeterminado pede para investigar de novo', async () => {
    await abrir({ ...SEM_SITE, status: 'indeterminado' }, VAZIO);
    expect(await screen.findByText(/investigue de novo/)).toBeInTheDocument();
  });

  it('sem investigação salva, a seção "Na internet" não aparece', async () => {
    m.get.mockImplementation(async (p: string) => (p === '/api/companies/1' ? { company: company(), socios: [] } : {}));
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    expect(screen.queryByText('Na internet')).not.toBeInTheDocument();
    expect(screen.getByText('site, redes sociais, sócios e contatos na internet')).toBeInTheDocument();
  });

  it('enquanto busca, o botão fica travado em "Investigando…"', async () => {
    m.get.mockImplementation((p: string) => (p === '/api/companies/1'
      ? Promise.resolve({ company: company(), socios: [] })
      : new Promise(() => undefined)));
    render(<CompanyModal companyId={1} onClose={vi.fn()} />);
    await screen.findByText('Alvo Comercio LTDA');
    await userEvent.click(screen.getByText('Investigar empresa'));
    expect(await screen.findByText('Investigando…')).toBeInTheDocument();
    expect(screen.getByText('Investigando…').closest('button')).toBeDisabled();
    expect(screen.getByText('buscando no Google…')).toBeInTheDocument();
  });
});
