import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPost } from '../src/safety.js';

const words = (n) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(' ');
const good = { hook: 'Seu site está perdendo clientes', script: words(75), caption: 'Veja como melhorar seu site.', hashtags: ['#site'], cta: 'Chame no WhatsApp' };

test('accepts a clean post', () => assert.equal(checkPost(good, 'reel').ok, true));
test('rejects guaranteed-income claim', () => {
  const r = checkPost({ ...good, caption: 'Resultado garantido: ganhe 10 mil por mês' }, 'reel');
  assert.equal(r.ok, false);
});
test('rejects medical cure claim', () => {
  assert.equal(checkPost({ ...good, script: `${words(70)} cura definitiva` }, 'reel').ok, false);
});
test('rejects script outside 20–35s', () => {
  assert.equal(checkPost({ ...good, script: words(20) }, 'reel').ok, false);
  assert.equal(checkPost({ ...good, script: words(140) }, 'reel').ok, false);
});
test('rejects two CTAs', () => {
  assert.equal(checkPost({ ...good, cta: 'Chame no WhatsApp. Clique no link da bio' }, 'reel').ok, false);
});
test('rejects hook over 12 words', () => {
  assert.equal(checkPost({ ...good, hook: words(13) }, 'reel').ok, false);
});
