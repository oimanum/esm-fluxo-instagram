import { loadBrand } from './ff.js';
import { renderSlides } from './slides.js';
import { storyFrames } from '../story.js';

// Stories: de 3 a 4 imagens 1080x1920 (JPEG) por dia, derivadas do post, no mesmo estilo dos slides.
export async function renderStory(post, outDir, { format = 'reel' } = {}) {
  const brand = await loadBrand();
  const paths = await renderSlides(storyFrames(post, format), brand, outDir, { w: 1080, h: 1920, story: true, prefix: 'story' });
  return { paths };
}
