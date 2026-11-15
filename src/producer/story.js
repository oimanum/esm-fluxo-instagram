import { join } from 'node:path';
import { loadBrand } from './ff.js';
import { withBrowser, shot, storyHtml } from './html.js';
import { storyFrames } from '../story.js';

// Stories: de 3 a 4 imagens 1080x1920 (JPEG) por dia, derivadas do post.
export async function renderStory(post, outDir, { format = 'reel' } = {}) {
  const brand = await loadBrand();
  const frames = storyFrames(post, format);
  const paths = [];
  await withBrowser(async (browser) => {
    for (let i = 0; i < frames.length; i++) {
      const path = join(outDir, `story-${String(i + 1).padStart(2, '0')}.jpg`);
      await shot(browser, await storyHtml({ brand, ...frames[i] }), { w: 1080, h: 1920, path, type: 'jpeg' });
      paths.push(path);
    }
  });
  return { paths };
}
