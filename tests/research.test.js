import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectSignals } from '../src/research/index.js';
import { parseRss } from '../src/research/rss.js';
import { fromReddit } from '../src/research/reddit.js';
import { fromCompetitors } from '../src/research/competitors.js';

const RSS = `<rss><channel><title>feed</title>
<item><title><![CDATA[IA no atendimento de clínicas]]></title><link>http://a/1</link></item>
<item><title>Google Meu Negócio muda regra</title><link>http://a/2</link></item></channel></rss>`;

test('parseRss maps items to Signal', () => {
  const s = parseRss(RSS, 'news');
  assert.equal(s.length, 2);
  assert.deepEqual(Object.keys(s[0]).sort(), ['source', 'strength', 'title', 'url']);
  assert.equal(s[0].title, 'IA no atendimento de clínicas');
  assert.ok(s[0].strength > 0 && s[0].strength <= 1);
});
test('reddit maps listing to Signal', () => {
  const s = fromReddit({ data: { children: [{ data: { title: 'T', permalink: '/r/x', ups: 500 } }] } });
  assert.equal(s[0].source, 'reddit'); assert.equal(s[0].title, 'T');
});
test('competitors map to Signal by relative engagement', () => {
  const s = fromCompetitors({ business_discovery: { username: 'c', media: { data: [
    { caption: 'a', like_count: 100, comments_count: 10, permalink: 'p1' },
    { caption: 'b', like_count: 10, comments_count: 0, permalink: 'p2' }] } } });
  assert.equal(s[0].strength, 1); assert.ok(s[1].strength < s[0].strength);
});
test('one failing source does not fail collectSignals', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('reddit')) throw new Error('boom');
    return { ok: true, text: async () => RSS, json: async () => ({}) };
  };
  const out = await collectSignals({ fetchImpl, competitors: [] });
  assert.ok(out.length >= 2);
});
