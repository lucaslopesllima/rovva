// Busca na internet sobre a empresa via Serper.dev, sob demanda (clique na ficha).
//
// Duas consultas em paralelo, cada uma paga no Serper:
//   - /maps: ficha do Google Meu Negócio. Melhor fonte de telefone atualizado
//     de PME, e traz site, endereço e nota.
//   - /search: resultados orgânicos. Daí saem redes sociais e contatos que
//     aparecem nos trechos.
//
// Busca por NOME não confirma nada: "PADARIA CENTRAL" existe em toda cidade.
// Resultado só entra se o título citar o nome da empresa (candidatosDominio dá
// os slugs) — e a ficha rotula tudo como "encontrado na internet".
//
// Nada é persistido, como no resto do enriquecimento: vai para a tela e o
// representante escolhe o que vira contato.
import { config } from './config.ts';
import { candidatosDominio, SOCIETARIO } from './rdap.ts';
import { extrairContatos, normalizarFone, type ContatoSite } from './contatos_site.ts';

export class BuscaWebDesligadaError extends Error {
  constructor() { super('busca na internet não configurada (SERPER_API_KEY)'); }
}

export interface LocalMaps {
  nome: string;
  telefone: string | null; // dígitos com DDD, sem o 55
  site: string | null;
  endereco: string | null;
  nota: number | null;
  avaliacoes: number | null;
  maps_url: string | null;
}

export interface BuscaWeb {
  local: LocalMaps | null;
  redes: { rede: string; url: string }[];
  contatos: ContatoSite[];
  links: { titulo: string; url: string }[];
  // Rastro dos sócios na internet (LinkedIn pessoal, guias locais). Em empresa
  // pequena o dono É a empresa, e é com ele que o representante fala.
  socios: { nome: string; titulo: string; url: string }[];
}

export interface EmpresaBusca {
  razao_social: string;
  nome_fantasia: string | null;
  cidade: string | null;
  uf: string | null;
  socios?: string[]; // nomes de sócios pessoa física, já priorizados
}

// O título cita a pessoa? Primeiro e último nome, os dois: "MICHEL AKROUCHE
// FILHO" casa com "Michel Akrouche - LinkedIn", e só o sobrenome traria a família.
export function citaPessoa(titulo: string, nome: string): boolean {
  const norm = (x: string): string => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const partes = norm(nome).split(/\s+/).filter((p) => p.length >= 3 && !/^(filho|neto|junior|jr)$/.test(p));
  if (partes.length < 2) return false;
  const t = norm(titulo);
  return t.includes(partes[0]!) && t.includes(partes[partes.length - 1]!);
}

// null = a consulta falhou (rede, crédito, chave inválida -> 403). Sem resultado
// não é falha: vem 200 com a lista vazia.
async function serper(endpoint: 'maps' | 'search', q: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${config.serperUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'X-API-KEY': config.serperApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, gl: 'br', hl: 'pt-br', ...(endpoint === 'search' && { num: 10 }) }),
      signal: AbortSignal.timeout(20000),
    });
    const json = await r.json() as Record<string, unknown>;
    if (r.ok) return json;
    console.warn(`[serper] ${endpoint}: ${r.status} ${String(json.message ?? '')}`);
    return null;
  } catch (e) {
    console.warn(`[serper] ${endpoint}: ${(e as Error).message}`);
    return null;
  }
}

// O título cita a empresa? Slugs de 4+ letras: 3 é genérico demais ("abc").
export function citaEmpresa(texto: string, slugs: string[]): boolean {
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return slugs.some((s) => s.length >= 4 && t.includes(s));
}

const REDES: [string, RegExp][] = [
  ['instagram', /^https?:\/\/(www\.)?instagram\.com\/(?!p\/|reel\/|explore\/)[\w.]+/i],
  ['facebook', /^https?:\/\/([a-z-]+\.)?facebook\.com\/(?!sharer|posts\/|events\/)[\w.-]+/i],
  ['linkedin', /^https?:\/\/([a-z]+\.)?linkedin\.com\/company\/[\w-]+/i],
  ['youtube', /^https?:\/\/(www\.)?youtube\.com\/(@|c\/|channel\/)[\w-]+/i],
  ['tiktok', /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+/i],
];

// Uma por rede, a primeira (mais bem ranqueada). URL cortada no perfil: link de
// post vira link do perfil, que é o que o representante quer abrir.
export function redesSociais(urls: string[]): { rede: string; url: string }[] {
  const out = new Map<string, string>();
  for (const u of urls) {
    for (const [rede, re] of REDES) {
      const m = re.exec(u);
      if (m && !out.has(rede)) out.set(rede, m[0]);
    }
  }
  return [...out].map(([rede, url]) => ({ rede, url }));
}

// Tudo que vira href na ficha vem de terceiro: só http(s), nunca javascript:.
const WEB = /^https?:\/\//i;

interface MapsPlace {
  title?: string; phoneNumber?: string; website?: string; address?: string;
  rating?: number; ratingCount?: number; cid?: string;
}

function lerMaps(json: Record<string, unknown> | null, slugs: string[]): LocalMaps | null {
  const lugares = (json?.places ?? []) as MapsPlace[];
  const p = lugares.find((l) => l.title && citaEmpresa(l.title, slugs));
  if (!p) return null;
  return {
    nome: p.title!,
    telefone: p.phoneNumber ? normalizarFone(p.phoneNumber) : null,
    site: p.website && WEB.test(p.website) ? p.website : null,
    endereco: p.address ?? null,
    nota: p.rating ?? null,
    avaliacoes: p.ratingCount ?? null,
    maps_url: p.cid ? `https://www.google.com/maps?cid=${p.cid}` : null,
  };
}

