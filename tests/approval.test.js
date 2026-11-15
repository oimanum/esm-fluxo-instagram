import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendPreview, pollDecisions, expireOverdue } from '../src/approval.js';

const mkItem = (over = {}) => ({
  id: 'i1', topic: 't', format: 'reel', status: 'pending',
  createdAt: '2026-11-04T09:00:00.000Z', // 06:00 BRT
  post: { hook: 'h', caption: 'cap', hashtags: ['#a'], cta: 'c' }, media: ['out/reel.mp4'], ...over,
});
const cb = (id, data, uid = 1) => ({ update_id: id, callback_query: { id: `q${id}`, data, from: { id: uid } } });
const fakeTg = (updates) => ({ calls: [], async call(m, p) { this.calls.push([m, p]); return m === 'getUpdates' ? updates : { message_id: 77 }; }, async upload(m, p) { this.calls.push([m, p]); return { message_id: 77 }; } });
const before = new Date('2026-11-04T12:00:00.000Z'); // 09:00 BRT
const after = new Date('2026-11-05T00:30:00.000Z');  // 21:30 BRT (prazo 21:00 + 20 min)

test('sendPreview sends media with approve/swap/skip buttons', async () => {
  const tg = fakeTg([]);
  const r = await sendPreview(mkItem(), tg);
  assert.equal(r.messageId, 77);
  const text = JSON.stringify(tg.calls);
  assert.ok(text.includes('i1:approve') && text.includes('i1:swap') && text.includes('i1:skip'));
});
test('duplicate approve is applied once', async () => {
  const tg = fakeTg([cb(1, 'i1:approve'), cb(2, 'i1:approve')]);
  const r = await pollDecisions({ tg, queue: [mkItem()], now: before, offset: 0 });
  assert.equal(r.decisions.length, 1);
  assert.equal(r.queue[0].status, 'approved');
  assert.equal(r.nextOffset, 3);
});
test('approve after the deadline is expired', async () => {
  const tg = fakeTg([cb(1, 'i1:approve')]);
  const r = await pollDecisions({ tg, queue: [mkItem()], now: after, offset: 0 });
  assert.equal(r.queue[0].status, 'expired');
  assert.equal(r.decisions.filter((d) => d.action === 'approve').length, 0);
});
test('swap requests second topic', async () => {
  const r = await pollDecisions({ tg: fakeTg([cb(1, 'i1:swap')]), queue: [mkItem()], now: before, offset: 0 });
  assert.equal(r.queue[0].status, 'swap');
});
test('skip marks item skipped', async () => {
  const r = await pollDecisions({ tg: fakeTg([cb(1, 'i1:skip')]), queue: [mkItem()], now: before, offset: 0 });
  assert.equal(r.queue[0].status, 'skipped');
});
test('approve on already-published item is ignored', async () => {
  const r = await pollDecisions({ tg: fakeTg([cb(1, 'i1:approve')]), queue: [mkItem({ status: 'posted' })], now: before, offset: 0 });
  assert.equal(r.queue[0].status, 'posted');
});
test('expireOverdue marks pending items past the deadline as sem_resposta', () => {
  assert.equal(expireOverdue([mkItem()], after)[0].status, 'sem_resposta');
  assert.equal(expireOverdue([mkItem()], before)[0].status, 'pending');
});

test('approve at 21:05 is inside the 20 min grace', async () => {
  const r = await pollDecisions({ tg: fakeTg([cb(1, 'i1:approve')]), queue: [mkItem()], now: new Date('2026-11-05T00:05:00.000Z'), offset: 0 });
  assert.equal(r.queue[0].status, 'approved');
});
test('dry preview has no buttons and says TESTE', async () => {
  const tg = fakeTg([]);
  await sendPreview(mkItem({ status: 'dry' }), tg);
  const text = JSON.stringify(tg.calls);
  assert.ok(!text.includes('approve'));
  assert.ok(text.includes('TESTE'));
});
test('preview caption keeps the tail and never silently truncates the legend', async () => {
  const tg = fakeTg([]);
  const long = 'x'.repeat(1500);
  await sendPreview(mkItem({ post: { hook: 'h', caption: long, hashtags: ['#a'], cta: 'c' } }), tg);
  assert.ok(JSON.stringify(tg.calls).includes('#a'));
});

test('a single-image post is previewed with sendPhoto, not sendMediaGroup', async () => {
  const tg = fakeTg([]);
  await sendPreview(mkItem({ format: 'checklist', media: ['out/check.jpg'] }), tg);
  const text = JSON.stringify(tg.calls);
  assert.ok(text.includes('sendPhoto'));
  assert.ok(!text.includes('sendMediaGroup'));
});

test('the preview also shows the stories that go with the post', async () => {
  const tg = fakeTg([]);
  await sendPreview(mkItem({ format: 'carousel', media: ['a.jpg', 'b.jpg'], story: { media: ['s1.jpg', 's2.jpg', 's3.jpg'] } }), tg);
  const text = JSON.stringify(tg.calls);
  assert.ok(text.includes('Stories que saem junto'));
  assert.equal(tg.calls.filter((c) => c[0] === 'sendMediaGroup').length, 2);
});
