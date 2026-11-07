import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { loadBrand } from './ff.js';
import { withBrowser, shot, slideHtml, highlightCoverHtml, HIGHLIGHT_COVERS } from './html.js';

// Kit de Destaques: 3 capas sempre; telas de Story só para o que existe em brand/facts.json.
// A API do Instagram não cria Destaques: o dono sobe as imagens e monta os Destaques no app.
export async function renderHighlights(facts, outDir) {
  const brand = await loadBrand();
  await mkdir(outDir, { recursive: true });
  const covers = [];
  const stories = [];

  const groups = [
    { label: 'RESULTADOS', slug: 'resultados', items: (facts.cases || []).map((c) => c.text) },
    { label: 'COMO FUNCIONA', slug: 'como-funciona', items: (facts.process || []).map((p) => (typeof p === 'string' ? p : p.text)) },
    { label: 'QUEM SOU', slug: 'quem-sou', items: facts.about || [] },
  ];

  await withBrowser(async (browser) => {
    for (const icon of HIGHLIGHT_COVERS) {
      const path = join(outDir, `capa-${icon}.png`);
      await shot(browser, await highlightCoverHtml({ icon }), { w: 1080, h: 1920, path });
      covers.push(path);
    }
    for (const g of groups) {
      for (let i = 0; i < g.items.length; i++) {
        const path = join(outDir, `story-${g.slug}-${String(i + 1).padStart(2, '0')}.jpg`);
        const html = await slideHtml({ brand, i, n: g.items.length, label: g.label, title: g.items[i], h: 1920 });
        await shot(browser, html, { w: 1080, h: 1920, path, type: 'jpeg' });
        stories.push(path);
      }
    }
  });
  return { covers, stories };
}
