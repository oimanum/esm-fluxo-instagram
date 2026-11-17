import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, poll, processSwaps } from '../src/pipeline.js';
import { loadState, saveState } from '../src/state.js';

const words = (n) => Array.from({ length: n }, (_, i) => `p${i}`).join(' ');
const GOOD = { hook: 'Seu site perde clientes', script: words(70), caption: 'cap', hashtags: ['#a'], cta: 'Chame no WhatsApp' };
const TOPICS = { topics: [{ topic: 'IA no atendimento', score: 8, angle: 'a' }, { topic: 'Site lento perde cliente', score: 7, angle: 'b' }] };

function deps(over = {}) {
  const sent = [], alerts = [], published = [], events = [];
  const d = {
    sent, alerts, published, events,
    now: new Date('2026-11-04T09:00:00Z'), // 06:00 BRT, quarta
    plan: { reel: 4, carousel: 2 },
    collect: async () => [{ source: 's', title: 'x', strength: 1 }],
    llm: async ({ prompt }) => (prompt.includes('SINAIS') ? TOPICS : GOOD),
    render: { reel: async () => ({ path: 'out/reel.mp4' }), carousel: async () => ({ paths: ['out/1.jpg'] }) },
    tg: { call: async (m) => { if (m === 'getUpdates') return d.updates || []; return { message_id: 1 }; }, upload: async (...a) => { sent.push(a); return { message_id: 1 }; } },
    stage: async (item) => ({ tag: `post-${item.id}`, files: ['reel.mp4'] }),
    release: async () => ['http://x/reel.mp4'],
    ig: {},
    publish: async (item) => { events.push('publish'); published.push(item.id); return { igMediaId: 'm1' }; },
    checkpoint: async () => { events.push('checkpoint'); },
    alert: async (t) => { alerts.push(t); },
    newId: () => 'i1',
    updates: [],
    ...over,
  };
  return d;
}
const cbq = (id, action, n = 1) => ({ update_id: n, callback_query: { id: 'q', data: `${id}:${action}` } });
const withUpdates = (d, ups) => ({ ...d, tg: { ...d.tg, call: async (m) => (m === 'getUpdates' ? ups : { message_id: 1 }) } });

beforeEach(async () => { process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'pl-')); });

