import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, poll } from '../src/pipeline.js';
import { loadState } from '../src/state.js';

const words = (n) => Array.from({ length: n }, (_, i) => `p${i}`).join(' ');
const GOOD = { hook: 'Seu site perde clientes', script: words(75), caption: 'cap', hashtags: ['#a'], cta: 'Chame no WhatsApp' };
const TOPICS = { topics: [{ topic: 'IA no atendimento', score: 8, angle: 'a' }, { topic: 'Site lento perde cliente', score: 7, angle: 'b' }] };

function deps(over = {}) {
  const sent = [], alerts = [], published = [];
  const d = {
    sent, alerts, published,
    now: new Date('2026-11-04T09:00:00Z'), // 06:00 BRT, quarta
    plan: { reel: 4, carousel: 2 },
    collect: async () => [{ source: 's', title: 'x', strength: 1 }],
    llm: async ({ prompt }) => (prompt.includes('SINAIS') ? TOPICS : GOOD),
    render: { reel: async () => ({ path: 'out/reel.mp4' }), carousel: async () => ({ paths: ['out/1.png'] }) },
    tg: { call: async (m) => { if (m === 'getUpdates') return d.updates || []; return { message_id: 1 }; }, upload: async (...a) => { sent.push(a); return { message_id: 1 }; } },
    upload: async () => ['http://x/reel.mp4'],
    ig: {},
    publish: async (item) => { published.push(item.id); return { igMediaId: 'm1' }; },
    alert: async (t) => { alerts.push(t); },
    newId: () => 'i1',
    updates: [],
    ...over,
  };
  return d;
}
const approve = (id = 'i1') => [{ update_id: 1, callback_query: { id: 'q', data: `${id}:approve` } }];

beforeEach(async () => { process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'pl-')); });

test('generate creates a pending item and sends the preview', async () => {
  const d = deps();
  const r = await generate(d);
  assert.equal(r.status, 'pending');
  assert.equal((await loadState('queue'))[0].status, 'pending');
  assert.equal(d.sent.length, 1);
});
test('dry run never calls publish', async () => {
  const d = deps();
  await generate({ ...d, dry: true });
  await poll({ ...d, dry: true, updates: approve(), tg: { ...d.tg, call: async (m) => (m === 'getUpdates' ? approve() : { message_id: 1 }) } });
  assert.equal(d.published.length, 0);
});
test('approved item is published once and recorded in history', async () => {
  const d = deps();
  await generate(d);
  const tg = { ...d.tg, call: async (m) => (m === 'getUpdates' ? approve() : { message_id: 1 }) };
  await poll({ ...d, tg, now: new Date('2026-11-04T12:00:00Z') });
  await poll({ ...d, tg, now: new Date('2026-11-04T12:10:00Z') });
  assert.equal(d.published.length, 1);
  assert.equal((await loadState('history'))[0].igMediaId, 'm1');
});
test('any step error sends Telegram alert and posts nothing', async () => {
  const d = deps({ llm: async () => { throw new Error('gemini caiu'); } });
  const r = await generate(d);
  assert.equal(r.status, 'error');
  assert.ok(d.alerts.some((a) => a.includes('gemini caiu')));
  assert.equal(d.published.length, 0);
  assert.deepEqual(await loadState('queue'), []);
});
test('no qualifying topic skips day with alert', async () => {
  const d = deps({ llm: async ({ prompt }) => (prompt.includes('SINAIS') ? { topics: [{ topic: 'fraco', score: 3, angle: '' }] } : GOOD) });
  const r = await generate(d);
  assert.equal(r.status, 'skipped');
  assert.ok(d.alerts.length === 1);
});
test('unsafe post is rejected after retries and nothing is sent', async () => {
  const bad = { ...GOOD, caption: 'Resultado garantido: ganhe 10 mil por mês' };
  const d = deps({ llm: async ({ prompt }) => (prompt.includes('SINAIS') ? TOPICS : bad) });
  const r = await generate(d);
  assert.equal(r.status, 'error');
  assert.equal(d.sent.length, 0);
});
test('unapproved by 11:00 ends as sem_resposta', async () => {
  const d = deps();
  await generate(d);
  await poll({ ...d, now: new Date('2026-11-04T15:00:00Z') });
  assert.equal((await loadState('queue'))[0].status, 'sem_resposta');
  assert.equal(d.published.length, 0);
  assert.ok(d.alerts.some((a) => /sem resposta/i.test(a)));
});
test('swap regenerates with the second topic', async () => {
  const d = deps();
  await generate(d);
  const tg = { ...d.tg, call: async (m) => (m === 'getUpdates' ? [{ update_id: 1, callback_query: { id: 'q', data: 'i1:swap' } }] : { message_id: 1 }) };
  let n = 0;
  await poll({ ...d, tg, newId: () => `i${++n + 1}`, now: new Date('2026-11-04T12:00:00Z') });
  const q = await loadState('queue');
  assert.equal(q.find((i) => i.id === 'i1').status, 'swapped');
  assert.equal(q.find((i) => i.id !== 'i1').topic, 'Site lento perde cliente');
});
