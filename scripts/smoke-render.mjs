// Teste de fumaça sem chaves: voz real + ffmpeg + fonte, para validar o ambiente (local ou GitHub Actions).
import { mkdir } from 'node:fs/promises';
import { renderReel } from '../src/producer/reel.js';
import { renderCarousel } from '../src/producer/carousel.js';

const post = {
  label: 'TESTE RÁPIDO · 30 SEGUNDOS',
  hook: 'Seu site **perde paciente** todo dia sem você perceber.',
  script: 'Todo dia alguém procura uma clínica como a sua no Google. Entra no seu site, espera quatro segundos e vai embora. Site lento não é detalhe técnico, é paciente que agenda no concorrente. Teste agora: abra seu site no celular com dados móveis. Se demorou mais de três segundos, você está pagando para perder cliente. A boa notícia é que dá para corrigir em poucos dias.',
  caption: 'c', hashtags: [], cta: 'Chame no **WhatsApp** e peça uma análise grátis',
};
await mkdir('out/smoke', { recursive: true });
const reel = await renderReel(post, 'out/smoke');
console.log('reel', reel);
const car = await renderCarousel({ ...post, script: 'Abre em **menos de 3 segundos**? | O texto é **legível** sem dar zoom? | O botão de WhatsApp **aparece logo** de cara? | Dá para entender o que você vende **sem rolar**?' }, 'out/smoke');
console.log('carrossel', car.paths.length, 'slides');
