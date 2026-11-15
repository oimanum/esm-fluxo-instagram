import { join } from 'node:path';
import { synth, ProducerError } from './tts.js';
import { loadBrand, ffmpeg, durationOf } from './ff.js';
import { renderMotion, pickStyle } from './motion.js';
import { plain, splitSegments } from '../text.js';
import { cleanVisual, visualsFor } from '../visuals.js';

const sentence = (s) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// Telas do Reel: gancho, uma tela por frase do roteiro, e o CTA no fim.
// Cada frase do roteiro tem uma ideia visual (post.visuals, já resolvida na escrita; senão, deduzida do texto).
export function reelScreens(post, brandLabel) {
  const sentences = plain(post.script).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const vis = Array.isArray(post.visuals) && post.visuals.length === sentences.length
    ? post.visuals.map((v) => cleanVisual(v) || { type: 'none' })
    : visualsFor(post, sentences);
  const screens = [{ title: post.hook, label: post.label || brandLabel }];
  sentences.forEach((s, k) => splitSegments(s).forEach((title) => screens.push({ title, vis: vis[k], gid: k })));
  screens.push({ title: post.cta, cta: true });
  return screens;
}

export async function renderReel(post, outDir, { ttsImpl = synth, style, fps = 30 } = {}) {
  const brand = await loadBrand();
  const audio = join(outDir, 'voz.mp3');
  const narration = [sentence(plain(post.hook)), sentence(plain(post.script)), sentence(plain(post.cta))].join(' ');
  await ttsImpl(narration, audio);
  let dur = await durationOf(audio);
  let audioName = 'voz.mp3';
  if (dur < 20 || dur > 35) {
    // Cada voz tem um ritmo. Até 25% de ajuste de velocidade (sem mudar o tom) cabe; além disso, o texto é que está errado.
    const factor = dur > 35 ? dur / 33 : dur / 22;
    if (factor > 1.25 || factor < 0.8) throw new ProducerError(`Locução com ${dur.toFixed(1)} s (esperado 20–35 s)`);
    await ffmpeg(['-i', 'voz.mp3', '-filter:a', `atempo=${factor.toFixed(3)}`, 'voz-ajustada.mp3'], outDir);
    audioName = 'voz-ajustada.mp3';
    dur = await durationOf(join(outDir, audioName));
    if (dur < 20 || dur > 35) throw new ProducerError(`Locução com ${dur.toFixed(1)} s depois do ajuste (esperado 20–35 s)`);
  }

  // Motion graphics: cada dia um estilo visual (ver motion.js). A locução (já ajustada) dá o tempo de cada cena.
  const screens = reelScreens(post, brand.label);
  return renderMotion({ brand, screens, voicePath: join(outDir, audioName), dur, outDir, style: style || pickStyle(), fps });
}
