// Tira um quadro de cada animação do catálogo (visuals) em um estilo, para conferir o visual.
// uso: node scripts/visuals-gallery.mjs <estilo> <saida-dir>
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadBrand } from '../src/producer/ff.js';
import { reelScreens } from '../src/producer/reel.js';
import { motionHtml, motionScenes } from '../src/producer/motion.js';
import { withBrowser } from '../src/producer/html.js';

const [style = 'editorial', out = 'out/qa/gal'] = process.argv.slice(2);
const V = {
  search: { type: 'search', query: 'dentista perto de mim' },
  chat: { type: 'chat', msgs: [{ who: 'cliente', text: 'Oi, vocês atendem hoje?' }, { who: 'voce', text: 'Atendemos! Qual horário?' }, { who: 'cliente', text: 'Às 14h, pode ser?' }] },
  loading: { type: 'loading', label: 'Carregando…', outcome: 'Cliente saiu' },
  versus: { type: 'versus', left: { title: 'Sem site', items: ['Não aparece no Google', 'Passa pouca confiança'] }, right: { title: 'Com site', items: ['Aparece no Google', 'Passa confiança'] } },
  checklist: { type: 'checklist', items: ['Abre rápido no celular', 'Aparece no Google', 'Botão de WhatsApp visível'] },
  funnel: { type: 'funnel', steps: ['Pesquisa', 'Visita', 'Contato', 'Cliente'] },
  steps: { type: 'steps', steps: ['Briefing', 'Protótipo', 'Site no ar'] },
  notification: { type: 'notification', items: ['Novo contato pelo WhatsApp', 'Pedido de orçamento', 'Novo agendamento'] },
  quote: { type: 'quote', text: 'Será que essa empresa é confiável?', who: 'Cliente' },
  map: { type: 'map', name: 'Sua empresa', label: 'Aberto agora' },
  clock: { type: 'clock', label: 'Sempre disponível' },
  stat: { type: 'stat', value: '53%', label: 'saem se a página demora' },
  site: { type: 'site', niche: 1 },
  none: { type: 'none' },
};
const brand = await loadBrand();
const logo = `data:image/png;base64,${(await readFile(brand.logoPath)).toString('base64')}`;
await mkdir(out, { recursive: true });
await withBrowser(async (b) => {
  for (const [name, vis] of Object.entries(V)) {
    const post = { label: 'TESTE', hook: 'Gancho do **Reel**', script: 'Esta é a frase que a animação ilustra com calma. Outra frase para fechar.', cta: 'Comente **SITE**', visuals: [vis, { type: 'none' }] };
    const scenes = motionScenes(reelScreens(post, brand.label), 20);
    const S = scenes[1];
    const html = await motionHtml({ style, dur: 20, scenes, brand: { logo, handle: brand.handle, label: brand.label, site: brand.site } });
    const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    pg.on('pageerror', (e) => console.log('PAGEERROR', name, e.message));
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.evaluate((x) => window.__draw(x), S.t0 + Math.min(3.4, (S.t1 - S.t0) * 0.92));
    await pg.screenshot({ path: join(out, `g-${name}.png`) });
    await pg.close();
  }
});
console.log('ok');
