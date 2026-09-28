// buscarNaWeb com fetch mockado: leitura do Maps, filtro por nome, redes
// sociais, contatos nos trechos e os dois modos de falha.
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { buscarNaWeb, BuscaWebDesligadaError, citaEmpresa, citaPessoa, deAgregador, pessoaDoLinkedin, redesSociais } from '../src/busca_web.ts';
import { config } from '../src/config.ts';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => { fetchMock.mockReset(); config.serperApiKey = 'k'; });

const resp = (body: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 403, json: async () => body } as unknown as Response);
// Responde por endpoint, independente da ordem do Promise.all.
const serp = (maps: unknown, google: unknown): void => {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(String(url).endsWith('/maps') ? maps : google));
};

const EMPRESA = { razao_social: 'MALINSKI MADEIRAS LTDA', nome_fantasia: 'MALINSKI', cidade: 'Brusque', uf: 'SC' };

describe('buscarNaWeb', () => {
  it('sem chave -> BuscaWebDesligadaError, sem gastar busca', async () => {
    config.serperApiKey = '';
    await expect(buscarNaWeb(EMPRESA)).rejects.toBeInstanceOf(BuscaWebDesligadaError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('junta Maps, redes e contatos dos trechos da empresa certa', async () => {
    serp(
      resp({ places: [
        { title: 'Outra Madeireira', phoneNumber: '+55 47 3333-0000' },
        { title: 'Malinski Madeiras', phoneNumber: '+55 47 3351-2000', website: 'https://malinski.com.br',
          address: 'Rua X, 10, Brusque', rating: 4.7, ratingCount: 120, cid: '123' },
      ] }),
      resp({
        organic: [
          { title: 'Malinski Madeiras (@malinski.madeiras)', link: 'https://www.instagram.com/malinski.madeiras/' },
          { title: 'Malinski Madeiras - Contato', link: 'https://malinski.com.br/contato',
            snippet: 'Fale conosco: vendas@malinski.com.br ou (47) 3351-2000' },
          { title: 'Malinski | Facebook', link: 'https://www.facebook.com/malinskimadeiras/posts/1' },
          { title: 'Malinski perigoso', link: 'javascript:alert(1)' },
          { title: 'MALINSKI MADEIRAS LTDA - CNPJ', link: 'https://cnpja.com/office/1',
            snippet: 'contato@contabil.com.br (47) 3000-1111' },
          { title: 'Madeireira Concorrente', link: 'https://www.instagram.com/concorrente/',
            snippet: 'ligue (47) 99999-1234' },
        ],
      }),
    );
    const r = await buscarNaWeb(EMPRESA);

    expect(r.local).toMatchObject({
      nome: 'Malinski Madeiras', telefone: '4733512000', nota: 4.7,
      maps_url: 'https://www.google.com/maps?cid=123',
    });
    expect(r.redes).toEqual([
      { rede: 'instagram', url: 'https://www.instagram.com/malinski.madeiras' },
      { rede: 'facebook', url: 'https://www.facebook.com/malinskimadeiras' },
    ]);
    // telefone do Maps não duplica o do trecho; concorrente não entra
    expect(r.contatos.map((c) => c.email ?? c.telefone)).toEqual(['4733512000', 'vendas@malinski.com.br']);
    expect(r.links.map((l) => l.url)).not.toContain('https://www.instagram.com/concorrente/');
    expect(r.links.map((l) => l.url)).toEqual(['https://malinski.com.br/contato']);
    // chave no cabeçalho; UF só no Maps ("SC" vira South Carolina na busca web)
    const chamadas = Object.fromEntries(fetchMock.mock.calls.map(([u, init]) =>
      [String(u).split('/').pop(), init as RequestInit]));
    expect((chamadas.maps!.headers as Record<string, string>)['X-API-KEY']).toBe('k');
    expect(JSON.parse(String(chamadas.maps!.body)).q).toBe('MALINSKI Brusque SC');
    const qs = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).q as string);
    expect(qs).toContainEqual(expect.stringMatching(/^\("MALINSKI" OR "MALINSKI MADEIRAS"\) Brusque -site:cnpja\.com /));
    expect(qs).toContain('site:linkedin.com/in ("MALINSKI" OR "MALINSKI MADEIRAS")');
  });

  it('sem fantasia: razão social sem LTDA; empresa citada só no trecho não entra', async () => {
    serp(resp({ places: [] }), resp({ organic: [
      { title: 'J. Reiter Representações - Blumenau', link: 'https://guia.com/j-reiter',
        snippet: 'Veja também Akrouche Representações' },
    ] }));
    const r = await buscarNaWeb({ razao_social: 'AKROUCHE REPRESENTACOES LTDA', nome_fantasia: null, cidade: 'Blumenau', uf: 'SC' });
    expect(r.links).toEqual([]);
    const busca = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/search'))!;
    expect(JSON.parse(String((busca[1] as RequestInit).body)).q).toMatch(/^"AKROUCHE REPRESENTACOES" Blumenau /);
  });

  it('sócios: 3ª busca, LinkedIn pessoal e contato com o nome do sócio', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (String(url).endsWith('/maps')) return Promise.resolve(resp({ places: [] }));
      const q = JSON.parse(String(init.body)).q as string;
      if (q.startsWith('("MICHEL AKROUCHE")')) {
        return Promise.resolve(resp({ organic: [
          { title: 'Michel Akrouche', link: 'https://br.linkedin.com/in/michel' },
          { title: 'Michel Akrouche - Blumenau - Cylex', link: 'https://www.cylex.com.br/m', snippet: 'Chamar (47) 3323-5669' },
          { title: 'Sandro Akrouche', link: 'https://br.linkedin.com/in/sandro' }, // parente: só sobrenome
          { title: 'Michel Akrouche - sócio', link: 'https://cnpja.com/p/1' },
        ] }));
      }
      return Promise.resolve(resp({ organic: [] }));
    });
    const r = await buscarNaWeb({
      razao_social: 'AKROUCHE REPRESENTACOES LTDA', nome_fantasia: null, cidade: 'Blumenau', uf: 'SC',
      socios: ['MICHEL AKROUCHE'],
    });
    expect(r.socios.map((p) => p.url)).toEqual(['https://br.linkedin.com/in/michel', 'https://www.cylex.com.br/m']);
    expect(r.contatos).toEqual([expect.objectContaining({ nome: 'MICHEL AKROUCHE', cargo: 'Sócio', telefone: '4733235669' })]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('sem sócio: 3 buscas (maps, google, linkedin)', async () => {
    serp(resp({ places: [] }), resp({ organic: [] }));
    await buscarNaWeb(EMPRESA);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('LinkedIn: 10 resultados (teto do plano grátis) e decisor primeiro', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (String(url).endsWith('/maps')) return Promise.resolve(resp({ places: [] }));
      if (!body.q.startsWith('site:linkedin.com/in ')) return Promise.resolve(resp({ organic: [] }));
      expect(body.num).toBe(10);
      return Promise.resolve(resp({ organic: [
        { title: 'Betina Cardoso - Malinski Madeiras Ltda', link: 'https://br.linkedin.com/in/betina',
          snippet: 'Auxiliar de produção na Malinski Madeiras Ltda · Experiência: Malinski Madeiras Ltda' },
        { title: 'Ricardo Stanguerlin - Malinski Madeiras Ltda', link: 'https://br.linkedin.com/in/ricardo',
          snippet: 'Gerente geral na Malinski Madeiras Ltda · Advogado há 25 anos.' },
        { title: 'Fulano - Outra Empresa', link: 'https://br.linkedin.com/in/fulano', snippet: 'Vendedor na Outra' },
      ] }));
    });
    const r = await buscarNaWeb(EMPRESA);
    expect(r.pessoas).toEqual([
      { nome: 'Ricardo Stanguerlin', cargo: 'Gerente geral', url: 'https://br.linkedin.com/in/ricardo' },
      { nome: 'Betina Cardoso', cargo: 'Auxiliar de produção', url: 'https://br.linkedin.com/in/betina' },
    ]);
  });

  it('sem resultados é vazio, não falha', async () => {
    serp(resp({ places: [] }), resp({ organic: [] }));
    expect(await buscarNaWeb(EMPRESA)).toEqual({ local: null, redes: [], contatos: [], links: [], socios: [], pessoas: [] });
  });

  it('as duas buscas falhando -> erro', async () => {
    fetchMock.mockRejectedValue(new Error('rede'));
    await expect(buscarNaWeb(EMPRESA)).rejects.toThrow('falha na busca');
  });

  it('uma falhando, a outra ainda responde', async () => {
    serp(resp({ message: 'Unauthorized.', statusCode: 403 }, false), resp({ organic: [] }));
    expect((await buscarNaWeb(EMPRESA)).local).toBeNull();
  });
});

