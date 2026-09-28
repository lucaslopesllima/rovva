// Raspagem de contatos na página da própria empresa.
//
// NADA daqui é persistido. O resultado vai para a tela, o representante escolhe
// quais linhas viram contato e só essas entram no banco pelo POST /api/contacts
// de sempre. Descoberta do site também não grava nada; URL segue do modal para
// rota de raspagem na própria requisição.
//
// O caminho rápido continua sem parser de DOM. Quando o HTML é só a casca de uma
// SPA ou o servidor barra o fetch simples, Lightpanda renderiza primeiro e
// Chromium cobre incompatibilidade/WAF. HTML resultante entra no mesmo extrator.
// O HTML é linearizado em linhas de texto, com os links de contato
// (mailto:/tel:/wa.me) convertidos em marcadores inline, e os valores são
// agrupados por VIZINHANÇA nessa linearização. É o que torna a raspagem genérica:
// não depende de classe CSS, de CMS nem de dado estruturado — depende só de que
// o rótulo fique perto do valor, que é como página de contato é escrita em
// qualquer site. Medido em coocam.com.br: 1 e-mail na home, 21 em /contato.
import { buscarPagina } from './site.ts';
import { buscarPaginaRenderizada, type MotorRenderizacao } from './renderizar_site.ts';

export interface ContatoSite {
  nome: string | null;      // 'Silvio Zanon'        (null em contato institucional)
  cargo: string | null;     // 'Gerente'
  rotulo: string | null;    // 'Departamento Técnico' / 'Comercialização Insumos'
  email: string | null;
  telefone: string | null;  // só dígitos, DDD + número, sem o 55
  whatsapp: string | null;  // idem; separado porque abre conversa, não liga
  origem: string;           // página exata onde apareceu
}

export interface BuscaContatos {
  contatos: ContatoSite[];
  paginas: string[];        // páginas efetivamente lidas, para a tela justificar o vazio
  // O site respondeu, mas barrando robô (401/403/429). Lista vazia aqui NÃO
  // significa "site sem contato": significa que não deu para ler. A colcci.com.br
  // devolve 403 com uma página de WAF; dizer "nada publicado" seria mentira.
  bloqueado: boolean;
}

// Sem prazo total: a leitura roda em segundo plano (rota contatos-site) e o
// objetivo é achar TODO contato publicado, mesmo que leve minutos. Cada página
// ainda tem o timeout próprio do fetch/navegador.
//
// ponytail: teto de páginas só como trava contra loja virtual de 50 mil
// produtos; como a fila é por pontuação, o que fica de fora é o menos provável
// de ter contato. Subir se site institucional grande estourar.
const MAX_PAGINAS = 80;
const MAX_CONTATOS = 300;
// Sitemap de loja grande tem dezenas de milhares de URLs; só as que pontuam entram.
const MAX_SITEMAPS = 10;

// Pontuação de uma página pelo caminho E pelo texto do link: '/fale-conosco' é
// estável, mas "Nossos representantes" no menu aponta muitas vezes para um
// caminho que não diz nada ('/rede'). Vale o maior peso que casar.
const PESOS: [RegExp, number][] = [
  [/(contato|contact|fale[-_ ]?conosco|faleconosco|atendimento|fale com)/i, 10],
  // Comercial/representantes: indústria (tbmtextil.com.br/comercial) lista ali a
  // rede de representantes com e-mail e WhatsApp — 23 contatos onde a home tem 2.
  [/(comercial|representantes?|representa[çc][ãa]o|vendas|vendedor|revend|distribuidor|onde[-_ ]?comprar|seja[-_ ]?um)/i, 9],
  [/(equipe|time|nosso[-_ ]?time|unidades|lojas|filiais|onde[-_ ]?estamos|localiza|endere[çc]o|trabalhe)/i, 6],
  [/(\bsul\b|sudeste|nordeste|\bnorte\b|centro[-_ ]?oeste|regi[ãa]o|regional|estados?)/i, 5],
  [/(quem[-_ ]?somos|sobre|empresa|institucional|a[-_ ]?empresa|nossa[-_ ]?hist)/i, 3],
];
// Volume de página que não traz contato: blog, loja, conta. Só entra se o
// caminho/texto também tiver palavra de contato forte (>= 9).
// Versão em outro idioma (/en/contact, /es/contacto) repete o contato da
// versão em português: só gastaria visita. Vale mesmo com palavra de contato.
const IDIOMA = /^https?:\/\/[^/]+\/(en|es|fr|de|it|zh|ja)(\/|$)/i;
const RUIDO = /(\/blog|\/noticias?|\/news|\/post|\/tag|\/categor|\/produto|\/product|\/shop|\/loja\/|\/carrinho|\/cart|\/checkout|\/login|\/minha-conta|\/account|\/wp-|\/feed|\/page\/\d|\/\d{4}\/\d{2}\/|[?&](p|page|s|add-to-cart)=)/i;

