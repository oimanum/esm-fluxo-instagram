// Tira quadros de um estilo em vários instantes (rápido, sem montar o vídeo) para conferir o visual.
// uso: node scripts/motion-frames.mjs <estilo> <saida-dir> [t1,t2,...]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadBrand } from '../src/producer/ff.js';
import { reelScreens } from '../src/producer/reel.js';
import { motionHtml, motionScenes } from '../src/producer/motion.js';
import { withBrowser } from '../src/producer/html.js';
import { readFile } from 'node:fs/promises';

const [style, out, ts] = process.argv.slice(2);
const times = (ts || '0.4,1.4,4,8,12,16,20,24,28,31').split(',').map(Number);
const post = {
  label: 'ESM WEB · SITES E LANDING PAGES',
  hook: 'Seu site **perde paciente** todo dia sem você perceber.',
  script: 'Todo dia alguém procura uma clínica como a sua no Google. Entra no seu site, espera quatro segundos e vai embora. Site lento não é detalhe técnico, é paciente que agenda no concorrente. Teste agora: abra seu site no celular com dados móveis. Se demorou mais de três segundos, você está pagando para perder cliente. A boa notícia é que dá para corrigir em poucos dias.',
  caption: 'c', hashtags: [], cta: 'Comente **SITE** e veja como ter um site que traz cliente',
};
const brand = await loadBrand();
const dur = 32;
const scenes = motionScenes(reelScreens(post, brand.label), dur);
const logo = `data:image/png;base64,${(await readFile(brand.logoPath)).toString('base64')}`;
const html = await motionHtml({ style, dur, scenes, brand: { logo, handle: brand.handle, label: brand.label, site: brand.site } });
await mkdir(out, { recursive: true });
await withBrowser(async (b) => {
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  pg.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  pg.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await pg.setContent(html, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  for (const t of times) {
    const t0 = Date.now();
    await pg.evaluate((x) => window.__draw(x), t);
    await pg.screenshot({ path: join(out, `${style}-${String(t).replace('.', '_')}.png`) });
    console.log(style, t, Date.now() - t0, 'ms');
  }
});
console.log('scenes', scenes.map((s) => `${s.i}:${s.t0.toFixed(1)}`).join(' '));
