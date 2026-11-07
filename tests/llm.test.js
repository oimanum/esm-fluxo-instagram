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
