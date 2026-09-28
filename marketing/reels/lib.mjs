// Gravação de reel: abre o app logado no perfil celular, roda o roteiro e salva
// <dir>/raw.mp4 + <dir>/marcas.json (segundo em que cada cena começa).
// O roteiro chama `await marca('fim')` ao terminar o que deve aparecer; o que
// vier depois (limpeza de dados da demo) fica fora do vídeo.
// Com narração (tmp/falas.json do narracao.py), marca() segura a cena até a
// fala dela acabar, e o card final dura o suficiente pra fala do card.
import { chromium, devices } from '../../e2e/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const BASE = process.env.BASE ?? 'http://localhost:5173';
const VP = { width: 414, height: 690 }; // proporção da janela 810x1350 do quadro final
export const FOLGA = 0.3; // s de respiro antes e depois de cada fala

export async function gravar(dir, roteiro, { contexto = {} } = {}) {
  // screencast sai no tamanho da janela; forçar o fator de escala dá quadros nítidos
  const b = await chromium.launch({ args: ['--force-device-scale-factor=2.625'] });
  const auth = await b.newContext({ ...devices['Pixel 7'], viewport: VP });
  const lp = await auth.newPage();
  await lp.goto(`${BASE}/login`);
  await lp.getByPlaceholder('voce@empresa.com').fill(process.env.EMAIL ?? 'adm@rovvatech.com.br');
  await lp.getByPlaceholder('mínimo 6 caracteres').fill(process.env.SENHA ?? 'demo123');
  await lp.locator('button[type=submit]').click();
  await lp.waitForURL((u) => !u.pathname.startsWith('/login'));
  const state = await auth.storageState();
  await auth.close();

  const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: VP, storageState: state, locale: 'pt-BR', ...contexto });
  // círculo no ponto do toque, pra quem assiste acompanhar a ação
  await ctx.addInitScript(() => {
    addEventListener('pointerdown', (e) => {
      const d = document.createElement('div');
      d.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;
        border-radius:50%;background:rgba(255,106,43,.45);border:2px solid #FF6A2B;z-index:2147483647;
        pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out`;
      document.documentElement.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; });
      setTimeout(() => d.remove(), 600);
    }, true);
  });
  const p = await ctx.newPage();

  // recordVideo do Playwright grava em px CSS (borrado); o screencast do
  // Chrome entrega os quadros na densidade do aparelho.
  const FR = `${dir}/tmp/frames/`;
  rmSync(FR, { recursive: true, force: true }); mkdirSync(FR, { recursive: true });
  const quadros = [];
  const cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', async (f) => {
    const file = `${FR}${String(quadros.length).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    quadros.push({ file, ts: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1088, maxHeight: 1812 });
  const t0 = Date.now() / 1000;
  const falas = existsSync(`${dir}/tmp/falas.json`) ? JSON.parse(readFileSync(`${dir}/tmp/falas.json`, 'utf8')) : {};
  const marcas = { inicio: 0 };
  let atual = 'inicio';
  const marca = async (k) => {
    const falta = (falas[atual] ?? 0) + FOLGA * 2 - (Date.now() / 1000 - t0 - marcas[atual]);
    if (falta > 0) await p.waitForTimeout(falta * 1000);
    marcas[k] = Date.now() / 1000 - t0; atual = k;
  };
  const pausa = (ms) => p.waitForTimeout(ms);
  const digitar = (loc, txt) => loc.pressSequentially(txt, { delay: 110 });
  // rolagem suave até o elemento, em qualquer container que role
  const rolarAte = async (loc, block = 'start', ms = 900) => {
    await loc.evaluate((el, block) => el.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' }), block);
    await pausa(ms);
  };
  // chamada autenticada com o token da sessão (limpeza de dados da demo)
  const api = (metodo, path, corpo) => p.evaluate(async ([metodo, path, corpo]) => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('rs_token')}` };
    if (corpo) headers['content-type'] = 'application/json';
    const r = await fetch(path, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined });
    return r.headers.get('content-type')?.includes('json') ? r.json() : null;
  }, [metodo, path, corpo]);

  try {
    await roteiro({ p, marca, pausa, digitar, rolarAte, api });
  } catch (e) {
    await p.screenshot({ path: `${dir}/tmp/erro.png` }).catch(() => {});
    throw e;
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => {});
    await b.close();
  }
  if (marcas.fim == null) throw new Error('roteiro não chamou marca("fim")');

  // quadros chegam só quando a tela muda: cada um dura até o próximo
  const fim = t0 + marcas.fim;
  let lista = 'ffconcat version 1.0\n';
  quadros.forEach((q, i) => {
    const ate = Math.min(quadros[i + 1]?.ts ?? fim, fim);
    if (ate > t0 && q.ts < fim) lista += `file '${q.file}'\nduration ${Math.max(0.001, ate - Math.max(q.ts, t0)).toFixed(3)}\n`;
  });
  lista += `file '${quadros.filter((q) => q.ts < fim).at(-1).file}'\n`;
  writeFileSync(`${FR}lista.txt`, lista);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${FR}lista.txt`,
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', `${dir}/raw.mp4`]);
  marcas.total = marcas.fim + Math.max(3, (falas.fim ?? 0) + FOLGA * 3); // + card final
  writeFileSync(`${dir}/marcas.json`, JSON.stringify(marcas, null, 2));
  console.log(marcas);
}
