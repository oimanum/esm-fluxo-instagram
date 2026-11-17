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
test('a persistent 503 (overloaded) moves on to the next model', async () => {
  delete process.env.GEMINI_MODEL;
  const f = byModel({ 'gemini-3.6-flash': { status: 503 }, 'gemini-3.8-flash': { status: 200, text: '{"a":9}' } });
  const sleeps = [];
  assert.deepEqual(await askJson({ prompt: 'x', schema: ok, fetchImpl: f, sleep: async (ms) => { sleeps.push(ms); } }), { a: 9 });
  assert.deepEqual([...new Set(f.seen)], ['gemini-3.6-flash', 'gemini-3.8-flash']);
  assert.ok(sleeps.length >= 2 && sleeps[1] > sleeps[0], 'espera cresce entre as tentativas');
  assert.ok(sleeps[0] >= 2000, 'primeira espera de pelo menos 2 s');
});
test('every model overloaded -> clear LlmError (code overloaded) naming the models', async () => {
  delete process.env.GEMINI_MODEL;
  const f = byModel({ 'gemini-3.6-flash': { status: 503 }, 'gemini-3.8-flash': { status: 503 }, 'gemini-3.5-flash-lite': { status: 500 }, 'gemini-3.1-flash-lite': { status: 503 } });
  await assert.rejects(askJson({ prompt: 'x', schema: ok, fetchImpl: f, sleep: async () => {} }), (e) => e instanceof LlmError && e.code === 'overloaded' && e.message.includes('503') && e.message.includes('gemini-3.8-flash'));
});
test('a 429 (quota) on one model moves on to the next model, which has its own quota', async () => {
  delete process.env.GEMINI_MODEL;
  const f = byModel({ 'gemini-3.6-flash': { status: 429 }, 'gemini-3.8-flash': { status: 200, text: '{"a":9}' } });
  assert.deepEqual(await askJson({ prompt: 'x', schema: ok, fetchImpl: f, sleep: async () => {} }), { a: 9 });
  assert.deepEqual([...new Set(f.seen)], ['gemini-3.6-flash', 'gemini-3.8-flash']);
});
test('every model out of quota -> rate_limit error that says so', async () => {
  delete process.env.GEMINI_MODEL;
  const all = byModel({ 'gemini-3.6-flash': { status: 429 }, 'gemini-3.8-flash': { status: 429 }, 'gemini-3.5-flash-lite': { status: 429 }, 'gemini-3.1-flash-lite': { status: 429 } });
  await assert.rejects(askJson({ prompt: 'x', schema: ok, fetchImpl: all, sleep: async () => {} }), (e) => e.code === 'rate_limit' && /todos os modelos/.test(e.message));
});

test('429 per minute waits the time Google asks and tries again', async () => {
  const waits = [];
  const limited = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'quota per minute', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '27s' }] } }) });
  const f = seq(limited, reply('{"a":3}'));
  assert.deepEqual(await askJson({ prompt: 'x', schema: ok, fetchImpl: f, sleep: async (ms) => { waits.push(ms); } }), { a: 3 });
  assert.deepEqual(waits, [28000]);
});
test('429 with no short retry time (daily quota) stops and says why', async () => {
  const daily = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'Quota exceeded for metric generate_content_free_tier_requests, limit: 250 per day' } }) });
  await assert.rejects(askJson({ prompt: 'x', schema: ok, fetchImpl: daily, sleep: async () => {} }), (e) => e instanceof LlmError && e.code === 'rate_limit' && /per day/.test(e.message));
});
