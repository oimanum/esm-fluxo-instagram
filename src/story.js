import { plain, splitSegments } from './text.js';

// Os stories saem do próprio post, sem chamar a IA de novo (mais barato): chamada, dica, pergunta e fechamento.
export function storyFrames(post, format) {
  const pieces = format === 'reel' || format === 'post'
    ? splitSegments(plain(post.script || ''))
    : String(post.script || '').split('|').map((s) => s.trim()).filter(Boolean);
  const short = pieces.filter((p) => plain(p).length >= 18 && plain(p).length <= 110);
  const tip = short[0] || pieces[0];
  const ask = short.find((p) => p !== tip && /\?/.test(p)) || short.find((p) => p !== tip);
  const frames = [{ chip: 'Novo post', title: post.hook, hint: 'Veja no feed' }];
  if (tip) frames.push({ chip: 'Você sabia?', title: tip });
  if (ask) frames.push({ chip: 'Faça o teste', title: ask });
  frames.push({ chip: 'Próximo passo', title: post.cta, hint: 'Link na bio' });
  return frames;
}