test('generate creates a pending item, stages media and sends the preview', async () => {
  const d = deps();
  const r = await generate(d);
  assert.equal(r.status, 'pending');
  assert.deepEqual(r.release, { tag: 'post-i1', files: ['reel.mp4'] });
  assert.equal((await loadState('queue'))[0].status, 'pending');
  assert.equal(d.sent.length, 1);
});
test('dry generate sends a TESTE preview without buttons and cannot be approved', async () => {
  const d = deps();
  const r = await generate({ ...d, dry: true });
  assert.equal(r.status, 'dry');
  assert.ok(!JSON.stringify(d.sent).includes('approve'));
  assert.ok(JSON.stringify(d.sent).includes('TESTE'));
  await poll({ ...withUpdates(d, [cbq('i1', 'approve')]), now: new Date('2026-11-04T12:00:00Z') });
  assert.equal(d.published.length, 0);
});
test('dry poll never calls publish', async () => {
  const d = deps();
  await generate(d);
  await poll({ ...withUpdates(d, [cbq('i1', 'approve')]), dry: true, now: new Date('2026-11-04T12:00:00Z') });
  assert.equal(d.published.length, 0);
});
test('approved item is published once and recorded in history', async () => {
  const d = deps();
  await generate(d);
  const dd = withUpdates(d, [cbq('i1', 'approve')]);
  await poll({ ...dd, now: new Date('2026-11-04T12:00:00Z') });
  await poll({ ...dd, now: new Date('2026-11-04T12:10:00Z') });
  assert.equal(d.published.length, 1);
  assert.equal((await loadState('history'))[0].igMediaId, 'm1');
});
test('approve inside the 20 min grace after the deadline is still published', async () => {
  const d = deps();
  await generate(d);
  await poll({ ...withUpdates(d, [cbq('i1', 'approve')]), now: new Date('2026-11-05T00:05:00Z') }); // 21:05 BRT
  assert.equal(d.published.length, 1);
});
test('checkpoint runs before publish and item is marked publishing first', async () => {
  const d = deps();
  await generate(d);
  await poll({ ...withUpdates(d, [cbq('i1', 'approve')]), now: new Date('2026-11-04T12:00:00Z') });
  assert.ok(d.events.indexOf('checkpoint') < d.events.indexOf('publish'));
});
test('alert failure after a successful publish does not fail or republish', async () => {
  const d = deps();
  await generate(d);
  const dd = withUpdates({ ...d, alert: async () => { throw new Error('telegram fora'); } }, [cbq('i1', 'approve')]);
  await poll({ ...dd, now: new Date('2026-11-04T12:00:00Z') });
  assert.equal(d.published.length, 1);
  assert.equal((await loadState('queue'))[0].status, 'posted');
  assert.equal((await loadState('history')).length, 1);
});
test('item left in publishing is never republished and triggers an alert', async () => {
  const d = deps();
  await generate(d);
  const q = await loadState('queue');
  q[0].status = 'publishing';
  await saveState('queue', q);
  await poll({ ...withUpdates(d, [cbq('i1', 'approve')]), now: new Date('2026-11-04T12:00:00Z') });
  assert.equal(d.published.length, 0);
  assert.equal((await loadState('queue'))[0].status, 'uncertain');
  assert.ok(d.alerts.some((a) => /confira/i.test(a)));
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
  assert.equal(d.alerts.length, 1);
});
test('zero research signals skips the day without asking the llm to invent topics', async () => {
  let asked = false;
  const d = deps({ collect: async () => [], llm: async () => { asked = true; return TOPICS; } });
  const r = await generate(d);
  assert.equal(r.status, 'skipped');
  assert.equal(asked, false);
  assert.equal(d.alerts.length, 1);
});
test('unsafe post is rejected after retries and nothing is sent', async () => {
  const bad = { ...GOOD, caption: 'Resultado garantido: ganhe 10 mil por mês' };
  const d = deps({ llm: async ({ prompt }) => (prompt.includes('SINAIS') ? TOPICS : bad) });
  const r = await generate(d);
  assert.equal(r.status, 'error');
  assert.equal(d.sent.length, 0);
});
test('unapproved by 21:20 ends as sem_resposta', async () => {
  const d = deps();
  await generate(d);
  await poll({ ...d, now: new Date('2026-11-05T00:30:00Z') });
  assert.equal((await loadState('queue'))[0].status, 'sem_resposta');
  assert.equal(d.published.length, 0);
  assert.ok(d.alerts.some((a) => /sem resposta/i.test(a)));
});
test('swap is marked by poll and regenerated by processSwaps with the second topic', async () => {
  const d = deps();
  await generate(d);
  await poll({ ...withUpdates(d, [cbq('i1', 'swap')]), now: new Date('2026-11-04T12:00:00Z') });
  assert.equal((await loadState('queue'))[0].status, 'swap');
  let n = 1;
  await processSwaps({ ...d, newId: () => `i${++n}`, now: new Date('2026-11-04T12:01:00Z') });
  const q = await loadState('queue');
  assert.equal(q.find((i) => i.id === 'i1').status, 'swapped');
  assert.equal(q.find((i) => i.id === 'i2').topic, 'Site lento perde cliente');
});

test('checklist day renders with render.checklist and is staged as one image', async () => {
  const CHECK = { label: 'CHECKLIST', hook: 'Seu site abre **bem no celular?**', script: 'Abre em menos de 3 segundos? | O texto é legível sem zoom? | O botão de WhatsApp aparece logo?', caption: 'cap', hashtags: ['#a'], cta: 'Marcou menos de 3? **Fale com a ESM Web.**' };
  await saveState('history', [{ id: 'h0', topic: 'antigo', format: 'carousel', postedAt: '2026-11-03T12:00:00Z', status: 'posted' }]);
  let used = false;
  const d = deps({
    plan: { reel: 0, carousel: 2 },
    llm: async ({ prompt }) => (prompt.includes('SINAIS') ? TOPICS : prompt.includes('CHECKLIST') ? CHECK : GOOD),
    render: { reel: async () => ({ path: 'x' }), carousel: async () => ({ paths: ['c1', 'c2'] }), checklist: async () => { used = true; return { paths: ['out/check.jpg'] }; } },
  });
  const r = await generate(d);
  assert.equal(r.format, 'checklist');
  assert.equal(used, true);
  assert.deepEqual(r.media, ['out/check.jpg']);
});