// Sites de consulta de CNPJ: espelham a Receita, que já está na ficha. Saem da
// busca (-site:, para os 10 resultados virem de fonte útil) e do que escapar.
const AGREGADORES = [
  'cnpja.com', 'serasaexperian.com.br', 'econodata.com.br', 'cnpgolden.com.br',
  'casadosdados.com.br', 'cnpj.biz', 'cnpj.info', 'consultacnpj.com', 'empresaqui.com.br',
  'advdinamico.com.br', 'guiadotrc.com.br', 'informecadastral.com.br', 'cnpj.services',
  'consultasocio.com', 'empresascnpj.com', 'listamais.com.br', 'buscasim.com.br',
  'monitorcnpj.com.br', 'empresassantacatarina.com.br', 'escavador.com',
];
const EXCLUI = AGREGADORES.map((d) => `-site:${d}`).join(' ');

export function deAgregador(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return AGREGADORES.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true;
  }
}

interface Organico { title?: string; link?: string; snippet?: string }

export async function buscarNaWeb(e: EmpresaBusca): Promise<BuscaWeb> {
  if (!config.serperApiKey) throw new BuscaWebDesligadaError();
  // Sem LTDA/ME: entre aspas, o sufixo societário tira do resultado o
  // Instagram e o site, que raramente o escrevem.
  const limpo = (s: string): string => s.toUpperCase().replace(SOCIETARIO, ' ').replace(/\s+/g, ' ').trim();
  const nome = limpo(e.nome_fantasia || e.razao_social);
  // Fantasia e razão social, as duas: a fantasia na Receita nem sempre é a
  // marca ("MALINSKI CABOS DE MADEIRA"; Instagram e site usam "Malinski Madeiras").
  const nomes = [...new Set([nome, limpo(e.razao_social)])].filter(Boolean).map((n) => `"${n}"`);
  const termo = nomes.length > 1 ? `(${nomes.join(' OR ')})` : nomes[0]!;
  const slugs = candidatosDominio(e.razao_social, e.nome_fantasia);

  const socios = (e.socios ?? []).slice(0, 2);

  // UF só no Maps: na busca web o Google lê "SC" como South Carolina.
  // Sócios numa 3ª busca (+1 crédito), só quando há sócio pessoa física.
  const [maps, google, pessoas] = await Promise.all([
    serper('maps', [nome, e.cidade, e.uf].filter(Boolean).join(' ')),
    serper('search', [termo, e.cidade, EXCLUI].filter(Boolean).join(' ')),
    socios.length
      ? serper('search', [`(${socios.map((n) => `"${n}"`).join(' OR ')})`, e.cidade, EXCLUI].filter(Boolean).join(' '))
      : Promise.resolve(null),
  ]);
  // Sem sócio a 3ª busca nem sai: falha é só quando o que foi pedido falhou todo.
  if (!maps && !google && (!socios.length || !pessoas)) throw new Error('falha na busca na internet');

  const doSocio = ((pessoas?.organic ?? []) as Organico[]).flatMap((o) => {
    const n = o.link && WEB.test(o.link) && !deAgregador(o.link) && socios.find((s) => citaPessoa(o.title ?? '', s));
    return n ? [{ nome: n, o }] : [];
  });

  const local = lerMaps(maps, slugs);
  const organicos = ((google?.organic ?? []) as Organico[])
    // Título ou URL, não o trecho: guia de cidade cita a empresa no trecho de
    // outra ("J. Reiter Representações ... Akrouche").
    .filter((o) => o.link && WEB.test(o.link) && !deAgregador(o.link) && citaEmpresa(`${o.title ?? ''} ${o.link}`, slugs));

  const contatos: ContatoSite[] = [];
  if (local?.telefone) {
    contatos.push({
      nome: null, cargo: null, rotulo: 'Google Maps', email: null,
      telefone: local.telefone, whatsapp: null, origem: local.maps_url ?? 'Google Maps',
    });
  }
  for (const o of organicos) if (o.snippet) contatos.push(...extrairContatos(o.snippet, o.link!));
  // Achado na página do sócio: o cadastro de contato já sai com o nome dele.
  for (const { nome: n, o } of doSocio) {
    if (!o.snippet) continue;
    contatos.push(...extrairContatos(o.snippet, o.link!).map((c) => ({ ...c, nome: c.nome ?? n, cargo: c.cargo ?? 'Sócio' })));
  }
  // Mesmo telefone no Maps e num trecho: fica o do Maps, que vem primeiro.
  const vistos = new Set<string>();
  const unicos = contatos.filter((c) => {
    const k = c.email ?? c.telefone ?? c.whatsapp ?? '';
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  return {
    local,
    redes: redesSociais(organicos.map((o) => o.link!)),
    contatos: unicos,
    // Rede social já aparece em `redes`; post/reel solto não acrescenta.
    links: organicos.filter((o) => !/(instagram|facebook|linkedin|youtube|tiktok)\.com\//i.test(o.link!))
      .slice(0, 5).map((o) => ({ titulo: o.title ?? o.link!, url: o.link! })),
    socios: doSocio.slice(0, 5).map(({ nome: n, o }) => ({ nome: n, titulo: o.title!, url: o.link! })),
  };
}
