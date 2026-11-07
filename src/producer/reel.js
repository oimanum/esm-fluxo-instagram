import { join } from 'node:path';
import { synth, ProducerError } from './tts.js';
import { loadBrand, esc, wrap, ffmpeg, durationOf, drawLines } from './ff.js';

export function chunkWords(text, size = 5) {
  const w = text.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(' '));
  return out;
}

export async function renderReel(post, outDir, { ttsImpl = synth } = {}) {
  const brand = await loadBrand();
  const audio = join(outDir, 'voz.mp3');
  const narration = `${post.hook}. ${post.script}. ${post.cta}`;
  await ttsImpl(narration, audio);
  const dur = await durationOf(audio);
  if (dur < 20 || dur > 35) throw new ProducerError(`Locução com ${dur.toFixed(1)} s (esperado 20–35 s)`);

  const font = esc(brand.fontFile);
  const chunks = chunkWords(narration);
  const total = chunks.reduce((n, c) => n + c.split(' ').length, 0);
  let t = 0;
  const draws = [];
  for (let i = 0; i < chunks.length; i++) {
    const span = dur * (chunks[i].split(' ').length / total);
    const n = wrap(chunks[i], 18).split('\n').length;
    const { filters } = await drawLines({
      dir: outDir, id: `c${i}`, text: chunks[i], maxChars: 18, font, size: 84, color: brand.colors.text,
      x: '(w-text_w)/2', top: `(h-${Math.round(84 * 1.3) * n})/2`, enable: `between(t,${t.toFixed(2)},${(t + span).toFixed(2)})`,
    });
    draws.push(...filters);
    t += span;
  }
  const hook = await drawLines({ dir: outDir, id: 'hook', text: post.hook, maxChars: 22, font, size: 44, color: brand.colors.muted, x: '(w-text_w)/2', top: '220', enable: 'lt(t,3)' });
  draws.push(...hook.filters);

  const out = join(outDir, 'reel.mp4');
  await ffmpeg([
    '-f', 'lavfi', '-i', `color=c=0x${brand.colors.bg}:s=1080x1920:d=${dur.toFixed(2)}:r=30`,
    '-i', 'voz.mp3', '-i', brand.logoPath,
    '-filter_complex', `[2:v]scale=140:-1[lg];[0:v][lg]overlay=(W-w)/2:1500[bg];[bg]${draws.join(',')}[v]`,
    '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', '-shortest', 'reel.mp4',
  ], outDir);
  return { path: out, durationSec: await durationOf(out) };
}
