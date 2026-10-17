import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Relatório de pedidos em PDF → linhas de item, sem layout fixo por
// representada. Usa a posição (x,y) de cada palavra (pdftotext -bbox, do
// poppler-utils): acha o cabeçalho da tabela por sinônimos, cada título define
// onde a coluna começa, e cada linha com pedido+data+total vira um item.
// Texto quebrado em outra linha (código "135144-" / "422B0063") vai para o
// item mais próximo na vertical. Cliente = linha de texto logo acima de cada
// cabeçalho. PDF escaneado (sem texto) não tem palavras → precisa de OCR.

export interface Word { x0: number; y0: number; x1: number; y1: number; t: string }

export interface PdfRow {
  cliente: string; pedido: string; status: string; data: string | null; fantasia: string;
  codigo: string; descricao: string; qtd: number | null; unidade: string;
  preco_unit: number | null; total: number | null;
}

// campo → sinônimos no cabeçalho (sem acento, minúsculo)
const COLS: Record<string, string[]> = {
  pedido: ['id', 'pedido', 'numero', 'nº'], status: ['status', 'situacao'],
  data: ['data', 'emissao'], fantasia: ['fantasia/nome', 'fantasia', 'pessoa', 'cliente'],
  codigo: ['codigo', 'cod', 'ref', 'referencia', 'sku'], descricao: ['descricao', 'produto'],
  qtd: ['quantidade', 'qtd', 'qtde', 'quant'], unit: ['unitario', 'unit'], total: ['total'],
};

const norm = (s: string): string =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^[,.:]+|[,.:]+$/g, '');
const yc = (w: Word): number => (w.y0 + w.y1) / 2;
const field = (t: string): string | null =>
  Object.entries(COLS).find(([, syn]) => syn.includes(norm(t)))?.[0] ?? null;
const byReading = (a: Word, b: Word): number => Math.round(a.y0) - Math.round(b.y0) || a.x0 - b.x0;
const txt = (ws: Word[]): string => [...ws].sort(byReading).map((w) => w.t).join(' ');

// "R$ 1.359,50" → 1359.5; "42,3 m" → 42.3. Formato BR (ponto milhar, vírgula decimal).
export function brNum(s: string | undefined): number | null {
  const m = /\d[\d.]*(,\d+)?/.exec(s ?? '');
  return m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : null;
}

const pdfToText = promisify(execFile);
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

// Palavras com coordenadas, uma lista por página. Arquivo temporário porque o
// pdftotext não lê PDF do stdin de forma portável.
export async function pdfWords(pdf: Buffer): Promise<Word[][]> {
  const dir = await mkdtemp(join(tmpdir(), 'pdfped-'));
  try {
    const file = join(dir, 'in.pdf');
    await writeFile(file, pdf);
    const { stdout } = await pdfToText('pdftotext', ['-bbox', file, '-'], { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
    return stdout.split('<page').slice(1).map((pg) =>
      [...pg.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g)].map((m) => ({
        x0: Number(m[1]), y0: Number(m[2]), x1: Number(m[3]), y1: Number(m[4]),
        t: m[5]!.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e: string) => ENT[e]!),
      })));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

interface Line { yc: number; w: Word[] }

function lines(words: Word[], tol = 3): Line[] {
  const out: Line[] = [];
  for (const w of [...words].sort((a, b) => yc(a) - yc(b))) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.yc - yc(w)) <= tol) last.w.push(w);
    else out.push({ yc: yc(w), w: [w] });
  }
  return out;
}

// cabeçalho = faixa de ±15pt (títulos em 2 linhas) com ≥4 campos distintos
function headerBands(words: Word[]): Line[] {
  const out: Line[] = [];
  for (const L of lines(words)) {
    if (out.some((b) => Math.abs(b.yc - L.yc) < 15)) continue;
    const band = words.filter((w) => Math.abs(yc(w) - L.yc) < 15);
    if (new Set(band.map((w) => field(w.t)).filter(Boolean)).size >= 4) out.push({ yc: L.yc, w: band });
  }
  return out;
}

interface Col { f: string; x0: number }

