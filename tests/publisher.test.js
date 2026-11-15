import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publish } from '../src/publisher.js';
import { refreshToken, tokenDaysLeft } from '../src/token.js';

const item = (over = {}) => ({ id: 'i1', format: 'reel', status: 'approved', post: { caption: 'cap', hashtags: ['#a'] }, ...over });
const noSleep = async () => {};

function fakeIg({ statuses = ['FINISHED'], failPublish = 0 } = {}) {
  const log = [];
  let polls = 0, pubFails = 0;
  return {
    log,
    async post(path, params) {
      log.push(['post', path, params]);
      if (path.endsWith('/media_publish')) {
        if (pubFails++ < failPublish) throw new Error('graph 500');
        return { id: 'media-1' };
      }
      return { id: `c${log.length}` };
    },
    async get(path) {
      log.push(['get', path]);
      return { status_code: statuses[Math.min(polls++, statuses.length - 1)] };
    },
  };
}

test('refuses to publish unapproved item', async () => {
  const ig = fakeIg();
  await assert.rejects(publish(item({ status: 'pending' }), ['http://x/v.mp4'], ig, { sleep: noSleep }), /aprovad/i);
  assert.equal(ig.log.length, 0);
});
test('waits for FINISHED before media_publish', async () => {
  const ig = fakeIg({ statuses: ['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'] });
  const r = await publish(item(), ['http://x/v.mp4'], ig, { sleep: noSleep });
  assert.equal(r.igMediaId, 'media-1');
  const kinds = ig.log.map((l) => l[1].split('/').pop());
  assert.ok(kinds.lastIndexOf('media_publish') > kinds.lastIndexOf(kinds.filter((k) => k !== 'media_publish' && k !== 'media').pop()));
  assert.equal(ig.log.filter((l) => l[0] === 'get').length, 3);
});
test('retries 3 times then throws', async () => {
  const ig = fakeIg({ failPublish: 5 });
  await assert.rejects(publish(item(), ['http://x/v.mp4'], ig, { sleep: noSleep }), /graph 500/);
  assert.equal(ig.log.filter((l) => l[1].endsWith('/media_publish')).length, 3);
});
test('retry succeeds on second attempt', async () => {
  const ig = fakeIg({ failPublish: 1 });
  assert.equal((await publish(item(), ['http://x/v.mp4'], ig, { sleep: noSleep })).igMediaId, 'media-1');
});
test('ERROR status throws without publishing', async () => {
  const ig = fakeIg({ statuses: ['ERROR'] });
  await assert.rejects(publish(item(), ['http://x/v.mp4'], ig, { sleep: noSleep }), /ERROR/);
  assert.equal(ig.log.filter((l) => l[1].endsWith('/media_publish')).length, 0);
});
test('carousel creates children then parent', async () => {
  const ig = fakeIg();
  await publish(item({ format: 'carousel' }), ['http://x/1.png', 'http://x/2.png'], ig, { sleep: noSleep });
  const media = ig.log.filter((l) => l[0] === 'post' && l[1].endsWith('/media'));
  assert.equal(media.length, 3);
  assert.equal(media[2][2].media_type, 'CAROUSEL');
});
test('tokenDaysLeft < 7 flags alert', () => {
  const now = new Date('2026-11-04T00:00:00Z');
  assert.equal(tokenDaysLeft('2026-11-10T00:00:00Z', now), 6);
  assert.equal(tokenDaysLeft('2026-12-10T00:00:00Z', now), 36);
});
test('refreshToken returns new token and expiry', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ access_token: 'NEW', expires_in: 5184000 }) });
  const r = await refreshToken('OLD', { fetchImpl, now: new Date('2026-11-04T00:00:00Z') });
  assert.equal(r.token, 'NEW');
  assert.equal(r.expiresAt, '2027-01-03T00:00:00.000Z');
});
import { stageMedia, publishRelease } from '../src/media-host.js';
test('stageMedia uploads to a DRAFT release and returns tag and file names', async () => {
  const calls = [];
  const r = await stageMedia(['out/i1/reel.mp4'], { repo: 'o/r', tag: 'post-i1', gh: async (a) => { calls.push(a); return ''; } });
  assert.deepEqual(r, { tag: 'post-i1', files: ['reel.mp4'] });
  assert.ok(calls.some((a) => a.includes('--draft')));
});
test('publishRelease flips the draft public and returns urls', async () => {
  const calls = [];
  const urls = await publishRelease({ tag: 'post-i1', files: ['reel.mp4'] }, { repo: 'o/r', gh: async (a) => { calls.push(a); return ''; } });
  assert.deepEqual(urls, ['https://github.com/o/r/releases/download/post-i1/reel.mp4']);
  assert.ok(calls.some((a) => a.includes('--draft=false')));
});

test('checklist publishes one plain image, no carousel container', async () => {
  const ig = fakeIg();
  await publish(item({ format: 'checklist' }), ['http://x/c.jpg'], ig, { sleep: noSleep });
  const media = ig.log.filter((l) => l[0] === 'post' && l[1].endsWith('/media'));
  assert.equal(media.length, 1);
  assert.equal(media[0][2].image_url, 'http://x/c.jpg');
  assert.equal(media[0][2].media_type, undefined);
  assert.equal(media[0][2].is_carousel_item, undefined);
  assert.equal(ig.log.filter((l) => l[1].endsWith('/media_publish')).length, 1);
});

import { publishStories } from '../src/publisher.js';
test('single-image post publishes like a plain image', async () => {
  const ig = fakeIg();
  await publish(item({ format: 'post' }), ['http://x/p.jpg'], ig, { sleep: noSleep });
  const media = ig.log.filter((l) => l[0] === 'post' && l[1].endsWith('/media'));
  assert.equal(media.length, 1);
  assert.equal(media[0][2].media_type, undefined);
});
test('stories are published one by one as STORIES media', async () => {
  const ig = fakeIg();
  const ids = await publishStories(['http://x/s1.jpg', 'http://x/s2.jpg', 'http://x/s3.jpg'], ig, { sleep: noSleep });
  assert.equal(ids.length, 3);
  const media = ig.log.filter((l) => l[0] === 'post' && l[1].endsWith('/media'));
  assert.equal(media.length, 3);
  assert.ok(media.every((m) => m[2].media_type === 'STORIES' && m[2].image_url.endsWith('.jpg')));
  assert.equal(ig.log.filter((l) => l[1].endsWith('/media_publish')).length, 3);
});