export function pontuar(url: string, texto = ''): number {
  let caminho: string;
  try { caminho = decodeURIComponent(new URL(url).pathname); } catch { return 0; }
  const alvo = `${caminho} ${texto}`;
  let p = 0;
  for (const [re, w] of PESOS) if (re.test(alvo) && w > p) p = w;
  if (IDIOMA.test(url) || (RUIDO.test(url) && p < 9)) return 0;
  return p;
}

// Tentados quando o site não linka a página de contato no menu (frame, JS, ou
// menu só em imagem). Ordem = probabilidade no mercado brasileiro.
const CAMINHOS_COMUNS = [
  '/contato', '/fale-conosco', '/contatos', '/atendimento', '/comercial', '/representantes',
  '/quem-somos', '/sobre', '/unidades', '/contact',
];
const ARQUIVO = /\.(pdf|jpe?g|png|gif|svg|webp|zip|rar|docx?|xlsx?|pptx?|mp4)$/i;

const hostBase = (h: string): string => h.replace(/^www\./i, '').toLowerCase();

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '-', mdash: '-', hellip: '…', bull: '·', middot: '·',
};

function entidades(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, c: string) => {
    if (c.startsWith('#')) {
      const cod = /^#x/i.test(c) ? parseInt(c.slice(2), 16) : Number(c.slice(1));
      // fromCodePoint lança em código fora da faixa Unicode — daí a checagem.
      return Number.isInteger(cod) && cod > 0 && cod < 0x110000 ? String.fromCodePoint(cod) : m;
    }
    return ENTIDADES[c.toLowerCase()] ?? m;
  });
}

// Delimitador dos marcadores. Caractere de controle: some do HTML real (é
// removido logo na entrada) e não colide com nada que o site possa escrever.
const M = '\u0001';
const RE_TOKEN = new RegExp(`${M}([ETW]):(.*?)${M}`, 'g');

// Tags que separam blocos viram quebra de linha; o resto vira espaço. <span>,
// <strong> e afins ficam de fora de propósito: quebrar neles separaria
// "Email:" do endereço que vem logo em seguida dentro do mesmo parágrafo.
const RE_BLOCO =
  /<(?:br|\/?(?:p|div|li|tr|td|th|h[1-6]|section|article|header|footer|nav|aside|ul|ol|dl|dt|dd|table|form|label|address|figcaption|blockquote|main))\b[^>]*>/gi;

