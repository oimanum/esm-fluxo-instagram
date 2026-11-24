import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cleanSlide, slidesFor, slideTexts, slideTitle } from '../src/slides.js';
import { renderCarousel } from '../src/producer/carousel.js';
import { renderChecklist } from '../src/producer/checklist.js';
import { renderSlides } from '../src/producer/slides.js';
import { loadBrand } from '../src/producer/ff.js';
import { writePost } from '../src/writer.js';
import { checkPost } from '../src/safety.js';
import { storyFrames } from '../src/story.js';

const probe = (f) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().replace(/,$/, '');
const S = [
  { kind: 'statement', kicker: 'Começa por aqui', title: 'O cliente **pesquisa** antes de chamar.', body: 'Só Instagram **não responde** a essa busca.' },
  { kind: 'numbered', n: 1, title: 'O que o cliente procura', body: 'Endereço e **WhatsApp**.', card: { label: 'O que o site resolve', text: 'Tudo em uma página.' } },
  { kind: 'list', title: 'No seu site', tag: 'O essencial', items: [{ name: 'Google', desc: 'Aparece na busca.' }, { name: 'WhatsApp', desc: 'Botão direto.' }, { name: 'Confiança', desc: 'Passa segurança.' }] },
  { kind: 'versus', title: 'Como pedir um site', bad: { label: 'ruim', text: 'Quero um site bonito.' }, good: { label: 'bom', text: 'Quero que o cliente chame no WhatsApp.' }, tip: { label: 'O que fazemos', text: 'Desenhamos para gerar contato.' }, why: 'Diz o objetivo.' },
];
const post = { label: 'ERRO COMUM', hook: 'Só Instagram **não basta**', sub: 'O cliente confere no Google.', script: 'a | b | c', caption: 'c', hashtags: [], cta: 'Comente **SITE** e receba o caminho', slides: S, bridge: { title: 'É aqui que um **site sob medida** entra', text: 'Uma página própria responde a essa busca por você, o dia todo.' } };

