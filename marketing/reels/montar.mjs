// Monta o reel final 1080x1920: node marketing/reels/montar.mjs <pasta-do-reel>
// Lê raw.mp4 + marcas.json (gravar.mjs), legendas.json, tmp/trilha.wav (trilha.py)
// e, se houver, a narração tmp/fala_*.wav (narracao.py): música abaixa sob a voz.
// legendas.json: { cenas: [{ de: "<marca>" | "inicio", txt }], card: "<html>", drop: "<marca>" }
import { chromium } from '../../e2e/node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const DIR = resolve(process.argv[2] ?? '.') + '/';
const m = { inicio: 0, ...JSON.parse(readFileSync(`${DIR}marcas.json`, 'utf8')) };
const leg = JSON.parse(readFileSync(`${DIR}legendas.json`, 'utf8'));
const total = m.total ?? m.fim + 3;
const FIM = total - m.fim; // segundos do card final
const FOLGA = 0.3; // mesmo respiro do lib.mjs
const falas = existsSync(`${DIR}tmp/falas.json`) ? Object.keys(JSON.parse(readFileSync(`${DIR}tmp/falas.json`, 'utf8'))) : [];
const cenas = leg.cenas.map((c, i) => ({ txt: c.txt, de: m[c.de], ate: i + 1 < leg.cenas.length ? m[leg.cenas[i + 1].de] : total }));
if (cenas.some((c) => c.de == null)) throw new Error(`marca ausente em legendas.json; marcas: ${Object.keys(m)}`);

const logo = readFileSync(new URL('../../marca/rovva-logo-dark.svg', import.meta.url), 'utf8');
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;800&display=block');
  *{margin:0;box-sizing:border-box} body{width:1080px;height:1920px;font-family:Inter,sans-serif;color:#fff;overflow:hidden}
  em{font-style:normal;color:#FF6A2B}
  h1{position:absolute;left:90px;right:90px;top:95px;height:180px;display:flex;align-items:center;justify-content:center;
     text-align:center;font-size:60px;font-weight:800;letter-spacing:-.02em;line-height:1.12}
  .janela{position:absolute;left:135px;top:300px;width:810px;height:1350px;border-radius:40px;
     box-shadow:0 0 0 2000px #0D1220;outline:2px solid rgba(255,255,255,.12)}
  .logo{position:absolute;left:0;right:0;bottom:120px;display:flex;justify-content:center}
  .logo svg{width:300px;height:auto}`;
const moldura = (txt) => `<style>${css}</style><div class="janela"></div><h1><span>${txt}</span></h1><div class="logo">${logo}</div>`;
const card = `<style>${css} body{background:#0D1220;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px}
  .logo{position:static} .logo svg{width:640px} p{font-size:56px;font-weight:800;letter-spacing:-.02em;text-align:center;line-height:1.15}
  small{font-size:40px;font-weight:500;color:#9AA6C4}</style>
  <div class="logo">${logo}</div><p>${leg.card}</p><small>rovva.tech</small>`;

mkdirSync(`${DIR}tmp`, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const render = async (html, file) => {
  await p.setContent(html); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, omitBackground: true });
};
for (const [i, c] of cenas.entries()) await render(moldura(c.txt), `${DIR}tmp/cena${i}.png`);
await render(card, `${DIR}tmp/card.png`);
await b.close();

// fundo -> gravação na janela -> moldura da cena ativa -> card final
const inputs = ['-i', `${DIR}raw.mp4`];
for (const i of cenas.keys()) inputs.push('-loop', '1', '-i', `${DIR}tmp/cena${i}.png`);
inputs.push('-loop', '1', '-i', `${DIR}tmp/card.png`, '-i', `${DIR}tmp/trilha.wav`);
for (const k of falas) inputs.push('-i', `${DIR}tmp/fala_${k}.wav`);
let f = `color=c=0x0D1220:s=1080x1920:r=30:d=${total}[bg];`
  + `[0:v]scale=810:1350,tpad=stop_mode=clone:stop_duration=${FIM + 1}[v];[bg][v]overlay=135:300[s0];`;
cenas.forEach((c, i) => { f += `[s${i}][${i + 1}:v]overlay=0:0:enable='between(t,${c.de},${c.ate})'[s${i + 1}];`; });
const n = cenas.length;
f += `[${n + 1}:v]format=rgba,fade=in:st=${m.fim}:d=0.4:alpha=1[c];[s${n}][c]overlay=0:0:enable='gte(t,${m.fim})',format=yuv420p[out];`;
const musica = `[${n + 2}:a]aecho=0.8:0.5:60|120:0.25|0.15,pan=stereo|c0=c0|c1=c0,afade=in:d=0.3,afade=out:st=${total - 2}:d=2`;
if (falas.length) {
  // cada fala entra FOLGA depois do início da cena dela; a música abaixa sob a voz
  f += `${musica},volume=0.35[mus];`;
  falas.forEach((k, i) => {
    const ms = Math.round((m[k] + FOLGA) * 1000);
    f += `[${n + 3 + i}:a]aresample=44100,pan=stereo|c0=c0|c1=c0,adelay=${ms}|${ms}[f${i}];`;
  });
  f += `${falas.map((_, i) => `[f${i}]`).join('')}amix=inputs=${falas.length}:normalize=0,apad,asplit[voz][chave];`
    + `[mus][chave]sidechaincompress=threshold=0.01:ratio=14:attack=10:release=400[fundo];`
    + `[fundo][voz]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5[aud]`;
} else {
  f += `${musica},loudnorm=I=-14:TP=-1.5[aud]`;
}
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', f,
  '-map', '[out]', '-map', '[aud]', '-t', String(total),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', '30', '-c:a', 'aac',
  '-movflags', '+faststart', `${DIR}reel.mp4`], { stdio: 'inherit' });
console.log(`${DIR}reel.mp4`);
