import { test } from 'node:test';
import assert from 'node:assert/strict';
import { askJson, LlmError } from '../src/llm.js';

process.env.GEMINI_KEY = 'k';
const reply = (text, status = 200) => async () => ({
  ok: status === 200, status,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
});
const seq = (...fns) => { let i = 0; return (...a) => fns[Math.min(i++, fns.length - 1)](...a); };
const ok = (o) => !!o && typeof o.a === 'number';

test('returns parsed object when valid', async () => {
  assert.deepEqual(await askJson({ prompt: 'x', schema: ok, fetchImpl: reply('{"a":1}') }), { a: 1 });
});
test('retries on invalid JSON then succeeds', async () => {
  const f = seq(reply('not json'), reply('{"a":2}'));
  assert.deepEqual(await askJson({ prompt: 'x', schema: ok, fetchImpl: f }), { a: 2 });
});
test('throws LlmError after retries exhausted', async () => {
  await assert.rejects(askJson({ prompt: 'x', schema: ok, fetchImpl: reply('{"b":1}'), retries: 2 }), LlmError);
});
test('429 throws LlmError with code rate_limit', async () => {
  await assert.rejects(askJson({ prompt: 'x', schema: ok, fetchImpl: reply('', 429) }), (e) => e instanceof LlmError && e.code === 'rate_limit');
});

// --- modelo desligado (404) -> tenta o próximo modelo gratuito ---
const modelOf = (url) => String(url).match(/models\/([^:]+):/)[1];
function byModel(map) {
  const seen = [];
  const fn = async (url) => {
    const m = modelOf(url);
    seen.push(m);
    const r = map[m] ?? { status: 404 };
    return { ok: r.status === 200, status: r.status, json: async () => ({ candidates: [{ content: { parts: [{ text: r.text || '{}' }] } }] }) };
  };
  fn.seen = seen;
  return fn;
}

test('default model is not the retired gemini-2.0-flash', async () => {
  delete process.env.GEMINI_MODEL;
  const f = byModel({ 'gemini-3.6-flash': { status: 200, text: '{"a":1}' } });
  await askJson({ prompt: 'x', schema: ok, fetchImpl: f });
  assert.equal(f.seen[0], 'gemini-3.6-flash');
});
test('404 on a retired model falls through to the next free model', async () => {
  delete process.env.GEMINI_MODEL;
  const f = byModel({ 'gemini-3.5-flash-lite': { status: 200, text: '{"a":7}' } });
  assert.deepEqual(await askJson({ prompt: 'x', schema: ok, fetchImpl: f }), { a: 7 });
  assert.deepEqual(f.seen.slice(0, 3), ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
});
test('GEMINI_MODEL is tried first', async () => {
  process.env.GEMINI_MODEL = 'meu-modelo';
  const f = byModel({ 'meu-modelo': { status: 200, text: '{"a":1}' } });
  await askJson({ prompt: 'x', schema: ok, fetchImpl: f });
  assert.equal(f.seen[0], 'meu-modelo');
  delete process.env.GEMINI_MODEL;
});
test('every model 404 -> model_not_found listing what was tried', async () => {
  delete process.env.GEMINI_MODEL;
  await assert.rejects(askJson({ prompt: 'x', schema: ok, fetchImpl: byModel({}) }), (e) => e instanceof LlmError && e.code === 'model_not_found' && e.message.includes('gemini-3.6-flash'));
});
test('a 500 does not skip to another model (only 404 does)', async () => {
  delete process.env.GEMINI_MODEL;
  const f = byModel({ 'gemini-3.6-flash': { status: 500 } });
  await assert.rejects(askJson({ prompt: 'x', schema: ok, fetchImpl: f, retries: 0 }), (e) => e.code === 'http');
  assert.deepEqual([...new Set(f.seen)], ['gemini-3.6-flash']);
});
