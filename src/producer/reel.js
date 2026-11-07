import { join } from 'node:path';
import { synth, ProducerError } from './tts.js';
import { loadBrand, ffmpeg, durationOf } from './ff.js';
import { withBrowser, shot, reelBgHtml, reelTextHtml } from './html.js';
import { plain, splitSegments } from '../text.js';

const sentence = (s) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// Telas do Reel: gancho, uma tela por frase do roteiro, e o CTA no fim.
export function reelScreens(post, brandLabel) {
  return [
    { title: post.hook, label: post.label || brandLabel },
    ...splitSegments(plain(post.script)).map((title) => ({ title })),
    { title: post.cta, cta: true },
  ];
}

export async function renderReel(post, outDir, { ttsImpl = synth } = {}) {
  const brand = await loadBrand();
  const audio = join(outDir, 'voz.mp3');
  const narration = [sentence(plain(post.hook)), sentence(plain(post.script)), sentence(plain(post.cta))].join(' ');
  await ttsImpl(narration, audio);
  const dur = await durationOf(audio);
  if (dur < 20 || dur > 35) throw new ProducerError(`Locução com ${dur.toFixed(1)} s (esperado 20–35 s)`);

  // Cada tela dura em proporção ao tamanho do texto que é falado nela.
  const screens = reelScreens(post, brand.label);
  const total = screens.reduce((n, s) => n + plain(s.title).length, 0);
  let t = 0;
  for (const s of screens) {
    s.t0 = t;
    t += dur * (plain(s.title).length / total);
    s.t1 = t;
  }

  await withBrowser(async (browser) => {
    await shot(browser, await reelBgHtml({ brand }), { w: 1080, h: 1920, path: join(outDir, 'bg.png') });
    for (let i = 0; i < screens.length; i++) {
      const s = screens[i];
      await shot(browser, await reelTextHtml({ brand, label: s.label, title: s.title, cta: s.cta }), { w: 1080, h: 1920, path: join(outDir, `ov-${i}.png`), transparent: true });
    }
  });

  const f = (x) => x.toFixed(2);
  const inputs = ['-loop', '1', '-framerate', '30', '-t', f(dur), '-i', 'bg.png', '-i', 'voz.mp3'];
  let graph = '[0:v]format=yuv420p[b0];';
  screens.forEach((s, i) => {
    inputs.push('-loop', '1', '-framerate', '30', '-t', f(Math.min(dur, s.t1 + 0.5)), '-i', `ov-${i}.png`);
    const fadeOutAt = Math.max(s.t0 + 0.4, s.t1 - 0.12);
    graph += `[${i + 2}:v]format=rgba,fade=t=in:st=${f(s.t0)}:d=0.3:alpha=1,fade=t=out:st=${f(fadeOutAt)}:d=0.12:alpha=1[o${i}];`;
    graph += `[b${i}][o${i}]overlay=x=0:y='26*(1-min(1,max(0,(t-${f(s.t0)})/0.3)))':enable='between(t,${f(s.t0)},${f(s.t1 + 0.12)})'[b${i + 1}];`;
  });
  graph = graph.slice(0, -1);

  const out = join(outDir, 'reel.mp4');
  await ffmpeg([
    ...inputs, '-filter_complex', graph,
    '-map', `[b${screens.length}]`, '-map', '1:a',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-movflags', '+faststart', '-shortest', 'reel.mp4',
  ], outDir);
  return { path: out, durationSec: await durationOf(out) };
}
