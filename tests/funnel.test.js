import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchKeyword, renderDm, runFunnel } from '../src/funnel.js';

const cfg = { enabled: true, keyword: 'SITE', link: 'https://exemplo.com', maxPerRun: 20, publicReply: 'Te enviei no Direct!', ownUsername: 'esm_web', dm: 'Oi! Veja: {link}' };
const now = new Date('2026-11-08T12:00:00Z');
const history = [{ igMediaId: 'm1', status: 'posted', postedAt: '2026-11-07T12:00:00Z' }];
const c = (id, text, over = {}) => ({ id: String(id), text, username: 'cliente' + id, timestamp: '2026-11-08T11:30:00+0000', ...over });

function fakeIg(comments, { failOn = [] } = {}) {
  const calls = [];
  return {
    calls, userId: 'IG1',
    async get(path) { calls.push(['get', path]); return { data: comments }; },
    async post(path, body) {
      calls.push(['post', path, body]);
      if (failOn.some((id) => JSON.stringify(body).includes(id))) throw new Error('Instagram: blocked');
      return { id: 'x' };
    },
  };
}
const dms = (ig) => ig.calls.filter((k) => k[0] === 'post' && k[1].endsWith('/messages'));

test('matchKeyword: whole word, case and accent insensitive', () => {
  for (const t of ['SITE', 'site', 'Site!', 'quero um site', '  SITE  ', 'Sítio? não: site']) assert.equal(matchKeyword(t, 'SITE'), true, t);
  for (const t of ['sitemap', 'website', 'prosite', 'quero', '']) assert.equal(matchKeyword(t, 'SITE'), false, t);
});
test('renderDm fills the link', () => assert.equal(renderDm('Oi {link}', 'https://x.com'), 'Oi https://x.com'));

test('sends one private reply per matching comment and records it', async () => {
  const ig = fakeIg([c(1, 'SITE'), c(2, 'lindo post'), c(3, 'quero um site')]);
  const r = await runFunnel({ ig, history, handled: [], now, cfg });
  assert.equal(dms(ig).length, 2);
  assert.deepEqual(dms(ig)[0][2].recipient, { comment_id: '1' });
  assert.equal(dms(ig)[0][2].message.text, 'Oi! Veja: https://exemplo.com');
  assert.deepEqual(r.handled.map((h) => [h.commentId, h.status]), [['1', 'sent'], ['3', 'sent']]);
});
test('never answers the same comment twice', async () => {
  const ig = fakeIg([c(1, 'SITE')]);
  const first = await runFunnel({ ig, history, handled: [], now, cfg });
  const second = await runFunnel({ ig, history, handled: first.handled, now, cfg });
  assert.equal(dms(ig).length, 1);
  assert.equal(second.handled.length, 1);
});
test('does nothing when the funnel is disabled', async () => {
  const ig = fakeIg([c(1, 'SITE')]);
  const r = await runFunnel({ ig, history, handled: [], now, cfg: { ...cfg, enabled: false } });
  assert.equal(ig.calls.length, 0);
  assert.deepEqual(r.handled, []);
});
test('ignores own comments and comments older than 7 days', async () => {
  const ig = fakeIg([c(1, 'SITE', { username: 'esm_web' }), c(2, 'SITE', { timestamp: '2026-10-30T12:00:00+0000' })]);
  await runFunnel({ ig, history, handled: [], now, cfg });
  assert.equal(dms(ig).length, 0);
});
test('a failure on one comment does not stop the others and is reported', async () => {
  const ig = fakeIg([c(1, 'SITE'), c(2, 'SITE')], { failOn: ['"1"'] });
  const r = await runFunnel({ ig, history, handled: [], now, cfg });
  assert.equal(r.handled.find((h) => h.commentId === '2').status, 'sent');
  assert.equal(r.handled.find((h) => h.commentId === '1').status, 'failed');
  assert.equal(r.errors.length, 1);
});
test('a failed comment is retried at most 3 times in total', async () => {
  const ig = fakeIg([c(1, 'SITE')], { failOn: ['"1"'] });
  let handled = [];
  for (let i = 0; i < 5; i++) handled = (await runFunnel({ ig, history, handled, now, cfg })).handled;
  assert.equal(dms(ig).length, 3);
});
test('respects maxPerRun', async () => {
  const ig = fakeIg(Array.from({ length: 10 }, (_, i) => c(i + 1, 'SITE')));
  await runFunnel({ ig, history, handled: [], now, cfg: { ...cfg, maxPerRun: 3 } });
  assert.equal(dms(ig).length, 3);
});
test('posts older than 7 days are not even scanned', async () => {
  const ig = fakeIg([c(1, 'SITE')]);
  await runFunnel({ ig, history: [{ igMediaId: 'old', status: 'posted', postedAt: '2026-10-20T12:00:00Z' }], handled: [], now, cfg });
  assert.equal(ig.calls.length, 0);
});
