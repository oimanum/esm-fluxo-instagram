import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resilientFetch } from '../src/net.js';
import { listenLoop } from '../src/listen.js';
import { pollDecisions } from '../src/approval.js';
import { poll } from '../src/pipeline.js';
import { loadState, saveState } from '../src/state.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const noSleep = async () => {};

test('net: a network drop ("fetch failed") is retried and the call succeeds', async () => {
  let n = 0;
  const f = resilientFetch(async () => { if (++n < 3) throw new TypeError('fetch failed'); return { ok: true, status: 200 }; }, { sleep: noSleep });
  assert.equal((await f('https://x.test/a')).status, 200);
  assert.equal(n, 3);
});
test('net: HTTP errors are NOT retried (they come back as they are)', async () => {
  let n = 0;
  const f = resilientFetch(async () => { n++; return { ok: false, status: 503 }; }, { sleep: noSleep });
  assert.equal((await f('https://x.test/a')).status, 503);
  assert.equal(n, 1);
});
test('net: after all tries the error names the host and the cause, not just "fetch failed"', async () => {
  const f = resilientFetch(async () => { const e = new TypeError('fetch failed'); e.cause = { code: 'ENOTFOUND' }; throw e; }, { tries: 3, sleep: noSleep });
  await assert.rejects(f('https://generativelanguage.googleapis.com/v1/x'), (e) => /generativelanguage\.googleapis\.com/.test(e.message) && /ENOTFOUND/.test(e.message) && /3 tentativas/.test(e.message));
});

test('listen: stops at once when nothing is pending', async () => {
  let polled = 0;
  const r = await listenLoop({ hasPending: async () => false, pollOnce: async () => { polled++; }, sleep: noSleep });
  assert.equal(polled, 0);
  assert.equal(r.reason, 'nada_pendente');
});
test('listen: keeps reading until the item is decided, then stops', async () => {
  let pending = true; let polled = 0;
  const r = await listenLoop({ hasPending: async () => pending, pollOnce: async () => { polled++; if (polled === 3) pending = false; return { swaps: 0 }; }, sleep: noSleep });
  assert.equal(polled, 3);
  assert.equal(r.reason, 'nada_pendente');
});
test('listen: a theme swap ends the loop so the workflow can render the new theme', async () => {
  const r = await listenLoop({ hasPending: async () => true, pollOnce: async () => ({ swaps: 1 }), sleep: noSleep });
  assert.deepEqual([r.swap, r.rearm], [true, false]);
});
test('listen: near the 6 h limit it asks to be reopened', async () => {
  let t = 0;
  const r = await listenLoop({ hasPending: async () => true, pollOnce: async () => { t += 1000; return { swaps: 0 }; }, now: () => t, maxMs: 3500, sleep: noSleep });
  assert.deepEqual([r.swap, r.rearm], [false, true]);
});
test('listen: one network error is tolerated, five in a row give up', async () => {
  let n = 0;
  const ok = await listenLoop({ hasPending: async () => n < 3, pollOnce: async () => { n++; if (n === 1) throw new Error('rede'); return { swaps: 0 }; }, sleep: noSleep });
  assert.equal(ok.reason, 'nada_pendente');
  await assert.rejects(listenLoop({ hasPending: async () => true, pollOnce: async () => { throw new Error('rede caiu'); }, sleep: noSleep }), /rede caiu/);
});

const mk = (over = {}) => ({ id: 'i1', topic: 't', format: 'reel', status: 'pending', createdAt: '2026-11-04T09:00:00.000Z', post: {}, media: [], messageId: 9, ...over });
const cbu = (uid, data) => ({ update_id: uid, callback_query: { id: `q${uid}`, data } });
const fakeTg = (updates) => ({ calls: [], async call(m, p) { this.calls.push([m, p]); return m === 'getUpdates' ? updates : { message_id: 1 }; } });

test('approval: every tap gets an answer text, so the loading spinner stops', async () => {
  const tg = fakeTg([cbu(1, 'i1:approve'), cbu(2, 'i1:approve'), cbu(3, 'zzz:approve'), cbu(4, 'i2:skip')]);
  const r = await pollDecisions({ tg, queue: [mk(), mk({ id: 'i2', status: 'posted' })], now: new Date('2026-11-04T12:00:00Z'), offset: 0, timeout: 25 });
  assert.equal(tg.calls[0][1].timeout, 25);
  assert.equal(r.answers.length, 4);
  assert.match(r.answers[0].text, /Aprovado/);
  assert.match(r.answers[1].text, /Já aprovado/);
  assert.match(r.answers[2].text, /Não reconheci/);
  assert.match(r.answers[3].text, /já foi publicado/);
});

test('poll answers the taps and removes the buttons of the decided message', async () => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'rs-'));
  await saveState('queue', [mk({ createdAt: '2026-11-04T09:00:00.000Z' })]);
  const tg = fakeTg([cbu(5, 'i1:skip')]);
  await poll({ tg, now: new Date('2026-11-04T12:00:00Z'), checkpoint: async () => {}, alert: async () => {}, ig: {}, publish: async () => ({}), release: async () => [] });
  const methods = tg.calls.map((c) => c[0]);
  assert.ok(methods.includes('answerCallbackQuery'));
  assert.ok(methods.includes('editMessageReplyMarkup'));
  assert.equal((await loadState('queue'))[0].status, 'skipped');
});

test('approval: a tap on a preview the system does not know shows a pop-up and clears that message buttons', async () => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'orf-'));
  await saveState('queue', [mk()]);
  const orphan = { update_id: 7, callback_query: { id: 'q7', data: 'zzzzzzzz:approve', message: { message_id: 321 } } };
  const tg = fakeTg([orphan]);
  const r = await poll({ tg, now: new Date('2026-11-04T12:00:00Z'), checkpoint: async () => {}, alert: async () => {}, ig: {}, publish: async () => ({}), release: async () => [] });
  assert.deepEqual(r.decisions, []);
  const ans = tg.calls.find((c) => c[0] === 'answerCallbackQuery')[1];
  assert.equal(ans.show_alert, true);
  assert.match(ans.text, /não está mais ativa/);
  const edit = tg.calls.find((c) => c[0] === 'editMessageReplyMarkup')[1];
  assert.equal(edit.message_id, 321);
  assert.equal((await loadState('queue'))[0].status, 'pending');
});
