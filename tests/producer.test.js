import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderReel } from '../src/producer/reel.js';
import { renderCarousel } from '../src/producer/carousel.js';
import { synth, ProducerError } from '../src/producer/tts.js';

const probe = (f, entries) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', entries, '-of', 'csv=p=0', f]).toString().trim();
const fakeTts = (secs) => async (_text, out) => {
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(secs), '-q:a', '9', out], { stdio: 'ignore' });
};
const post = { hook: 'Seu site perde clientes', script: Array.from({ length: 70 }, (_, i) => `palavra${i}`).join(' '), caption: 'c', hashtags: [], cta: 'Chame no WhatsApp' };

test('reel is 1080x1920 and 20–35 s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reel-'));
  const { path, durationSec } = await renderReel(post, dir, { ttsImpl: fakeTts(25) });
  assert.equal(probe(path, 'stream=width,height'), '1080,1920');
  assert.ok(durationSec >= 20 && durationSec <= 35);
});
test('reel rejects audio outside 20–35 s', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reel-'));
  await assert.rejects(renderReel(post, dir, { ttsImpl: fakeTts(8) }), ProducerError);
});
test('carousel has 5–8 pngs at 1080x1350', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'car-'));
  const { paths } = await renderCarousel({ ...post, script: 'a b c | d e f | g h i | j k l | m n o' }, dir);
  assert.ok(paths.length >= 5 && paths.length <= 8);
  assert.equal(probe(paths[0], 'stream=width,height'), '1080,1350');
});
test('tts failure throws ProducerError', async () => {
  await assert.rejects(synth('oi', join(tmpdir(), 'x.mp3'), { cmd: 'comando-que-nao-existe' }), ProducerError);
});
