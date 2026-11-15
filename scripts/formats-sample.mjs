// Gera um post de imagem única e os stories de exemplo em out/formats.
import { mkdir } from 'node:fs/promises';
import { renderPost } from '../src/producer/post.js';
import { renderStory } from '../src/producer/story.js';
const post = { label: 'ERRO COMUM', hook: 'Só Instagram **não basta** para o seu negócio', script: 'Quem pesquisa no Google quer ver site, endereço e um jeito rápido de chamar. Isso passa confiança antes do primeiro contato.', caption: 'c', hashtags: [], cta: 'Comente **SITE** e receba o caminho no Direct' };
await mkdir('out/formats', { recursive: true });
console.log(await renderPost(post, 'out/formats'), await renderStory(post, 'out/formats', { format: 'post' }));
