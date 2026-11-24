import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPost } from '../src/safety.js';

const words = (n) => Array.from({ length: n }, (_, i) => (i === n - 1 ? 'site' : `palavra${i}`)).join(' ');
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
  const bridge = { title: 'É aqui que um site sob medida entra', text: 'Uma página própria responde a essa busca por você.' };
  const c = (s) => checkPost({ ...good, script: s, bridge }, 'carousel').ok;
  assert.equal(c('um dois três quatro cinco seis sete oito'), false);
  assert.equal(c('a b | c d'), false);
  assert.equal(c('a b | c d | e f'), true);
  assert.equal(c('a | b | c | d | e | f | g'), false);
});

test('checklist needs 3 to 5 short items separated by |', () => {
  const c = (script, hook = 'Seu site abre bem no celular?') => checkPost({ ...good, hook, script, cta: 'Marcou pouco? Um site sob medida resolve.' }, 'checklist').ok;
  assert.equal(c('Abre em menos de 3 segundos? | O texto é legível? | O botão aparece logo?'), true);
  assert.equal(c('Abre rápido? | Texto legível?'), false);
  assert.equal(c('a | b | c | d | e | f'), false);
  assert.equal(c(`um | dois | ${'x'.repeat(71)}`), false);
});

test('rejects result numbers (percent, R$) that are not in the facts', () => {
  const p = { ...good, hook: 'Landing page que converteu 35% mais vendas' };
  assert.equal(checkPost(p, 'reel').ok, false);
  assert.equal(checkPost(p, 'reel', { allowedNumbers: new Set(['35%']) }).ok, true);
  assert.equal(checkPost({ ...good, caption: 'Faturou R$ 5.000 por mês' }, 'reel').ok, false);
});
test('plain numbers without percent or money are fine', () => {
  assert.equal(checkPost({ ...good, hook: 'Seu site abre em 3 segundos?' }, 'reel').ok, true);
});
test('rejects technical hooks that sell the tool instead of the result', () => {
  assert.equal(checkPost({ ...good, hook: 'Crio sites em React e HTML' }, 'reel').ok, false);
  assert.equal(checkPost({ ...good, hook: 'Seu site novo traz mais pacientes' }, 'reel').ok, true);
});

test('technical-hook rule matches whole words only', () => {
  assert.equal(checkPost({ ...good, hook: 'Sua reação ao ver o site ao vivo' }, 'reel').ok, true);
  assert.equal(checkPost({ ...good, hook: 'Chega de código lento no seu site' }, 'reel').ok, false);
});

test('with the funnel on, the CTA must invite the keyword', () => {
  assert.equal(checkPost({ ...good, cta: 'Comente SITE e receba' }, 'reel', { keyword: 'SITE' }).ok, true);
  assert.equal(checkPost({ ...good, cta: 'Comente **SITE** agora' }, 'reel', { keyword: 'SITE' }).ok, true);
  assert.equal(checkPost({ ...good, cta: 'Chame no WhatsApp' }, 'reel', { keyword: 'SITE' }).ok, false);
  assert.equal(checkPost({ ...good, cta: 'Chame no WhatsApp' }, 'reel').ok, true);
});
test('no fake track record: social proof is blocked unless there are real cases', () => {
  for (const caption of ['Nossos clientes aprovam', 'Mais de 50 empresas atendidas', 'Já ajudamos dezenas de clínicas', 'Veja os depoimentos', 'Resultados comprovados', 'Temos 10 anos de experiência']) {
    assert.equal(checkPost({ ...good, caption }, 'reel').ok, false, caption);
    assert.equal(checkPost({ ...good, caption }, 'reel', { socialProof: true }).ok, true, caption);
  }
  assert.equal(checkPost({ ...good, caption: 'Seu site novo traz mais pacientes' }, 'reel').ok, true);
});

test('the closing bridge to a site or custom system is mandatory in every format', () => {
  const noBridge = { ...good, script: Array.from({ length: 75 }, (_, i) => `palavra${i}`).join(' ') };
  assert.equal(checkPost(noBridge, 'reel').ok, false);
  assert.match(checkPost(noBridge, 'reel').problems.join(' '), /falta a ponte/);
  // reel: a ponte está nas 2 últimas frases do roteiro
  const reelOk = { ...good, script: `${Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(' ')}. Esse é o gargalo. Um sistema de agendamento online resolve isso sem você atender.` };
  assert.equal(checkPost(reelOk, 'reel').ok, true);
  const earlySite = { ...good, script: `Seu site é o problema. ${Array.from({ length: 70 }, (_, i) => `palavra${i}`).join(' ')}. Fim.` };
  assert.equal(checkPost(earlySite, 'reel').ok, false); // menção solta no começo não conta como ponte
  // carrossel: campo bridge
  assert.equal(checkPost({ ...good, script: 'a | b | c' }, 'carousel').ok, false);
  assert.equal(checkPost({ ...good, script: 'a | b | c', bridge: { title: 'Aqui entra um painel sob medida', text: 'Ele organiza tudo.' } }, 'carousel').ok, true);
  // post de imagem única: a frase de apoio é a ponte
  assert.equal(checkPost({ ...good, script: 'Um site próprio responde a essa busca por você, todo dia.' }, 'post').ok, true);
  assert.equal(checkPost({ ...good, script: 'Uma frase de apoio sem a ponte para a solução aqui.' }, 'post').ok, false);
});
