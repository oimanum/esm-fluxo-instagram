import { ProducerError } from './tts.js';
import { loadBrand } from './ff.js';
import { renderSlides } from './slides.js';
import { slidesFor } from '../slides.js';

// Carrossel: capa (gancho) + de 3 a 6 slides escolhidos pelo conteúdo + último slide com o CTA. JPEG 1080x1350.
export async function renderCarousel(post, outDir) {
  const brand = await loadBrand();
  const slides = [
    { kind: 'cover', kicker: post.label || brand.label, title: post.hook, sub: post.sub },
    ...slidesFor(post),
    { kind: 'cta', title: post.cta },
  ];
  if (slides.length < 5 || slides.length > 8) throw new ProducerError(`Carrossel com ${slides.length} slides (esperado 5–8)`);
  return { paths: await renderSlides(slides, brand, outDir) };
}
