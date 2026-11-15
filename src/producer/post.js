import { loadBrand } from './ff.js';
import { renderSlides } from './slides.js';

// Post de imagem única: um JPEG 1080x1350 com a manchete e uma frase de apoio.
export async function renderPost(post, outDir) {
  const brand = await loadBrand();
  const paths = await renderSlides([{ kind: 'cover', kicker: post.label || brand.label, title: post.hook, sub: post.script }], brand, outDir, { prefix: 'post', single: true });
  return { paths };
}
