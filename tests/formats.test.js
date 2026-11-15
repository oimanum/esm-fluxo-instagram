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
test('story frames are 1080x1920 JPEGs, 3 to 4 per day', async () => {
  const { paths } = await renderStory(post, await mkdtemp(join(tmpdir(), 'st-')), { format: 'post' });
  assert.ok(paths.length >= 3 && paths.length <= 4, String(paths.length));
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
