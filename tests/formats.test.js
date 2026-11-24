import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderPost } from '../src/producer/post.js';
import { renderStory } from '../src/producer/story.js';
import { storyFrames } from '../src/story.js';
import { checkPost } from '../src/safety.js';

const probe = (f) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().replace(/,$/, '');
const post = { label: 'ERRO COMUM', hook: 'Só Instagram **não basta** para o seu negócio', script: 'Quem pesquisa no Google quer ver site, endereço e um jeito rápido de chamar. Isso passa confiança antes do primeiro contato.', caption: 'c', hashtags: [], cta: 'Chame no **WhatsApp**' };

test('a single-image post is one 1080x1350 JPEG', async () => {
  const { paths } = await renderPost(post, await mkdtemp(join(tmpdir(), 'po-')));
  assert.equal(paths.length, 1);
  assert.ok(paths[0].endsWith('.jpg'));
  assert.equal(probe(paths[0]), '1080,1350');
});
test('story frames are 1080x1920 JPEGs, 3 to 5 per day', async () => {
  const { paths } = await renderStory(post, await mkdtemp(join(tmpdir(), 'st-')), { format: 'post' });
  assert.ok(paths.length >= 3 && paths.length <= 5, String(paths.length));
  assert.ok(paths.every((p) => p.endsWith('.jpg') && probe(p) === '1080,1920'));
});
test('story frames come from the post itself: hook first, CTA last, no new text invented', () => {
  const f = storyFrames(post, 'post');
  assert.equal(f[0].title, post.hook);
  assert.equal(f[f.length - 1].title, post.cta);
  const source = [post.hook, post.script, post.cta].join(' ').replace(/\*\*/g, '');
  for (const fr of f.slice(1, -1)) assert.ok(source.includes(fr.title.replace(/\*\*/g, '')), fr.title);
});
test('story frames work for carousel posts too', () => {
  const f = storyFrames({ hook: 'h', cta: 'c', script: 'Abre em menos de três segundos? | O botão aparece logo de cara no celular? | Dá para entender o que você vende sem rolar?' }, 'carousel');
  assert.ok(f.length >= 3);
});
test('safety: a post needs one short supporting line, no carousel separators', () => {
  assert.equal(checkPost(post, 'post').ok, true);
  assert.equal(checkPost({ ...post, script: 'curto' }, 'post').ok, false);
  assert.equal(checkPost({ ...post, script: 'um dois três quatro cinco | seis' }, 'post').ok, false);
  assert.equal(checkPost({ ...post, script: Array(40).fill('palavra').join(' ') }, 'post').ok, false);
});

import { cleanVisual, guessVisual, visualsFor, VISUAL_TYPES } from '../src/visuals.js';
import { reelScreens } from '../src/producer/reel.js';
import { motionScenes } from '../src/producer/motion.js';
test('visuals: invalid types and empty pieces are dropped, texts are clipped, lists are capped', () => {
  assert.equal(cleanVisual({ type: 'hacker' }), null);
  assert.equal(cleanVisual({ type: 'chat', msgs: [{ text: 'só uma' }] }), null);
  const c = cleanVisual({ type: 'checklist', items: ['a'.repeat(80), 'b', 'c', 'd', 'e', 'f'] });
  assert.equal(c.items.length, 4);
  assert.ok(c.items[0].length <= 34);
  assert.equal(cleanVisual({ type: 'steps', steps: ['um', 'dois'] }), null);
});
test('visuals: the animation follows what the sentence says', () => {
  assert.equal(guessVisual('Quem procura no Google não acha sua clínica.').type, 'search');
  assert.equal(guessVisual('Quem procura no Google não acha sua clínica.').query, 'dentista perto de mim');
  assert.equal(guessVisual('Site lento faz o cliente sair em segundos.').type, 'loading');
  assert.equal(guessVisual('O concorrente aparece primeiro.').type, 'versus');
  assert.equal(guessVisual('Responda rápido no WhatsApp.').type, 'chat');
  assert.equal(guessVisual('Teste agora: abra seu site.').type, 'checklist');
  assert.equal(guessVisual('Frase sem pista nenhuma aqui.').type, 'none');
});
test('visuals: numbers without a source are dropped, same type is never repeated back to back, one site at most', () => {
  const post = { hook: 'h', script: 'a', visuals: [{ type: 'stat', value: '99%', label: 'das pessoas' }, { type: 'site', niche: 1 }, { type: 'site', niche: 2 }] };
  const v = visualsFor(post, ['Frase um sem pista.', 'Veja o site da clínica.', 'Outro site aqui.'], new Set());
  assert.notEqual(v[0].type, 'stat');
  assert.ok(v.filter((x) => x.type === 'site').length <= 1);
  const ok = visualsFor({ ...post, visuals: [{ type: 'stat', value: '53%', label: 'saem se demora' }] }, ['Frase.'], new Set(['53%']));
  assert.equal(ok[0].type, 'stat');
  assert.ok(VISUAL_TYPES.includes('none'));
});
test('reel screens carry one visual per sentence and share it between the pieces of a long sentence', () => {
  const longSentence = 'Quem procura no Google e não acha a sua clínica logo de cara, acaba escolhendo o concorrente que aparece primeiro na lista.';
  const post = { hook: 'Gancho **forte**', script: `${longSentence} Teste agora no celular.`, cta: 'Chame no **WhatsApp**', visuals: [{ type: 'search', query: 'dentista perto de mim' }, { type: 'checklist', items: ['a', 'b', 'c'] }] };
  const screens = reelScreens(post, 'ESM');
  const s0 = screens.filter((s) => s.gid === 0);
  assert.ok(s0.length >= 2);
  assert.ok(s0.every((s) => s.vis.type === 'search'));
  assert.equal(screens.find((s) => s.gid === 1).vis.type, 'checklist');
  const scenes = motionScenes(screens, 30);
  const g = scenes.filter((x) => x.gid === 0);
  assert.equal(g[0].g0, g[0].t0);
  assert.equal(g[0].g1, g[g.length - 1].t1);
  assert.equal(g[1].vcont, true);
  assert.equal(g[0].vcont, false);
});

import { writePost } from '../src/writer.js';
import { generate } from '../src/pipeline.js';
import { mkdtemp as mkd } from 'node:fs/promises';
test('writer: numbers from the news are forbidden in the prompt and the previous rejection is fed back', async () => {
  const facts = { text: '', allowedNumbers: new Set() };
  let prompt = '';
  await writePost({ topic: 'Crédito de R$119 mil', format: 'post', facts, funnel: { enabled: false }, feedback: 'número de resultado sem fonte: R$119', llm: async (o) => { prompt = o.prompt; return { hook: 'h', script: 'um dois três quatro cinco seis', caption: 'c', hashtags: [], cta: 'Chame' }; } });
  assert.ok(prompt.includes('NÃO repita nenhum deles'));
  assert.ok(prompt.includes('foi barrada pela checagem (número de resultado sem fonte: R$119)'));
  let clean = '';
  await writePost({ topic: 't', format: 'post', facts, funnel: { enabled: false }, llm: async (o) => { clean = o.prompt; return { hook: 'h', script: 'um dois três quatro cinco seis', caption: 'c', hashtags: [], cta: 'Chame' }; } });
  assert.ok(!clean.includes('foi barrada pela checagem'));
});
