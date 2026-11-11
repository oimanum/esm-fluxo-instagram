// Motor de motion graphics dos Reels: uma página HTML animada por tempo (src/producer/motion/page.js),
// fotografada quadro a quadro pelo Chrome e montada com a locução e os efeitos sonoros pelo ffmpeg.
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { parseEmphasis, plain } from '../text.js';
import { withBrowser } from './html.js';
import { ffmpeg, durationOf } from './ff.js';

const require = createRequire(import.meta.url);
const here = (f) => fileURLToPath(new URL(`./motion/${f}`, import.meta.url));
const SFX = (f) => fileURLToPath(new URL(`../../brand/sfx/${f}`, import.meta.url));

// Cada estilo tem uma linguagem visual própria: assim os vídeos não ficam todos iguais.
export const MOTION_STYLES = ['kinetic', 'ui', 'shapes', 'terminal', 'steps'];

// Um estilo por dia, em rodízio (e o mesmo dia sempre dá o mesmo estilo). MOTION_STYLE força um.
export function pickStyle(now = new Date(), env = process.env) {
  if (MOTION_STYLES.includes(env.MOTION_STYLE)) return env.MOTION_STYLE;
  return MOTION_STYLES[Math.floor(now.getTime() / 86400000) % MOTION_STYLES.length];
}

let fonts;
async function fontCss() {
  if (fonts) return fonts;
  const face = async (family, pkg, weight) => {
    const file = require.resolve(`@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`);
    const b64 = (await readFile(file)).toString('base64');
    return `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  };
  fonts = (await Promise.all([face('Poppins', 'poppins', 500), face('Poppins', 'poppins', 600), face('Poppins', 'poppins', 800), face('JetBrains Mono', 'jetbrains-mono', 500)])).join('\n');
  return fonts;
}

export async function motionHtml(data) {
  const css = await readFile(here('page.css'), 'utf8');
  const js = await readFile(here('page.js'), 'utf8');
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${await fontCss()}\n${css}</style></head><body>
<div id="root"><div id="bg"></div><div id="tint"></div><div id="grid"></div><div id="stage"></div>
<div id="chrome"><img src="${data.brand.logo}"><div class="h">${data.brand.handle}</div></div><div id="top"></div></div>
<script>window.__DATA=${json};</script><script>${js}</script></body></html>`;
}

// Cenas do Reel: gancho, uma por frase do roteiro e o CTA, cada uma com o tempo proporcional ao texto falado.
export function motionScenes(screens, dur) {
  const total = screens.reduce((n, s) => n + plain(s.title).length, 0);
  let t = 0;
  return screens.map((s, i) => {
    const t0 = t;
    t += dur * (plain(s.title).length / total);
    return { i, kind: i === 0 ? 'hook' : s.cta ? 'cta' : 'line', label: s.label || '', parts: parseEmphasis(s.title), text: plain(s.title), t0, t1: t };
  });
}

// Efeitos sonoros enxutos: whoosh a cada troca de cena, digitação nos estilos de texto digitado e um golpe no CTA.
export function motionSfx(scenes, style) {
  const ev = [];
  scenes.forEach((S) => {
    const d = S.t1 - S.t0;
    if (S.i > 0) ev.push({ file: 'whoosh.wav', t: Math.max(0, S.t0 - 0.08), vol: 0.2, len: 0.6 });
    if (S.kind === 'cta') ev.push({ file: 'hit.wav', t: S.t0 + 0.05, vol: 0.24, len: 0.6 });
    if (style === 'ui' || style === 'terminal') ev.push({ file: 'type.wav', t: S.t0 + 0.3, vol: 0.14, len: Math.min(1.4, d * 0.55) });
    if (style === 'ui' && S.parts.some((p) => p.strong)) ev.push({ file: 'click.wav', t: S.t0 + d * 0.84, vol: 0.3, len: 0.1 });
    if (style === 'kinetic' && S.kind !== 'cta') ev.push({ file: 'pop.wav', t: S.t0 + 0.12, vol: 0.18, len: 0.1 });
  });
  return ev;
}

async function mixAudio(voice, events, dur, outDir) {
  const inputs = ['-i', resolve(voice)];
  let graph = '[0:a]aresample=44100,aformat=channel_layouts=stereo[v0];';
  const labels = ['[v0]'];
  events.forEach((e, k) => {
    inputs.push('-i', SFX(e.file));
    const ms = Math.round(e.t * 1000);
    graph += `[${k + 1}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=0:${e.len.toFixed(2)},adelay=${ms}|${ms},volume=${e.vol}[s${k}];`;
    labels.push(`[s${k}]`);
  });
  graph += `${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first[m];[m]loudnorm=I=-14:TP=-1.5:LRA=11[out]`;
  await ffmpeg([...inputs, '-filter_complex', graph, '-map', '[out]', '-t', dur.toFixed(2), 'mix.wav'], outDir);
}

// Renderiza o Reel: devolve o caminho do mp4. Os quadros são tirados em paralelo (poucas abas) e jogados fora no fim.
export async function renderMotion({ brand, screens, voicePath, dur, outDir, style, fps = 30, workers = 2 }) {
  const scenes = motionScenes(screens, dur);
  const logo = `data:image/png;base64,${(await readFile(brand.logoPath)).toString('base64')}`;
  const html = await motionHtml({ style, dur, scenes, brand: { logo, handle: brand.handle, label: brand.label, site: brand.site } });
  const frames = join(outDir, 'frames');
  await mkdir(frames, { recursive: true });
  const n = Math.ceil(dur * fps);
  await withBrowser(async (browser) => {
    const pages = await Promise.all(Array.from({ length: workers }, async () => {
      const pg = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
      await pg.setContent(html, { waitUntil: 'load' });
      await pg.evaluate(() => document.fonts.ready);
      return pg;
    }));
    let next = 0;
    await Promise.all(pages.map(async (pg) => {
      for (;;) {
        const k = next++;
        if (k >= n) return;
        await pg.evaluate((t) => window.__draw(t), k / fps);
        await pg.screenshot({ path: join(frames, `f${String(k).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
      }
    }));
    await Promise.all(pages.map((pg) => pg.close()));
  });
  await mixAudio(voicePath, motionSfx(scenes, style), dur, outDir);
  await ffmpeg([
    '-framerate', String(fps), '-i', 'frames/f%05d.jpg', '-i', 'mix.wav',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', 'reel.mp4',
  ], outDir);
  await rm(frames, { recursive: true, force: true });
  await rm(join(outDir, 'mix.wav'), { force: true });
  const path = join(outDir, 'reel.mp4');
  return { path, durationSec: await durationOf(path), style };
}
