import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { plain, parseEmphasis, splitSegments } from '../src/text.js';
import { renderReel } from '../src/producer/reel.js';
import { renderCarousel } from '../src/producer/carousel.js';
import { checkPost } from '../src/safety.js';

const probe = (f, e) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', e, '-of', 'csv=p=0', f]).toString().trim();
const fakeTts = (secs, spy) => async (text, out) => {
  spy?.push(text);
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(secs), '-q:a', '9', out], { stdio: 'ignore' });
};
const words = (n) => Array.from({ length: n }, (_, i) => `p${i}`).join(' ');
const post = { hook: 'Seu site **perde paciente** todo dia', label: 'TESTE RÁPIDO', script: 'Primeira frase curta. Segunda frase um pouco maior que a anterior, com vírgula. ' + words(50) + '.', caption: 'c', hashtags: [], cta: 'Chame no **WhatsApp**' };

test('plain removes ** markers', () => assert.equal(plain('a **b** c'), 'a b c'));
test('parseEmphasis marks strong parts and keeps light parts', () => {
  assert.deepEqual(parseEmphasis('a **b** c'), [{ text: 'a ', strong: false }, { text: 'b', strong: true }, { text: ' c', strong: false }]);
  assert.deepEqual(parseEmphasis('sem marcação'), [{ text: 'sem marcação', strong: true }]);
});
test('splitSegments cuts by sentence and splits long ones', () => {
  const segs = splitSegments('Frase um. Frase dois bem comprida, com vírgula no meio e mais palavras para passar do limite de caracteres permitido por tela, entende?');
  assert.ok(segs.length >= 3);
  assert.ok(segs.every((s) => s.length <= 110));
});
test('safety counts words without ** markers', () => {
  assert.equal(checkPost({ ...post, hook: 'a **b** c', cta: 'x **y**', script: words(60) }, 'reel').ok, true);
});
test('tts never receives ** markers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tts-'));
  const spy = [];
  await renderReel(post, dir, { ttsImpl: fakeTts(25, spy) });
  assert.ok(spy[0].length > 50);
  assert.ok(!spy[0].includes('*'));
});
test('reel keeps 1080x1920, 30 fps and audio', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reel-'));
  const { path, durationSec } = await renderReel(post, dir, { ttsImpl: fakeTts(25) });
  assert.equal(probe(path, 'stream=width,height'), '1080,1920');
  assert.ok(durationSec >= 20 && durationSec <= 35);
  assert.ok(probe(path, 'stream=codec_name').includes('aac'));
});
test('carousel slides are 1080x1350 JPEG with counter slides 5-8', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'car-'));
  const { paths } = await renderCarousel({ ...post, script: 'Um **destaque** aqui | Dois | Três **forte** aqui | Quatro' }, dir);
  assert.ok(paths.length >= 5 && paths.length <= 8);
  assert.ok(paths.every((p) => p.endsWith('.jpg')));
  assert.equal(probe(paths[0], 'stream=width,height'), '1080,1350');
});
test('markup and percent signs never break rendering', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'car-'));
  const { paths } = await renderCarousel({ ...post, hook: 'Aumente **30%** das <vendas> & "lucro"', script: 'a | b | c' }, dir);
  assert.equal(paths.length, 5);
});

test('splitSegments always terminates: punctuation far from the middle, or no spaces at all', () => {
  const longTail = Array.from({ length: 40 }, (_, i) => `palavra${i}`).join(' ') + ' fim: ok';
  const a = splitSegments(longTail);
  assert.ok(a.length >= 2 && a.every((s) => s.length <= 110));
  const b = splitSegments('x'.repeat(300));
  assert.deepEqual(b, ['x'.repeat(300)]);
});

import { renderChecklist } from '../src/producer/checklist.js';
test('checklist is one 1080x1350 JPEG, even with 5 long items and a 3-line title', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chk-'));
  const long = 'O botão de WhatsApp aparece logo de cara no celular, sem rolar a página?';
  const { paths } = await renderChecklist({ ...post, hook: 'Seu site abre bem **no celular** e converte visita em paciente de verdade?', script: [long, long, long, long, long].join(' | '), cta: 'Marcou menos de 4? **Fale com a ESM Web.**' }, dir);
  assert.equal(paths.length, 1);
  assert.ok(paths[0].endsWith('.jpg'));
  assert.equal(probe(paths[0], 'stream=width,height'), '1080,1350');
});
