// Renderiza o mesmo Reel nos 5 estilos de motion graphics (precisa de GEMINI_KEY para a voz; sem ela usa a voz Edge).
import { mkdir } from 'node:fs/promises';
import { renderReel } from '../src/producer/reel.js';
import { MOTION_STYLES } from '../src/producer/motion.js';

const post = {
  label: 'ESM WEB · SITES E LANDING PAGES',
  hook: 'Seu site **perde paciente** todo dia sem você perceber.',
  script: 'Todo dia alguém procura uma clínica como a sua no Google. Entra no seu site, espera quatro segundos e vai embora. Site lento não é detalhe técnico, é paciente que agenda no concorrente. Teste agora: abra seu site no celular com dados móveis. Se demorou mais de três segundos, você está pagando para perder cliente. A boa notícia é que dá para corrigir em poucos dias.',
  caption: 'c', hashtags: [], cta: 'Comente **SITE** e veja como ter um site que traz cliente',
};
const only = process.argv[2];
for (const style of MOTION_STYLES.filter((s) => !only || s === only)) {
  await mkdir(`out/motion/${style}`, { recursive: true });
  console.time(style);
  console.log(style, await renderReel(post, `out/motion/${style}`, { style }));
  console.timeEnd(style);
}
