// Motor visual: monta as telas em HTML/CSS com a identidade da ESM Web e tira "foto" com o Chrome.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseEmphasis, plain } from '../text.js';
import { ProducerError } from './tts.js';

const require = createRequire(import.meta.url);
const WEIGHTS = [300, 500, 600];

let cachedFontCss;
async function fontCss() {
  if (cachedFontCss) return cachedFontCss;
  const faces = [];
  for (const w of WEIGHTS) {
    const file = require.resolve(`@fontsource/poppins/files/poppins-latin-${w}-normal.woff2`);
    const b64 = (await readFile(file)).toString('base64');
    faces.push(`@font-face{font-family:'Poppins';font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`);
  }
  cachedFontCss = faces.join('\n');
  return cachedFontCss;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const titleHtml = (text) => parseEmphasis(text).map((p) => `<span class="${p.strong ? 's' : 'l'}">${esc(p.text)}</span>`).join('');

// Tamanho do título conforme o tamanho do texto, para nunca estourar a tela.
export function titleSize(text, base = 1) {
  const n = plain(text).length;
  const px = n <= 34 ? 88 : n <= 60 ? 78 : n <= 90 ? 68 : 58;
  return Math.round(px * base);
}

const CSS = (w, h) => `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:#0A0B0D;font-family:'Poppins',sans-serif;color:#fff}
body.clear,html:has(body.clear){background:transparent}
.bg{position:absolute;inset:0;background:radial-gradient(120% 85% at 28% 18%,#1B1D21 0%,#101114 46%,#0A0B0D 100%)}
.glow{position:absolute;inset:0;background:radial-gradient(60% 40% at 78% 100%,rgba(201,204,209,.07),transparent 70%)}
.swoosh{position:absolute;left:0;right:0;bottom:0;width:100%;height:42%}
.logo{position:absolute;left:64px;top:64px;width:128px;height:auto}
.top-right{position:absolute;right:64px;top:84px;font-weight:300;font-size:22px;letter-spacing:.26em;color:#9A9EA5}
.block{position:absolute;left:80px;right:80px}
.label{font-weight:500;font-size:20px;letter-spacing:.32em;text-transform:uppercase;color:#9A9EA5;margin-bottom:30px}
.title{font-weight:600;line-height:1.14;letter-spacing:-.012em;color:#fff}
.title .s{font-weight:600;color:#fff}
.title .l{font-weight:300;color:#C9CCD1}
.divider{width:84px;height:2px;background:rgba(255,255,255,.55);margin:46px 0 30px}
.foot{font-weight:300;font-size:28px;color:#9A9EA5;display:flex;align-items:center;gap:14px}
.foot b{font-weight:500;color:#C9CCD1}
.cards{display:flex;flex-direction:column;gap:22px;margin-top:44px}
.card{display:flex;align-items:center;gap:26px;padding:28px 34px;border-radius:22px;background:rgba(27,29,33,.92);border:1.5px solid rgba(255,255,255,.09);box-shadow:0 10px 30px rgba(0,0,0,.25)}
.box{flex:none;width:34px;height:34px;border-radius:9px;border:2px solid #9A9EA5}
.card .t{font-weight:400;font-size:31px;line-height:1.25;color:#E4E6E9}
.fine{margin-top:42px;font-size:28px;line-height:1.4}
.fine .s{font-weight:500;color:#fff}
.fine .l{font-weight:300;color:#9A9EA5}
.chip{display:inline-block;padding:12px 26px;border:1.5px solid rgba(201,204,209,.55);border-radius:999px;font-weight:500;font-size:22px;letter-spacing:.24em;text-transform:uppercase;color:#C9CCD1;margin-bottom:40px}
.hint{position:absolute;left:0;right:0;bottom:330px;text-align:center;font-weight:300;font-size:30px;letter-spacing:.06em;color:#9A9EA5}
.pill{display:inline-block;margin-top:44px;padding:20px 40px;border:1.5px solid rgba(201,204,209,.7);border-radius:999px;font-weight:500;font-size:30px;color:#fff;letter-spacing:.02em}
`;

const SWOOSH = `<svg class="swoosh" viewBox="0 0 1080 560" preserveAspectRatio="none"><defs>
<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs>
<path d="M -40 560 C 260 470, 640 430, 1120 170" fill="none" stroke="url(#g)" stroke-width="10" opacity=".35"/>
<path d="M -40 560 C 260 470, 640 430, 1120 170" fill="none" stroke="url(#g)" stroke-width="2"/></svg>`;

let cachedLogo;
async function logoUri(path) {
  cachedLogo ||= `data:image/png;base64,${(await readFile(path)).toString('base64')}`;
  return cachedLogo;
}

async function page({ w, h, body, clear = false }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${await fontCss()}${CSS(w, h)}</style></head><body class="${clear ? 'clear' : ''}">${body}</body></html>`;
}

const arrow = `<svg width="34" height="18" viewBox="0 0 34 18" fill="none" stroke="#C9CCD1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9h28M23 2l8 7-8 7"/></svg>`;

// Slide do carrossel (1080x1350).
export async function slideHtml({ brand, i, n, label, title, foot, h = 1350 }) {
  const pad = (k) => String(k).padStart(2, '0');
  const footHtml = foot === 'swipe' ? `<span>Deslize para ver</span>${arrow}` : foot === 'cta' ? `Link na bio <b>·</b> <b>${esc(brand.handle)}</b>` : '';
  const body = `<div class="bg"></div><div class="glow"></div>${SWOOSH}
<img class="logo" src="${await logoUri(brand.logoPath)}">
<div class="top-right">${pad(i + 1)} / ${pad(n)}</div>
<div class="block" style="top:50%;transform:translateY(-47%)">
  ${label ? `<div class="label">${esc(label)}</div>` : ''}
  <div class="title" style="font-size:${titleSize(title)}px">${titleHtml(title)}</div>
  ${footHtml ? `<div class="divider"></div><div class="foot">${footHtml}</div>` : ''}
</div>`;
  return page({ w: 1080, h, body });
}

// Ícones das capas de Destaque (traço fino prata, 48x48).
const ICONS = {
  resultados: '<path d="M5 40h38"/><path d="M7 33l11-11 7 6 16-17"/><path d="M31 11h10v10"/>',
  'como-funciona': '<circle cx="9" cy="24" r="5"/><circle cx="24" cy="24" r="5"/><circle cx="39" cy="24" r="5"/><path d="M14 24h5M29 24h5"/><path d="M36.8 24.2l1.6 1.6 3-3.2"/>',
  'quem-sou': '<circle cx="24" cy="16" r="7"/><path d="M9 41c0-8.5 6.5-14 15-14s15 5.5 15 14"/>',
};
export const HIGHLIGHT_COVERS = Object.keys(ICONS);

// Capa de Destaque (1080x1920). O Instagram mostra só um círculo no centro, então só o ícone fica ali.
export async function highlightCoverHtml({ icon }) {
  const body = `<div class="bg"></div><div class="glow"></div>
<div style="position:absolute;left:50%;top:50%;width:560px;height:560px;transform:translate(-50%,-50%);border-radius:50%;border:2px solid rgba(201,204,209,.28);background:radial-gradient(closest-side,rgba(201,204,209,.08),transparent)"></div>
<svg style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)" width="300" height="300" viewBox="0 0 48 48" fill="none" stroke="#C9CCD1" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</svg>`;
  return page({ w: 1080, h: 1920, body });
}

