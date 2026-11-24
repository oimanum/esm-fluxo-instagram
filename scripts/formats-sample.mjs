// Gera exemplos de carrossel, post de imagem única, checklist e stories em out/formats.
import { mkdir } from 'node:fs/promises';
import { renderCarousel } from '../src/producer/carousel.js';
import { renderPost } from '../src/producer/post.js';
import { renderChecklist } from '../src/producer/checklist.js';
import { renderStory } from '../src/producer/story.js';

const post = {
  label: 'ERRO COMUM', hook: 'Só Instagram **não basta** para o seu negócio', sub: 'O cliente confere no Google antes de chamar.',
  script: 'Quem pesquisa quer ver site, endereço e um jeito rápido de chamar. | Sem site, o concorrente aparece primeiro. | Teste você mesmo pelo celular.',
  caption: 'c', hashtags: [], cta: 'Comente **SITE** e receba o caminho no Direct',
  bridge: { title: 'É aqui que um **site sob medida** entra', text: 'Uma página própria responde a essa busca por você, a qualquer hora, e leva a pessoa direto para o seu WhatsApp.' },
  slides: [
    { kind: 'statement', kicker: 'Começa por aqui', title: 'O cliente **pesquisa** antes de chamar. Quem não aparece, **perde**.', body: 'Antes de ligar, quase todo mundo confere o Google. **Só Instagram** não responde a essa busca.' },
    { kind: 'numbered', n: 1, title: 'O que o cliente procura', body: 'Endereço, horário e um jeito rápido de **chamar no WhatsApp**.', card: { label: 'O que o site resolve', text: 'Tudo isso em uma página, **24 horas por dia**.' } },
    { kind: 'list', title: 'No seu site', tag: 'O ESSENCIAL', items: [{ name: 'Google', desc: 'Aparece quando pesquisam seu serviço.' }, { name: 'WhatsApp', desc: 'Botão direto para chamar.' }, { name: 'Confiança', desc: 'Passa segurança antes do contato.' }, { name: 'Celular', desc: 'Abre rápido e cabe na tela.' }] },
    { kind: 'versus', title: 'Como pedir um site', bad: { label: 'RUIM', text: 'Quero um site bonito.' }, good: { label: 'BOM', text: 'Quero que o cliente chame no WhatsApp.' }, tip: { label: 'O que fazemos', text: 'Desenhamos a página para gerar contato.' }, why: 'Diz o objetivo e o que o site precisa fazer.' },
  ],
};
await mkdir('out/formats', { recursive: true });
console.log((await renderCarousel(post, 'out/formats')).paths.length, 'slides');
console.log(await renderPost(post, 'out/formats'));
console.log(await renderChecklist({ ...post, script: 'Abre em menos de 3 segundos? | O texto é legível sem zoom? | O botão de WhatsApp aparece logo? | Dá para entender o que você vende sem rolar?', cta: 'Marcou menos de 3? **Fale com a ESM Web.**' }, 'out/formats'));
console.log((await renderStory(post, 'out/formats', { format: 'carousel' })).paths.length, 'stories');
