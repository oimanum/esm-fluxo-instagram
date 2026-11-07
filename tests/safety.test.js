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

test('rejects narration (hook+script+cta) over 88 words', () => {
  assert.equal(checkPost({ ...good, script: words(88) }, 'reel').ok, false);
});
test('accepts narration at the edges 55 and 88 words', () => {
  assert.equal(checkPost({ ...good, hook: 'a b c', cta: 'x y', script: words(50) }, 'reel').ok, true);
  assert.equal(checkPost({ ...good, hook: 'a b c', cta: 'x y', script: words(83) }, 'reel').ok, true);
});
test('carousel needs 3 to 6 slides separated by |', () => {
  const c = (s) => checkPost({ ...good, script: s }, 'carousel').ok;
  assert.equal(c('um dois três quatro cinco seis sete oito'), false);
  assert.equal(c('a b | c d'), false);
  assert.equal(c('a b | c d | e f'), true);
  assert.equal(c('a | b | c | d | e | f | g'), false);
});

test('checklist needs 3 to 5 short items separated by |', () => {
  const c = (script, hook = 'Seu site abre bem no celular?') => checkPost({ ...good, hook, script }, 'checklist').ok;
  assert.equal(c('Abre em menos de 3 segundos? | O texto é legível? | O botão aparece logo?'), true);
  assert.equal(c('Abre rápido? | Texto legível?'), false);
  assert.equal(c('a | b | c | d | e | f'), false);
  assert.equal(c(`um | dois | ${'x'.repeat(71)}`), false);
});