// Checklist de imagem única (1080x1350): título, cartões com caixinha de marcar e frase de fechamento.
export async function checklistHtml({ brand, label, title, items, footer }) {
  const cards = items.map((it) => `<div class="card"><div class="box"></div><div class="t">${esc(plain(it))}</div></div>`).join('');
  const body = `<div class="bg"></div><div class="glow"></div>${SWOOSH}
<img class="logo" src="${await logoUri(brand.logoPath)}">
<div class="top-right">CHECKLIST</div>
<div class="block" style="top:176px"><div class="fit">
  ${label ? `<div class="label">${esc(label)}</div>` : ''}
  <div class="title" style="font-size:${titleSize(title, 0.82)}px">${titleHtml(title)}</div>
  <div class="cards">${cards}</div>
  ${footer ? `<div class="fine">${titleHtml(footer)}</div>` : ''}
</div></div>`;
  return page({ w: 1080, h: 1350, body });
}

// Fundo fixo do Reel (1080x1920): degradê, curva de luz, logo e @.
export async function reelBgHtml({ brand }) {
  const body = `<div class="bg"></div><div class="glow"></div>${SWOOSH}
<img class="logo" src="${await logoUri(brand.logoPath)}">
<div class="top-right">${esc(brand.handle)}</div>`;
  return page({ w: 1080, h: 1920, body });
}

