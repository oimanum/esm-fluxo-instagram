import { join } from 'node:path';
import { ProducerError } from './tts.js';
import { loadBrand } from './ff.js';
import { withBrowser, shot, checklistHtml } from './html.js';

// Encolhe o conteúdo até caber na tela; se nem assim couber, falha em vez de entregar imagem cortada.
async function fit(pg) {
  const bottom = await pg.evaluate(() => {
    const el = document.querySelector('.fit');
    let k = 1;
    el.style.zoom = k;
    const height = () => el.getBoundingClientRect().height;
    while (176 + height() > 1270 && k > 0.6) { k -= 0.05; el.style.zoom = k; }
    // centraliza na vertical, sem subir acima da faixa do logo (176 px)
    const top = Math.max(176, Math.round((1350 - height()) / 2) + 20);
    document.querySelector('.block').style.top = `${top}px`;
    return top + height();
  });
  if (bottom > 1310) throw new ProducerError('O checklist não cabe na imagem: itens ou título longos demais');
}

// Checklist: uma imagem JPEG 1080x1350.
export async function renderChecklist(post, outDir) {
  const brand = await loadBrand();
  const items = post.script.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (items.length < 3) throw new ProducerError(`Checklist com ${items.length} itens (esperado 3–5)`);
  const path = join(outDir, 'checklist.jpg');
  await withBrowser(async (browser) => {
    const html = await checklistHtml({ brand, label: post.label || brand.label, title: post.hook, items, footer: post.cta });
    await shot(browser, html, { w: 1080, h: 1350, path, type: 'jpeg', prepare: fit });
  });
  return { paths: [path] };
}