describe('citaEmpresa', () => {
  it('ignora acento, caixa e pontuação; slug curto não vale', () => {
    expect(citaEmpresa('Açaí Malinski-Madeiras', ['malinski'])).toBe(true);
    expect(citaEmpresa('ABC Tintas', ['abc'])).toBe(false);
  });
});

describe('pessoaDoLinkedin', () => {
  const slugs = ['malinskimadeiras', 'malinski'];
  const p = (title: string, snippet: string, link = 'https://br.linkedin.com/in/x') =>
    pessoaDoLinkedin({ title, snippet, link }, slugs);

  it('cargo no título, no trecho ou como headline', () => {
    expect(p('Vitória Malinski - Tesoureira na Malinski Madeiras Ltda', 'Vitória Malinski. Tesoureira na Malinski Madeiras Ltda.'))
      .toMatchObject({ nome: 'Vitória Malinski', cargo: 'Tesoureira' });
    expect(p('Carlos Andriole Ferreira - Operador de UTE na Malinski ...', 'Operador de UTE na Malinski Madeiras Ltda · Experiência'))
      .toMatchObject({ cargo: 'Operador de UTE' });
    expect(p('Gabriel Pressato - Coordenador Comercial', 'Malinski Madeiras Ltda ... Profissional de vendas'))
      .toMatchObject({ nome: 'Gabriel Pressato', cargo: 'Coordenador Comercial' });
    expect(p('Priscila Hauco - Auxiliar de logística da empresa Malinski ...', 'Auxiliar de logística da empresa Malinski Madeiras Ltda'))
      .toMatchObject({ cargo: 'Auxiliar de logística' });
  });

  it('sem cargo identificável -> cargo null; fora do /in/ ou sem a empresa -> null', () => {
    expect(p('Vanderlei Fernandes - Malinski Madeiras Ltda', 'Experiência: Malinski Madeiras Ltda')).toMatchObject({ cargo: null });
    expect(p('Malinski Madeiras', 'x', 'https://br.linkedin.com/company/malinski')).toBeNull();
    expect(p('Fulano - Gerente', 'Gerente na Outra Ltda')).toBeNull();
  });
});

