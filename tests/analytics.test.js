import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectInsights, adjustPlan, weeklyReport } from '../src/analytics.js';

const m = (format, over = {}) => ({ igMediaId: format + Math.random(), format, postedAt: '2026-11-02T12:00:00Z', hour: 12, reach: 100, saves: 5, shares: 3, profileVisits: 10, linkClicks: 2, ...over });

test('adjustPlan never changes a format by more than 1', () => {
  const metrics = [m('carousel', { profileVisits: 500, linkClicks: 40 }), m('reel', { profileVisits: 1, linkClicks: 0 })];
  const p = adjustPlan({ reel: 4, carousel: 2 }, metrics);
  assert.ok(Math.abs(p.reel - 4) <= 1 && Math.abs(p.carousel - 2) <= 1);
});
test('adjustPlan keeps total ≤ 7 per week', () => {
  const p = adjustPlan({ reel: 4, carousel: 3 }, [m('reel', { profileVisits: 999 }), m('carousel', { profileVisits: 1 })]);
  assert.ok(p.reel + p.carousel <= 7);
});
test('adjustPlan keeps plan when there is too little data', () => {
  assert.deepEqual(adjustPlan({ reel: 4, carousel: 2 }, [m('reel')]), { reel: 4, carousel: 2 });
});
test('adjustPlan shifts toward the better format', () => {
  const metrics = [m('reel', { profileVisits: 5, linkClicks: 0 }), m('reel', { profileVisits: 5, linkClicks: 0 }), m('carousel', { profileVisits: 80, linkClicks: 9 }), m('carousel', { profileVisits: 90, linkClicks: 8 })];
  const p = adjustPlan({ reel: 4, carousel: 2 }, metrics);
  assert.equal(p.carousel, 3); assert.equal(p.reel, 3);
});
test('weeklyReport ranks by profile visits and link clicks', () => {
  const r = weeklyReport([m('reel', { profileVisits: 10, linkClicks: 1, topic: 'baixo' }), m('carousel', { profileVisits: 90, linkClicks: 9, topic: 'alto' })]);
  assert.ok(r.indexOf('alto') < r.indexOf('baixo'));
});
test('collectInsights reads only posts older than 24h', async () => {
  const ig = { get: async () => ({ data: [{ name: 'reach', values: [{ value: 50 }] }, { name: 'saved', values: [{ value: 4 }] }, { name: 'shares', values: [{ value: 2 }] }, { name: 'profile_visits', values: [{ value: 9 }] }] }) };
  const history = [
    { igMediaId: 'a', topic: 't', format: 'reel', postedAt: '2026-11-01T12:00:00Z', status: 'posted' },
    { igMediaId: 'b', topic: 't2', format: 'reel', postedAt: '2026-11-04T08:00:00Z', status: 'posted' },
  ];
  const out = await collectInsights(history, ig, new Date('2026-11-04T12:00:00Z'));
  assert.equal(out.length, 1);
  assert.equal(out[0].reach, 50);
  assert.equal(out[0].profileVisits, 9);
});

test('collectInsights skips a media whose insights call fails and reports it', async () => {
  const ig = { get: async (p) => { if (p.includes('bad')) throw new Error('#100 metric'); return { data: [{ name: 'reach', values: [{ value: 7 }] }] }; } };
  const history = [
    { igMediaId: 'bad', topic: 't', format: 'reel', postedAt: '2026-11-01T12:00:00Z', status: 'posted' },
    { igMediaId: 'ok', topic: 't2', format: 'reel', postedAt: '2026-11-01T12:00:00Z', status: 'posted' },
  ];
  const errors = [];
  const out = await collectInsights(history, ig, new Date('2026-11-04T12:00:00Z'), errors);
  assert.equal(out.length, 1);
  assert.equal(errors.length, 1);
});
test('collectInsights asks reels for metrics without profile_visits', async () => {
  const asked = [];
  const ig = { get: async (p, params) => { asked.push(params.metric); return { data: [] }; } };
  await collectInsights([{ igMediaId: 'r', topic: 't', format: 'reel', postedAt: '2026-11-01T12:00:00Z', status: 'posted' }], ig, new Date('2026-11-04T12:00:00Z'));
  assert.ok(!asked[0].includes('profile_visits'));
});
