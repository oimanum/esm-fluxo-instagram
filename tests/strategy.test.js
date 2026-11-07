import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickToday, scoreTopics } from '../src/strategy.js';

const now = new Date('2026-11-04T09:00:00-03:00'); // quarta
const plan = { reel: 4, carousel: 2 };
const scored = [
  { topic: 'IA no atendimento', score: 8, angle: 'a' },
  { topic: 'Site lento perde cliente', score: 7, angle: 'b' },
  { topic: 'Tema fraco', score: 5, angle: 'c' },
];
const day = (d) => new Date(`2026-${d}T12:00:00-03:00`).toISOString();

test('drops topics below 6', () => {
  const r = pickToday({ scored: [scored[2]], history: [], now, plan });
  assert.equal(r.skip, 'sem_tema');
});
test('drops topic used within 30 days', () => {
  const history = [{ topic: 'IA no atendimento', format: 'reel', postedAt: day('10-20'), status: 'posted' }];
  assert.equal(pickToday({ scored, history, now, plan }).topic, 'Site lento perde cliente');
});
test('allows topic older than 30 days', () => {
  const history = [{ topic: 'IA no atendimento', format: 'reel', postedAt: day('09-01'), status: 'posted' }];
  assert.equal(pickToday({ scored, history, now, plan }).topic, 'IA no atendimento');
});
test('returns skip sem_tema when none qualify', () => {
  assert.equal(pickToday({ scored: [], history: [], now, plan }).skip, 'sem_tema');
});
test('never schedules two posts in one day', () => {
  const history = [{ topic: 'x', format: 'reel', postedAt: day('11-04'), status: 'posted' }];
  assert.equal(pickToday({ scored, history, now, plan }).skip, 'ja_postou_hoje');
});
test('weekly plan caps reels at 4', () => {
  const h = ['11-02', '11-03'].map((d) => ({ topic: d, format: 'reel', postedAt: day(d), status: 'posted' }));
  const full = [...h, ...['10-30', '10-29'].map((d) => ({ topic: d, format: 'reel', postedAt: day(d), status: 'posted' }))];
  // semana de 11-02 (seg) a 11-08: só 2 reels nesta semana -> ainda cabe reel
  assert.equal(pickToday({ scored, history: full, now, plan }).format, 'reel');
  const wk = ['11-02', '11-03', '11-01', '11-04'].slice(0, 2);
  const capped = [
    { topic: 'a', format: 'reel', postedAt: day('11-02'), status: 'posted' },
    { topic: 'b', format: 'reel', postedAt: day('11-03'), status: 'posted' },
  ];
  const p4 = { reel: 2, carousel: 2 };
  assert.equal(pickToday({ scored, history: capped, now, plan: p4 }).format, 'carousel');
});
test('scoreTopics sorts by score desc using llm', async () => {
  const llm = async () => ({ topics: [{ topic: 'a', score: 3, angle: '' }, { topic: 'b', score: 9, angle: '' }] });
  const r = await scoreTopics([{ title: 'x', source: 's', strength: 1 }], llm);
  assert.equal(r[0].topic, 'b');
});