test('slides: invalid kinds and incomplete slides are dropped, texts clipped, lists capped', () => {
  assert.equal(cleanSlide({ kind: 'hack' }), null);
  assert.equal(cleanSlide({ kind: 'list', title: 'x', items: [{ name: 'a' }] }), null);
  assert.equal(cleanSlide({ kind: 'versus', title: 't', bad: { text: 'a' } }), null);
  const l = cleanSlide({ kind: 'list', title: 'No site', items: Array.from({ length: 8 }, (_, i) => ({ name: `Item ${i}`.repeat(6), desc: 'd'.repeat(200) })) });
  assert.equal(l.items.length, 5);
  assert.ok(l.items[0].name.length <= 24 && l.items[0].desc.length <= 70);
  assert.equal(cleanSlide({ kind: 'versus', title: 't', bad: { text: 'a' }, good: { text: 'b' } }).bad.label, 'RUIM');
});
test('slides: without suggestions they come from the script, alternating statement and numbered', () => {
  const d = slidesFor({ script: 'Um | Dois | Três | Quatro' });
  assert.equal(d.length, 4);
  assert.deepEqual(d.map((x) => x.kind), ['statement', 'numbered', 'statement', 'numbered']);
  assert.equal(slidesFor(post).length, 4);
  assert.ok(slideTexts(S[3]).includes('Quero um site bonito.'));
  assert.equal(slideTitle(S[2]), 'No seu site');
});
test('carousel with chosen slide kinds renders cover + slides + the bridge + CTA as 1080x1350 JPEGs', async () => {
  const { paths } = await renderCarousel(post, await mkdtemp(join(tmpdir(), 'cv-')));
  assert.equal(paths.length, 7);
  assert.ok(paths.every((p) => p.endsWith('.jpg') && probe(p) === '1080,1350'));
});
test('story frames are rendered in the same style at 1080x1920', async () => {
  const brand = await loadBrand();
  const paths = await renderSlides(storyFrames(post, 'carousel'), brand, await mkdtemp(join(tmpdir(), 'sf-')), { w: 1080, h: 1920, story: true, prefix: 'story' });
  assert.ok(paths.length >= 3);
  assert.ok(paths.every((p) => probe(p) === '1080,1920'));
});
test('a slide too long to fit is shrunk, and impossible content fails instead of being cut', async () => {
  const brand = await loadBrand();
  const dir = await mkdtemp(join(tmpdir(), 'fit-'));
  const long = { kind: 'list', title: 'No seu site', items: Array.from({ length: 5 }, () => ({ name: 'Nome comprido do item', desc: 'Descrição que usa as duas linhas de texto do slide inteiro aqui mesmo.' })) };
  assert.equal((await renderSlides([long], brand, dir)).length, 1);
  const checklist = await renderChecklist({ label: 'X', hook: 'Seu site abre bem no celular e converte visita em paciente de verdade?', script: Array(5).fill('O botão de WhatsApp aparece logo de cara no celular, sem rolar a página?').join(' | '), cta: 'Marcou menos de 4? **Fale com a ESM Web.**' }, dir);
  assert.equal(probe(checklist.paths[0]), '1080,1350');
});
test('writer: a carousel keeps the cleaned slides and builds the script from their titles when missing', async () => {
  const facts = { text: '', allowedNumbers: new Set() };
  const out = await writePost({ topic: 't', format: 'carousel', facts, funnel: { enabled: false }, llm: async ({ prompt }) => { assert.ok(prompt.includes('SLIDES (só no Carrossel)')); return { hook: 'h', caption: 'c', hashtags: [], cta: 'Chame', sub: 's', slides: [...S, { kind: 'hack' }] }; } });
  assert.equal(out.slides.length, 4);
  assert.equal(out.script.split('|').length, 4);
  const reel = await writePost({ topic: 't', format: 'reel', facts, funnel: { enabled: false }, llm: async ({ prompt }) => { assert.ok(!prompt.includes('SLIDES (só no Carrossel)')); return { hook: 'h', script: 'Frase um. Frase dois.', caption: 'c', hashtags: [], cta: 'Chame' }; } });
  assert.equal(reel.slides, undefined);
});
test('safety: texts inside the slides are checked too (blocked claims, numbers without a source)', () => {
  const ok = { hook: 'Só Instagram **não basta**', script: 'a | b | c', caption: 'c', hashtags: [], cta: 'Chame no **WhatsApp**', slides: S, bridge: { title: 'Aqui entra um site sob medida', text: 'Ele responde por você.' } };
  assert.equal(checkPost(ok, 'carousel').ok, true);
  const bad = { ...ok, slides: [{ kind: 'big', value: '87%', label: 'dos clientes escolhem quem tem site' }, ...S] };
  assert.equal(checkPost(bad, 'carousel').ok, false);
  const claim = { ...ok, slides: [{ kind: 'statement', title: 'Resultado garantido em 30 dias', body: '' }, ...S] };
  assert.equal(checkPost(claim, 'carousel').ok, false);
});

import { cleanBridge } from '../src/slides.js';
import { hasBridge } from '../src/bridge.js';
test('bridge: cleaned, clipped, dropped when incomplete; stories get a "Como resolver" frame before the CTA', () => {
  assert.equal(cleanBridge({ title: 'só título' }), null);
  assert.equal(cleanBridge(null), null);
  const b = cleanBridge({ title: 'x'.repeat(200), text: 'y'.repeat(400) });
  assert.ok(b.title.length <= 70 && b.text.length <= 180);
  const f = storyFrames(post, 'carousel');
  const i = f.findIndex((x) => x.kicker === 'Como resolver');
  assert.ok(i > 0 && i === f.length - 2, JSON.stringify(f.map((x) => x.kicker)));
  assert.match(f[i].title, /site sob medida/);
  assert.equal(f[f.length - 1].kind, 'cta');
  assert.equal(hasBridge({ script: 'x' }, 'reel'), false);
});
