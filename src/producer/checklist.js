import { ProducerError } from './tts.js';
import { loadBrand } from './ff.js';
import { renderSlides } from './slides.js';

// Checklist: uma imagem JPEG 1080x1350 com a pergunta, os itens para marcar e a frase de fechamento.
export async function renderChecklist(post, outDir) {
  const brand = await loadBrand();
  const items = post.script.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (items.length < 3) throw new ProducerError(`Checklist com ${items.length} itens (esperado 3–5)`);
  const paths = await renderSlides([{ kind: 'checklist', kicker: post.label || brand.label, title: post.hook, items, footer: post.cta }], brand, outDir, { prefix: 'checklist', single: true });
  return { paths };
}
