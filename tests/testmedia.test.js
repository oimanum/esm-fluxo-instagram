import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testMedia, formatMedia } from '../src/testmedia.js';

const files = { image: 'a.jpg', story: 's.jpg', video: 'v.mp4' };
const noSleep = async () => {};
function fakeIg({ failOn } = {}) {
  const log = [];
  return {
    userId: '178', log,
    async post(path, params) {
      log.push([path, params]);
      if (failOn && failOn(params)) throw new Error('Instagram: Media download has failed');
      return { id: `c${log.length}` };
    },
    async get() { return { status_code: 'FINISHED' }; },
  };
}
const hosting = () => { const calls = []; return { calls, stage: async (p) => { calls.push('stage'); return { tag: 't', files: p }; }, release: async () => ['u/a.jpg', 'u/s.jpg', 'u/v.mp4'], cleanup: async () => { calls.push('cleanup'); } }; };

test('media test creates a post, a story and a reel container and NEVER publishes', async () => {
  const ig = fakeIg(); const h = hosting();
  const r = await testMedia({ ig, files, ...h, sleep: noSleep });
  assert.equal(r.length, 3);
  assert.ok(r.every((x) => x.ok));
  assert.deepEqual(ig.log.map((l) => l[1].media_type ?? 'IMAGE'), ['IMAGE', 'STORIES', 'REELS']);
  assert.ok(ig.log.every((l) => l[0].endsWith('/media') && !l[0].includes('media_publish')));
  assert.deepEqual(h.calls, ['stage', 'cleanup']);
  assert.ok(formatMedia(r).includes('nada foi publicado'));
});
test('media test reports which type the Instagram rejected and still cleans up', async () => {
  const ig = fakeIg({ failOn: (p) => p.media_type === 'REELS' }); const h = hosting();
  const r = await testMedia({ ig, files, ...h, sleep: noSleep });
  assert.equal(r.filter((x) => x.ok).length, 2);
  const bad = r.find((x) => !x.ok);
  assert.ok(bad.name.includes('Reel') && bad.detail.includes('download'));
  assert.ok(h.calls.includes('cleanup'));
  assert.ok(formatMedia(r).includes('❌'));
});
test('media test: a hosting failure is reported instead of thrown', async () => {
  const r = await testMedia({ ig: fakeIg(), files, stage: async () => { throw new Error('gh falhou'); }, release: async () => [], cleanup: async () => {}, sleep: noSleep });
  assert.equal(r[0].ok, false);
  assert.ok(r[0].detail.includes('gh falhou'));
});