test('a TEST preview (dry) is not blocked by a post already queued today, a real run is', async () => {
  const d = deps();
  await saveState('queue', [{ id: 'old', status: 'pending', createdAt: d.now.toISOString(), format: 'reel', topic: 'x' }]);
  const real = await generate(d);
  assert.equal(real.reason, 'ja_gerado_hoje');
  const test = await generate({ ...d, dry: true });
  assert.equal(test.status, 'dry');
});

test('stories are rendered with the post, previewed, staged together and published after it', async () => {
  const d = deps({
    render: { reel: async () => ({ path: 'out/reel.mp4' }), carousel: async () => ({ paths: ['c1'] }), story: async () => ({ paths: ['out/s1.jpg', 'out/s2.jpg'] }) },
  });
  let staged;
  d.stage = async (item) => { staged = item; return { tag: 't', files: ['reel.mp4', 's1.jpg', 's2.jpg'] }; };
  const r = await generate(d);
  assert.deepEqual(r.story.media, ['out/s1.jpg', 'out/s2.jpg']);
  assert.deepEqual(staged.story.media, r.story.media);
  const storyCalls = [];
  const up = withUpdates({ ...d, ig: {}, release: async () => ['u/reel.mp4', 'u/s1.jpg', 'u/s2.jpg'], publishStories: async (urls) => { storyCalls.push(urls); d.events.push('stories'); return urls.map((_, i) => `m${i}`); } }, [cbq('i1', 'approve')]);
  await poll({ ...up, now: new Date('2026-11-04T12:00:00Z') });
  assert.deepEqual(storyCalls, [['u/s1.jpg', 'u/s2.jpg']]);
  assert.deepEqual(d.published, ['i1']);
  assert.ok(d.events.indexOf('publish') < d.events.indexOf('stories'));
  assert.equal((await loadState('queue'))[0].status, 'posted');
});
test('a story failure never undoes or repeats the main post', async () => {
  const d = deps({ render: { reel: async () => ({ path: 'out/reel.mp4' }), carousel: async () => ({ paths: ['c1'] }), story: async () => ({ paths: ['out/s1.jpg'] }) } });
  await generate(d);
  const up = withUpdates({ ...d, ig: {}, release: async () => ['u/reel.mp4', 'u/s1.jpg'], publishStories: async () => { throw new Error('ig fora do ar'); } }, [cbq('i1', 'approve')]);
  await poll({ ...up, now: new Date('2026-11-04T12:00:00Z') });
  assert.equal((await loadState('queue'))[0].status, 'posted');
  assert.deepEqual(d.published, ['i1']);
  assert.ok(d.alerts.some((a) => a.includes('stories falharam')));
});
test('if the stories cannot be rendered the post still goes ahead', async () => {
  const d = deps({ render: { reel: async () => ({ path: 'out/reel.mp4' }), carousel: async () => ({ paths: ['c1'] }), story: async () => { throw new Error('chrome'); } } });
  const r = await generate(d);
  assert.equal(r.status, 'pending');
  assert.equal(r.story, undefined);
  assert.ok(d.alerts.some((a) => a.includes('stories de hoje não saíram')));
});

test('if the checks reject the chosen topic three times, the next topic of the list is tried', async () => {
  const BAD = { ...GOOD, script: `${words(69)} R$119` };
  const d = deps({ llm: async ({ prompt }) => (prompt.includes('SINAIS') ? TOPICS : prompt.includes('Tema: IA no atendimento') ? BAD : GOOD) });
  const r = await generate(d);
  assert.equal(r.status, 'pending');
  assert.equal(r.topic, 'Site lento perde cliente');
});