// Converte o HTML numa lista de linhas de texto, com os links de contato já
// marcados. Remove antes: comentários (site comentado não é contato publicado),
// script/style (JSON de configuração cheio de e-mail de serviço) e o <head>
// (onde mora o <link rel="author"> da agência que fez o site — foi de lá que
// saiu o "5555555555" na medição da coocam).
export function linearizar(html: string): string[] {
  let s = html
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, ' ');

  s = s
    .replace(/<a\b[^>]*\bhref=["']\s*mailto:([^"'?>]+)[^>]*>/gi, (_m, v: string) => ` ${M}E:${v}${M} `)
    .replace(/<a\b[^>]*\bhref=["']\s*tel:([^"'?>]+)[^>]*>/gi, (_m, v: string) => ` ${M}T:${v}${M} `)
    .replace(
      /<a\b[^>]*\bhref=["'][^"']*(?:wa\.me|whatsapp\.com)\/[^"']*?([\d+][\d+%\s.-]{7,})["'][^>]*>/gi,
      (_m, v: string) => ` ${M}W:${v}${M} `,
    );

  return entidades(s.replace(RE_BLOCO, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[ \t\u00a0\r\f\v]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

// E-mail que não é contato de ninguém: arquivo com @ no nome ('logo@2x.png'),
// domínio de serviço embutido pelo tema e placeholder de template.
const EMAIL_ARQUIVO = /\.(png|jpe?g|gif|svg|webp|ico|css|js|json|woff2?)$/i;
const EMAIL_DOMINIO_LIXO =
  /(^|\.)(sentry\.io|sentry-cdn\.com|wixpress\.com|example\.(com|org|net)|dominio\.com(\.br)?|seudominio\.com(\.br)?|teste\.com(\.br)?|localhost|mysite\.com|misitio\.com|meusite\.com(\.br)?|seusite\.com(\.br)?|yoursite\.com|site\.com(\.br)?|empresa\.com(\.br)?)$/i;
const EMAIL_LOCAL_LIXO =
  /^(seu-?e?-?mail|e-?mail|exemplo|teste|test|nome|user|username|no-?reply|nao-?responda|postmaster|abuse|webmaster|hostmaster|sentry)$/i;

export function normalizarEmail(bruto: string): string | null {
  const e = entidades(bruto).trim().toLowerCase().replace(/^mailto:/, '');
  if (!/^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(e)) return null;
  const [local, dominio] = e.split('@') as [string, string];
  if (EMAIL_ARQUIVO.test(e) || EMAIL_DOMINIO_LIXO.test(dominio) || EMAIL_LOCAL_LIXO.test(local)) return null;
  return e;
}

// Telefone brasileiro em dígitos, sem DDI. Inclui números nacionais de serviço
// (0800/0300/0500/0900), comuns em páginas institucionais.
export function normalizarFone(bruto: string): string | null {
  let d = bruto.replace(/\D/g, '');
  if (d.length === 12 || d.length === 13) {
    if (!d.startsWith('55')) return null; // número estrangeiro: não é para cá
    d = d.slice(2);
  }
  if (/^0(?:300|500|800|900)\d{7}$/.test(d)) return d;
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  const num = d.slice(2);
  if (num[0] === '0' || num[0] === '1') return null;       // nenhum assinante começa assim
  if (d.length === 11 && num[0] !== '9') return null;      // celular de 9 dígitos começa em 9
  if (/^(\d)\1+$/.test(num)) return null;                  // 4444-4444 de template
  return d;
}

interface Valor { tipo: 'email' | 'telefone' | 'whatsapp'; valor: string }

const RE_EMAIL_TEXTO = /[a-z0-9][a-z0-9._%+-]{0,62}@[a-z0-9][a-z0-9.-]{0,61}\.[a-z]{2,}/gi;
// (?<!\d) e (?!\d) são o que impede casar DENTRO de uma sequência maior: sem
// eles, um CPF de 11 dígitos ou um WhatsApp de 13 viravam "telefone" truncado.
const RE_FONE_TEXTO = /(?<!\d)(?:\+?55[\s.-]?)?(?:0(?:300|500|800|900)[\s.-]?\d{3}[\s.-]?\d{4}|\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4})(?!\d)/g;
const CTX_WHATS = /(whats|zap|wpp|celular|\bcel\b|m[óo]vel)/i;
const CTX_FONE = /(fone|tel|telefone|contato|whats|zap|wpp|celular|\bcel\b|ligue|central|atendimento|comercial)/i;
// Obfuscação comum no rodapé para escapar de robô de spam.
const desobfuscar = (s: string): string => s
  .replace(/\s*[([{]\s*(?:arroba|at)\s*[)\]}]\s*/gi, '@')
  .replace(/\s+(?:arroba)\s+/gi, '@')
  .replace(/\s*[([{]\s*(?:ponto|dot)\s*[)\]}]\s*/gi, '.');

// Valores de UMA linha + o texto que sobrou dela (candidato a rótulo/nome).
function extrair(linha: string): { valores: Valor[]; texto: string } {
  const valores: Valor[] = [];
  const add = (tipo: Valor['tipo'], valor: string | null): void => {
    if (valor && !valores.some((v) => v.tipo === tipo && v.valor === valor)) valores.push({ tipo, valor });
  };

  // 1. Marcadores: a própria empresa declarou "isto é contato". Confiança máxima.
  RE_TOKEN.lastIndex = 0;
  const semToken = linha.replace(RE_TOKEN, (_m, t: string, v: string) => {
    if (t === 'E') add('email', normalizarEmail(v));
    else add(t === 'W' ? 'whatsapp' : 'telefone', normalizarFone(v));
    return ' ';
  });

  // 2. E-mail em texto puro. Some da linha antes da varredura de telefone, senão
  //    os dígitos de 'contato2024@...' entram na conta como número.
  const semEmail = desobfuscar(semToken).replace(RE_EMAIL_TEXTO, (m) => {
    const e = normalizarEmail(m);
    if (e) { add('email', e); return ' '.repeat(m.length); }
    return m;
  });

  // 3. Telefone em texto puro, classificado pelo que vem imediatamente antes.
  const texto = semEmail.replace(RE_FONE_TEXTO, (m: string, pos: number) => {
    const antes = semEmail.slice(Math.max(0, pos - 30), pos);
    // Sequência crua, sem parêntese nem separador: é tão parecida com CPF, CNPJ
    // e código de pedido que só entra se houver rótulo de telefone por perto.
    if (/^\+?\d+$/.test(m) && !CTX_FONE.test(antes)) return m;
    const f = normalizarFone(m);
    if (!f) return m;
    add(CTX_WHATS.test(antes) ? 'whatsapp' : 'telefone', f);
    return ' '.repeat(m.length);
  });

  return { valores, texto };
}

// \b não serve aqui: em JS a letra acentuada não é caractere de palavra, então
// \b antes de "área" nunca casa. As fronteiras são (?<!\p{L}) / (?!\p{L}).
// Falta de fronteira já custou caro: sem ela "KaLINKa" casava com 'link' e o
// nome da pessoa era descartado.
const RE_SETOR = new RegExp(
  '(?<!\\p{L})(?:departamento|setor|comercial|comercializa|vendas?|compras?|financeir|cont[áa]bil|contabilidade|jur[íi]dic|marketing|comunica[çc][ãa]o|administrativ|recursos humanos|rh|sac|atendimento|suporte|t[ée]cnic|log[íi]stic|transportes?|exporta|importa|filial|filiais|unidade|matriz|loja|f[áa]brica|escrit[óo]rio|inform[áa]tica|ouvidoria|or[çc]ament|revenda|representante|gerente|diretor|respons[áa]vel|coordena|superviso)',
  'iu',
);
// Título de seção e chamada de menu que passariam por nome próprio ("Fale
// Conosco", "Links Úteis") se olhássemos só a caixa alta das iniciais.
const RE_NAO_NOME = new RegExp(
  '(?<!\\p{L})(?:fale|conosco|contato|home|in[íi]cio|sobre|nossa|nosso|saiba|clique|leia|veja|todos|direitos|reservados|pol[íi]tica|privacidade|whatsapp|telefone|e-?mail|endere[çc]o|hor[áa]rio|central|newsletter|cadastre|receba|siga|acesse|produ[çc][ãa]o|produtos?|servi[çc]os?|empresa|institucional|blog|not[íi]cias?|links?|[úu]teis|mapas?|portal|[áa]reas?|acesso|trabalhe|redes|sociais|termos|copyright|desenvolvido)(?!\\p{L})',
  'iu',
);
const MINUSCULAS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
// Sigla de estado no fim: "Campos Novos SC" é praça, não pessoa. Sem isso a
// página de unidades enche a lista de "nomes" que são cidades.
const UF = /\s(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/;

// Nome do CAMPO, não do contato: "Fone:", "E-mail", "Whats". Aparece sozinho na
// linha em site que usa tabela, e não pode virar rótulo (a coocam ficou com 15
// contatos rotulados "Fones" em /unidades, perdendo o nome da filial) nem
// quebrar o bloco da pessoa a que o campo pertence.
const CAMPOS =
  'e-?mails?|telefones?|fones?|tels?|whats(?:app)?|zap|celulares?|contatos?|endere[çc]os?|cnpj|cep|hor[áa]rios?(?: de atendimento)?|fax|ramal|site';
const RE_CAMPO = new RegExp(`^(?:${CAMPOS})\\s*:?\\s*$`, 'i');
// Mesmos nomes, para limpar a sobra da linha: em "Fone: 3541-7000 · Whats: …"
// o que resta depois de tirar os números é só nome de campo, não é rótulo.
const RE_CAMPO_PALAVRA = new RegExp(`(?<!\\p{L})(?:${CAMPOS})(?!\\p{L})\\s*:?`, 'giu');

// "Silvio Zanon - Gerente" -> nome + cargo. O traço é a convenção universal
// nessas páginas; sem ele o cargo fica null e só o nome é aproveitado.
const partirNome = (l: string): [string, string | null] => {
  const [n, c] = l.split(/\s*[-–—|]\s*/, 2);
  return [n!.trim(), c?.trim() || null];
};

export function pareceNome(linha: string): boolean {
  const [s] = partirNome(linha);
  if (s.length < 5 || s.length > 60) return false;
  if (/[\d@:;/\\|()]/.test(s)) return false;
  if (RE_SETOR.test(s) || RE_NAO_NOME.test(s) || UF.test(s)) return false;
  const palavras = s.split(/\s+/);
  if (palavras.length < 2 || palavras.length > 5) return false;
  return palavras.every((p) => /^[A-ZÀ-Ý]/.test(p) || MINUSCULAS_NOME.has(p.toLowerCase()));
}

// Qualquer linha curta que não seja frase serve de rótulo: é assim que "Filial
// Curitibanos" e "Comercialização Insumos" são capturados sem uma lista fechada
// de setores, que nunca cobriria o vocabulário de todo site. Frase (termina em
// pontuação ou passa de 6 palavras) é texto institucional, não rótulo.
export function pareceRotulo(linha: string): boolean {
  if (linha.length > 60 || RE_CAMPO.test(linha)) return false;
  if (!/\p{L}/u.test(linha) || /[.!?]$/.test(linha)) return false;
  return linha.split(/\s+/).length <= 6;
}

interface Grupo { nome: string | null; cargo: string | null; rotulo: string | null; valores: Valor[] }

// Percorre as linhas mantendo o último nome e o último rótulo vistos, e fecha o
// grupo assim que aparece uma linha sem valor. É isso que mantém junto o bloco
//
//   Departamento Técnico          <- rótulo
//   Silvio Zanon - Gerente        <- nome + cargo
//   Email: silvio@coocam.com.br   <- valores do mesmo grupo
//   Whats: (49) 98832-1048
//   Fone: (49) 3541-7021
//
// e ao mesmo tempo separa os 21 e-mails da lista de setores da mesma página,
// onde cada rótulo é seguido de um único e-mail.
function agrupar(linhas: string[]): Grupo[] {
  const grupos: Grupo[] = [];
  let atual: Grupo | null = null;
  let nome: string | null = null;
  let cargo: string | null = null;
  let rotulo: string | null = null;
  const fechar = (): void => {
    if (atual && atual.valores.length) {
      grupos.push(atual);
      // A pessoa acabou de ser consumida: sem isso o nome vazaria para o próximo
      // bloco sem dono (foi como 'coocam@' virou contato da Kalinka na coocam).
      nome = null; cargo = null;
    }
    atual = null;
  };

  for (const linha of linhas) {
    const { valores, texto } = extrair(linha);
    if (valores.length) {
      // Rótulo grudado no valor, na mesma linha: "Comercialização Insumos <a>fabricio@…"
      // ou a linha de tabela "<td>Vendas</td><td>vendas@…</td>".
      const sobra = texto.replace(RE_CAMPO_PALAVRA, ' ').replace(/[\s:·|•\-–—]+/g, ' ').trim();
      const proprioDono = sobra !== '' && (pareceNome(sobra) || pareceRotulo(sobra));
      // A linha traz o dono dela: o que vinha antes acabou aqui. Sem isso uma
      // lista de setores (um por linha) viraria um contato só com 12 e-mails.
      if (proprioDono && atual?.valores.length) fechar();
      atual ??= { nome, cargo, rotulo, valores: [] };
      if (sobra && !atual.nome && pareceNome(sobra)) [atual.nome, atual.cargo] = partirNome(sobra);
      else if (sobra && !atual.rotulo && pareceRotulo(sobra)) atual.rotulo = sobra;
      atual.valores.push(...valores);
      continue;
    }
    // "Fone:" sozinho é o nome do campo seguinte: não fecha o bloco nem apaga
    // de quem ele é. Fechar aqui separaria a pessoa do telefone dela.
    if (RE_CAMPO.test(linha)) continue;
    fechar();
    if (pareceNome(linha)) {
      [nome, cargo] = partirNome(linha);
    } else if (pareceRotulo(linha)) {
      rotulo = linha.replace(/:$/, '').trim();
      nome = null; cargo = null;
    } else {
      // Frase ou texto corrido: o contexto anterior morreu junto.
      nome = null; cargo = null; rotulo = null;
    }
  }
  fechar();
  return grupos;
}

// Um grupo pode ter mais valores de um tipo que de outro (uma unidade com 3
// telefones e 1 e-mail). Zipa por índice: a 1ª linha leva o conjunto completo, as
// demais herdam só o rótulo — o nome fica na primeira para não duplicar pessoa.
function emGrupo(g: Grupo, origem: string): ContatoSite[] {
  const so = (t: Valor['tipo']): string[] => g.valores.filter((v) => v.tipo === t).map((v) => v.valor);
  const emails = so('email'); const tels = so('telefone'); const zaps = so('whatsapp');
  const n = Math.max(emails.length, tels.length, zaps.length);
  const out: ContatoSite[] = [];
  for (let i = 0; i < n; i++) {
    const email = emails[i] ?? null; const telefone = tels[i] ?? null; const whatsapp = zaps[i] ?? null;
    if (!email && !telefone && !whatsapp) continue;
    out.push({
      nome: i === 0 ? g.nome : null,
      cargo: i === 0 ? g.cargo : null,
      rotulo: g.rotulo, email, telefone, whatsapp, origem,
    });
  }
  return out;
}

// Prioridade para quem vende: representante quer o comprador, não o RH. Empata
// pela ordem em que apareceu no site (sort estável).
const PRIORIDADE: [RegExp, number][] = [
  [/(vendas?|comercial|comercializa|compras?|or[çc]ament|representante|revenda)/i, 0],
  [/(contato|atendimento|\bsac\b|central)/i, 1],
  [/(\brh\b|recursos humanos|curr[íi]culo|jur[íi]dico|financeiro|cont[áa]bil|contabilidade|fiscal|\bnfe\b|nota fiscal|inform[áa]tica|\bti\b|suporte|ouvidoria|imprensa|marketing|comunica)/i, 3],
];

function peso(c: ContatoSite): number {
  const alvo = `${c.rotulo ?? ''} ${c.cargo ?? ''} ${c.email ?? ''}`;
  for (const [re, p] of PRIORIDADE) if (re.test(alvo)) return p;
  return 2;
}

// O mesmo e-mail costuma aparecer duas vezes na página de contato: uma na lista
// de setores e outra na ficha da pessoa, com telefone junto. Mesclar em vez de
// duplicar é o que transforma duas linhas pobres numa linha completa.
//
// Fundir por telefone tem um limite: o número da central aparece na ficha de
// várias pessoas, e juntar por ele apagaria o e-mail de todas menos a primeira.
// Por isso e-mails diferentes nunca se fundem, mesmo compartilhando o telefone.
function mesclar(itens: ContatoSite[]): ContatoSite[] {
  const porEmail = new Map<string, ContatoSite>();
  const porFone = new Map<string, ContatoSite>();
  const saida: ContatoSite[] = [];

  for (const c of itens) {
    let alvo = c.email ? porEmail.get(c.email) : undefined;
    if (!alvo) {
      for (const f of [c.telefone, c.whatsapp]) {
        const cand = f ? porFone.get(f) : undefined;
        if (cand && !(cand.email && c.email && cand.email !== c.email)) { alvo = cand; break; }
      }
    }
    if (alvo) {
      alvo.nome ??= c.nome;
      alvo.cargo ??= c.cargo;
      alvo.rotulo ??= c.rotulo;
      alvo.email ??= c.email;
      alvo.telefone ??= c.telefone;
      alvo.whatsapp ??= c.whatsapp;
    } else {
      alvo = { ...c };
      saida.push(alvo);
    }
    if (alvo.email) porEmail.set(alvo.email, alvo);
    if (alvo.telefone) porFone.set(alvo.telefone, alvo);
    if (alvo.whatsapp) porFone.set(alvo.whatsapp, alvo);
  }
  return saida;
}

export function extrairContatos(html: string, origem: string): ContatoSite[] {
  return agrupar(linearizar(html)).flatMap((g) => emGrupo(g, origem));
}

// Links do PRÓPRIO site, com o texto do link. Só o mesmo domínio (ignorando
// www): link para o Instagram ou para o site do fornecedor não entra.
export function linksDaPagina(html: string, base: string): { url: string; texto: string }[] {
  let origem: URL;
  try { origem = new URL(base); } catch { return []; }
  const vistos = new Set<string>();
  const achados: { url: string; texto: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'>]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u: URL;
    try { u = new URL(entidades(m[1]!.trim()), origem); } catch { continue; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
    if (hostBase(u.hostname) !== hostBase(origem.hostname)) continue;
    if (ARQUIVO.test(u.pathname)) continue;
    u.hash = '';
    const url = u.toString();
    if (vistos.has(url)) continue;
    vistos.add(url);
    const texto = entidades(m[2]!.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 80);
    achados.push({ url, texto });
  }
  return achados;
}

// Os que valem visitar, do mais para o menos provável de ter contato.
export function linksCandidatos(html: string, base: string): string[] {
  return linksDaPagina(html, base)
    .map((l) => ({ url: l.url, p: pontuar(l.url, l.texto) }))
    .filter((l) => l.p > 0)
    .sort((a, b) => b.p - a.p)
    .map((l) => l.url);
}

// Todas as páginas que o site declara ter: robots.txt aponta o sitemap; sem ele,
// os caminhos que WordPress/Wix/Yoast usam. Índice de sitemaps é seguido, com
// sitemap de páginas antes do de produtos/posts. Sempre por fetch simples
// (buscarPagina): XML não precisa de navegador.
export async function urlsDoSitemap(home: string): Promise<string[]> {
  let origem: URL;
  try { origem = new URL(home); } catch { return []; }
  const locs = (xml: string): string[] =>
    [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((m) => entidades(m[1]!));

  const fila: string[] = [];
  const robots = await buscarPagina(new URL('/robots.txt', origem).toString());
  if (robots?.status === 200) {
    for (const m of robots.html.matchAll(/^\s*sitemap:\s*(\S+)/gim)) fila.push(m[1]!);
  }
  if (!fila.length) {
    for (const c of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) fila.push(new URL(c, origem).toString());
  }

  const paginas = new Set<string>();
  const lidos = new Set<string>();
  while (fila.length && lidos.size < MAX_SITEMAPS) {
    const alvo = fila.shift()!;
    if (lidos.has(alvo)) continue;
    lidos.add(alvo);
    const r = await buscarPagina(alvo);
    if (r?.status !== 200 || !/<(urlset|sitemapindex)\b/i.test(r.html)) continue;
    const achados = locs(r.html);
    if (/<sitemapindex\b/i.test(r.html)) {
      // page-sitemap.xml / wp-sitemap-posts-page-1.xml antes de product-sitemap.xml
      const rank = (u: string): number => (/page|pagina/i.test(u) ? 0 : /product|produto|post|blog|categor|tag/i.test(u) ? 2 : 1);
      fila.push(...achados.sort((a, b) => rank(a) - rank(b)));
      continue;
    }
    for (const u of achados) {
      try { if (hostBase(new URL(u).hostname) === hostBase(origem.hostname)) paginas.add(u); } catch { /* loc inválido */ }
    }
  }
  return [...paginas];
}

// 401/403/429: o servidor está de pé e recusou o robô, não é ausência de site.
const BLOQUEIO = new Set([401, 403, 405, 406, 429]);
const legivel = (p: { html: string; status: number } | null): boolean =>
  p != null && p.status === 200 && p.html !== '';

// Casca comum de Vue/React/Angular: quase nenhum texto útil, raiz vazia e scripts.
// Evita abrir Chromium para todo site estático que simplesmente não publica contato.
export function pareceSPA(html: string): boolean {
  const raiz = /<(div|main)\b[^>]*\bid=["'](?:app|root|__next|__nuxt)["'][^>]*>\s*<\/\1>/i.test(html)
    || /<(?:app-root|app-shell)\b/i.test(html);
  return raiz && /<script\b[^>]*\bsrc=["']/i.test(html);
}

type Pagina = { url: string; html: string; status: number; bloqueado?: boolean };
// Progresso para a tela: páginas lidas até agora.
export type AoLer = (paginasLidas: number) => void;

// Página que rendeu contatos (2+) puxa as subpáginas dela: /comercial rende, e
// /comercial/sul, /comercial/sc são onde está o resto da rede.
const BONUS_SUBPAGINA = 8;

// O mapeamento em si, igual para fetch simples e navegador — muda só `obter`.
// Fila por pontuação: a cada página lida, a próxima é a mais provável de ter
// contato entre tudo que já se conhece (menu, sitemap, links de páginas ricas).
async function mapear(home: Pagina, obter: (u: string) => Promise<Pagina | null>, aoLer?: AoLer): Promise<BuscaContatos> {
  const paginas: Pagina[] = [home];
  const pontos = new Map<string, number>(); // url -> pontuação; lidas saem do mapa
  const visitadas = new Set<string>([home.url]);
  const propor = (u: string, p: number): void => {
    if (p <= 0 || visitadas.has(u)) return;
    if (p > (pontos.get(u) ?? 0)) pontos.set(u, p);
  };
  const colher = (pag: Pagina): number => {
    const achados = extrairContatos(pag.html, pag.url).length;
    let base: string;
    try { base = new URL(pag.url).pathname.replace(/\/$/, ''); } catch { base = ''; }
    for (const l of linksDaPagina(pag.html, pag.url)) {
      let bonus = 0;
      try { bonus = achados >= 2 && base && new URL(l.url).pathname.startsWith(`${base}/`) ? BONUS_SUBPAGINA : 0; } catch { /* url estranha */ }
      propor(l.url, Math.max(pontuar(l.url, l.texto), bonus));
    }
    return achados;
  };

  colher(home);
  // Caminhos comuns com peso baixo: só vão se nada melhor aparecer antes.
  for (const c of CAMINHOS_COMUNS) {
    try { propor(new URL(c, home.url).toString(), 1); } catch { /* base estranha */ }
  }
  for (const u of await urlsDoSitemap(home.url)) propor(u, pontuar(u));

  while (pontos.size && paginas.length < MAX_PAGINAS) {
    const [alvo] = [...pontos].sort((a, b) => b[1] - a[1])[0]!;
    pontos.delete(alvo);
    visitadas.add(alvo);
    const p = await obter(alvo);
    // Redirect faz '/contato' e '/contatos' caírem na mesma URL final: ler duas
    // vezes só gastaria o orçamento de páginas.
    if (!p || (p.url !== alvo && visitadas.has(p.url))) continue;
    visitadas.add(p.url);
    paginas.push(p);
    colher(p);
    aoLer?.(paginas.length);
  }

  const contatos = mesclar(paginas.flatMap((p) => extrairContatos(p.html, p.url)))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => peso(a.c) - peso(b.c) || a.i - b.i)
    .slice(0, MAX_CONTATOS)
    .map(({ c }) => c);
  return { contatos, paginas: paginas.map((p) => p.url), bloqueado: false };
}

async function rasparRenderizado(siteUrl: string, motor: MotorRenderizacao, aoLer?: AoLer): Promise<BuscaContatos | null> {
  const home = await buscarPaginaRenderizada(siteUrl, undefined, motor);
  if (!home) return null;
  if (home.bloqueado) return { contatos: [], paginas: [], bloqueado: true };
  if (home.status >= 500) return { contatos: [], paginas: [], bloqueado: false };
  if (home.html === '') return null;
  return mapear(home, async (u) => {
    const p = await buscarPaginaRenderizada(u, home.url, motor);
    // SPAs em S3/CloudFront frequentemente devolvem 404 junto do index.html;
    // Chromium ainda executa o app e produz página válida, então status não veta.
    return p && !p.bloqueado && p.html !== '' ? p : null;
  }, aoLer);
}

async function rasparComFallback(siteUrl: string, aoLer?: AoLer): Promise<BuscaContatos | null> {
  const leve = await rasparRenderizado(siteUrl, 'lightpanda', aoLer);
  if (leve?.contatos.length) return leve;
  return (await rasparRenderizado(siteUrl, 'chromium', aoLer)) ?? leve;
}

export async function buscarContatosNoSite(siteUrl: string, aoLer?: AoLer): Promise<BuscaContatos> {
  const home = await buscarPagina(siteUrl);
  if (home === null || !legivel(home)) {
    const bloqueado = home !== null && BLOQUEIO.has(home.status);
    if (bloqueado) {
      const renderizado = await rasparComFallback(siteUrl, aoLer);
      if (renderizado) return renderizado;
    }
    return { contatos: [], paginas: [], bloqueado };
  }
  if (pareceSPA(home.html)) {
    const renderizado = await rasparComFallback(siteUrl, aoLer);
    if (renderizado) return renderizado;
  }
  return mapear(home, async (u) => {
    const p = await buscarPagina(u);
    return p && legivel(p) ? p : null;
  }, aoLer);
}