// Texto de uma tela do Reel, com fundo transparente, para sobrepor ao fundo fixo.
export async function reelTextHtml({ brand, label, title, cta = false }) {
  const body = `<div class="block" style="top:55%;transform:translateY(-50%)">
  ${label ? `<div class="label">${esc(label)}</div>` : ''}
  <div class="title" style="font-size:${titleSize(title, 0.92)}px">${titleHtml(title)}</div>
  ${cta ? `<div class="divider"></div><div class="foot">Link na bio <b>·</b> <b>${esc(brand.handle)}</b></div>` : ''}
</div>`;
  return page({ w: 1080, h: 1920, body, clear: true });
}

// Abre o Chrome já instalado na máquina (Chrome, depois Edge). CHROME_PATH força um caminho.
export async function withBrowser(fn) {
  const { chromium } = await import('playwright-core');
  const options = [];
  if (process.env.CHROME_PATH) options.push({ executablePath: process.env.CHROME_PATH });
  options.push({ channel: 'chrome' }, { channel: 'msedge' });
  const errors = [];
  for (const opt of options) {
    let browser;
    try { browser = await chromium.launch({ ...opt, args: ['--no-sandbox'] }); } catch (e) { errors.push(e.message.split('\n')[0]); continue; }
    try { return await fn(browser); } finally { await browser.close(); }
  }
  throw new ProducerError(`Chrome não encontrado (${errors.join(' | ')})`);
}

export async function shot(browser, html, { w, h, path, type = 'png', transparent = false, prepare }) {
  const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  try {
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    if (prepare) await prepare(pg);
    await pg.screenshot({ path, type, omitBackground: transparent, ...(type === 'jpeg' ? { quality: 93 } : {}) });
  } finally {
    await pg.close();
  }
}


// Post de imagem única (1080x1350): título, uma frase de apoio e o fechamento.
export async function postHtml({ brand, label, title, text, foot }) {
  const body = `<div class="bg"></div><div class="glow"></div>${SWOOSH}
<img class="logo" src="${await logoUri(brand.logoPath)}">
<div class="top-right">${esc(brand.handle)}</div>
<div class="block" style="top:50%;transform:translateY(-48%)">
  ${label ? `<div class="label">${esc(label)}</div>` : ''}
  <div class="title" style="font-size:${titleSize(title, 1.08)}px">${titleHtml(title)}</div>
  ${text ? `<div class="fine" style="font-size:36px">${titleHtml(text)}</div>` : ''}
  ${foot ? `<div class="divider"></div><div class="foot">${esc(foot)}</div>` : ''}
</div>`;
  return page({ w: 1080, h: 1350, body });
}

// Quadro de story (1080x1920). O Instagram cobre o topo e a base: o conteúdo fica entre ~y 300 e ~y 1500.
export async function storyHtml({ brand, chip, title, hint }) {
  const body = `<div class="bg"></div><div class="glow"></div>${SWOOSH}
<img class="logo" src="${await logoUri(brand.logoPath)}" style="top:250px">
<div class="block" style="top:52%;transform:translateY(-50%)">
  ${chip ? `<div class="chip">${esc(chip)}</div>` : ''}
  <div class="title" style="font-size:${titleSize(title, 1.12)}px">${titleHtml(title)}</div>
</div>
${hint ? `<div class="hint">${esc(hint)}</div>` : ''}`;
  return page({ w: 1080, h: 1920, body });
}
