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
  // semana de 11-02 (seg) a 11-08: só 2 reels nesta semana, mas o último post foi reel -> alterna para carrossel
  assert.equal(pickToday({ scored, history: full, now, plan }).format, 'carousel');
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

test('static slots alternate carousel and checklist', () => {
  const afterCarousel = [{ topic: 'a', format: 'carousel', postedAt: day('11-02'), status: 'posted' }];
  assert.equal(pickToday({ scored, history: afterCarousel, now, plan: { reel: 0, carousel: 2 } }).format, 'checklist');
  const afterChecklist = [{ topic: 'a', format: 'checklist', postedAt: day('11-02'), status: 'posted' }];
  assert.equal(pickToday({ scored, history: afterChecklist, now, plan: { reel: 0, carousel: 2 } }).format, 'carousel');
  assert.equal(pickToday({ scored, history: [], now, plan: { reel: 0, carousel: 2 } }).format, 'carousel');
});
test('checklist counts toward the carousel quota', () => {
  const h = ['11-02', '11-03'].map((d) => ({ topic: d, format: 'checklist', postedAt: day(d), status: 'posted' }));
  assert.equal(pickToday({ scored, history: h, now, plan: { reel: 0, carousel: 2 } }).skip, 'cota_semanal');
});

test('the weekly mix follows the plan: 2 reels, 4 carousels, 1 single post, never the same format twice in a row', () => {
  const plan7 = { reel: 2, carousel: 4, post: 1 };
  const history = [];
  const seq = [];
  for (let d = 2; d <= 8; d++) {
    const dayStr = `11-${String(d).padStart(2, '0')}`;
    const r = pickToday({ scored, history, now: new Date(`2026-${dayStr}T09:00:00-03:00`), plan: plan7 });
    assert.ok(r.format, `dia ${dayStr}: ${r.skip}`);
    seq.push(r.format);
    history.push({ topic: `t${d}`, format: r.format, postedAt: day(dayStr), status: 'posted' });
  }
  const kinds = seq.map((f) => (f === 'checklist' ? 'carousel' : f));
  assert.equal(kinds.filter((k) => k === 'reel').length, 2);
  assert.equal(kinds.filter((k) => k === 'carousel').length, 4);
  assert.equal(kinds.filter((k) => k === 'post').length, 1);
  for (let i = 1; i < kinds.length - 1; i++) assert.notEqual(kinds[i], kinds[i - 1], seq.join(','));
});
test('a plan without the post key still works (old saved plans)', () => {
  assert.ok(pickToday({ scored, history: [], now, plan: { reel: 1, carousel: 1 } }).format);
});
