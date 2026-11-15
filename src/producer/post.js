import { join } from 'node:path';
import { loadBrand } from './ff.js';
import { withBrowser, shot, postHtml } from './html.js';

// Post de imagem única: um JPEG 1080x1350 com o título, uma frase de apoio e o fechamento.
export async function renderPost(post, outDir) {
  const brand = await loadBrand();
  const path = join(outDir, 'post.jpg');
  await withBrowser(async (browser) => {
    const html = await postHtml({ brand, label: post.label || brand.label, title: post.hook, text: post.script, foot: `Link na bio · ${brand.handle}` });
    await shot(browser, html, { w: 1080, h: 1350, path, type: 'jpeg' });
  });
  return { paths: [path] };
}