function colsFrom(band: Word[]): Col[] {
  // junta palavras vizinhas do cabeçalho num rótulo ("Valor total")
  const labels: { x0: number; x1: number; ws: Word[] }[] = [];
  for (const w of [...band].sort((a, b) => a.x0 - b.x0)) {
    const l = labels.find((l) => w.x0 - l.x1 < 8 && w.x1 > l.x0);
    if (l) { l.x1 = Math.max(l.x1, w.x1); l.ws.push(w); } else labels.push({ x0: w.x0, x1: w.x1, ws: [w] });
  }
  const cols: Col[] = [];
  const used = new Set<string>();
  for (const l of labels) {
    // último sinônimo do rótulo decide ("Produto, código" → codigo)
    const f = [...l.ws].reverse().map((w) => field(w.t)).find((f) => f && !used.has(f));
    if (f) { used.add(f); cols.push({ f, x0: l.x0 }); }
  }
  return cols;
}

// coluna vai do início do rótulo até o início do próximo (texto longo transborda p/ a direita)
const colOf = (w: Word, cols: Col[]): string =>
  [...cols].reverse().find((c) => w.x0 >= c.x0 - 10)?.f ?? cols[0]!.f;

const isoDate = (s: string | undefined): string | null => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export function parsePedidos(pages: Word[][]): PdfRow[] {
  const rows: PdfRow[] = [];
  let cliente = '';
  let cols: Col[] | null = null;
  for (const words of pages) {
    const hb = headerBands(words);
    if (hb.length > 0 && !cols) cols = colsFrom(hb[0]!.w);
    if (!cols || !cols.some((c) => c.f === 'total') || !cols.some((c) => c.f === 'pedido')) continue;
    const C = cols;
    const hw = new Set(hb.flatMap((b) => b.w));
    let ls = lines(words.filter((w) => !hw.has(w)));
    const stop = ls.find((L) => L.w.some((w) => norm(w.t) === 'resumo'))?.yc ?? Infinity;
    ls = ls.filter((L) => L.yc < stop);
    const heads: [number, string][] = [];
    for (const b of hb) {
      // linha de subtotal (R$ / data) não é nome de cliente
      const above = ls.filter((L) => b.yc - L.yc > 0 && b.yc - L.yc < 40 && !/R\$|\d{2}\/\d{2}\/\d{4}/.test(txt(L.w)));
      const last = above[above.length - 1];
      if (last) heads.push([last.yc, txt(last.w)]);
    }
    // âncora = linha com pedido, data e total (linha de subtotal não tem data)
    const need = C.some((c) => c.f === 'data') ? ['total', 'pedido', 'data'] : ['total', 'pedido'];
    const anchors = ls.filter((L) => { const fs = new Set(L.w.map((w) => colOf(w, C))); return need.every((f) => fs.has(f)); });
    if (anchors.length === 0) continue;
    const recs = new Map<Line, Map<string, Word[]>>(anchors.map((a) => [a, new Map()]));
    for (const w of ls.flatMap((L) => L.w)) {
      const a = anchors.reduce((p, c) => (Math.abs(c.yc - yc(w)) < Math.abs(p.yc - yc(w)) ? c : p));
      if (Math.abs(a.yc - yc(w)) >= 14) continue;
      const m = recs.get(a)!;
      const f = colOf(w, C);
      m.set(f, [...(m.get(f) ?? []), w]);
    }
    for (const a of anchors) {
      for (const [y, c] of heads) if (y < a.yc) cliente = c;
      const m = recs.get(a)!;
      const get = (f: string): string => txt(m.get(f) ?? []);
      const q = /(\d[\d.,]*)\s*([a-zA-Z]+)?/.exec(get('qtd'));
      const qtd = q ? brNum(q[1]) : null;
      const total = brNum(get('total'));
      rows.push({
        cliente, pedido: get('pedido').replace(/\./g, ''), status: get('status'), data: isoDate(get('data')),
        fantasia: get('fantasia'),
        codigo: [...(m.get('codigo') ?? [])].sort(byReading).map((w) => w.t).join(''),
        descricao: get('descricao'), qtd, unidade: q?.[2] ?? '',
        preco_unit: brNum(get('unit')) ?? (total != null && qtd ? Math.round((total / qtd) * 10000) / 10000 : null),
        total,
      });
    }
  }
  return rows;
}
