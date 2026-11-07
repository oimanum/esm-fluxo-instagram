import { join } from 'node:path';
import { ProducerError } from './tts.js';
import { loadBrand } from './ff.js';
import { withBrowser, shot, slideHtml } from './html.js';

// Carrossel: capa (gancho) + de 3 a 6 slides + último slide com o CTA. Cada slide é um JPEG 1080x1350.
export async function renderCarousel(post, outDir) {
  const brand = await loadBrand();
  const parts = post.script.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 6);
  const slides = [
    { title: post.hook, foot: 'swipe' },
    ...parts.map((title) => ({ title })),
    { title: post.cta, foot: 'cta', label: 'Próximo passo' },
  ];
  if (slides.length < 5 || slides.length > 8) throw new ProducerError(`Carrossel com ${slides.length} slides (esperado 5–8)`);
  const label = post.label || brand.label;
  const paths = [];
  await withBrowser(async (browser) => {
    for (let i = 0; i < slides.length; i++) {
      const path = join(outDir, `slide-${String(i + 1).padStart(2, '0')}.jpg`);
      const html = await slideHtml({ brand, i, n: slides.length, label: slides[i].label || label, title: slides[i].title, foot: slides[i].foot });
      await shot(browser, html, { w: 1080, h: 1350, path, type: 'jpeg' });
      paths.push(path);
    }
  });
  return { paths };
}