describe('citaPessoa', () => {
  it('primeiro e último nome; ignora FILHO; nome único não vale', () => {
    expect(citaPessoa('Michel Akrouche | LinkedIn', 'MICHEL AKROUCHE FILHO')).toBe(true);
    expect(citaPessoa('Sandro Akrouche', 'MICHEL AKROUCHE')).toBe(false);
    expect(citaPessoa('Michel', 'MICHEL')).toBe(false);
  });
});

describe('deAgregador', () => {
  it('pega subdomínio, não confunde domínio parecido', () => {
    expect(deAgregador('https://empresas.serasaexperian.com.br/x')).toBe(true);
    expect(deAgregador('https://cnpja.com/office/1')).toBe(true);
    expect(deAgregador('https://meucnpja.com/')).toBe(false);
  });
});

describe('redesSociais', () => {
  it('post/reel não é perfil; uma por rede', () => {
    expect(redesSociais([
      'https://www.instagram.com/p/XYZ/',
      'https://www.instagram.com/loja/',
      'https://www.instagram.com/outra/',
      'https://br.linkedin.com/company/loja-sa',
    ])).toEqual([
      { rede: 'instagram', url: 'https://www.instagram.com/loja' },
      { rede: 'linkedin', url: 'https://br.linkedin.com/company/loja-sa' },
    ]);
  });
});
