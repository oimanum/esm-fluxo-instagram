import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadState, saveState } from '../src/state.js';
import { requireEnv } from '../src/config.js';

test('saveState then loadState roundtrips', async () => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'st-'));
  await saveState('history', [{ id: 1 }]);
  assert.deepEqual(await loadState('history'), [{ id: 1 }]);
});

test('loadState returns [] when file is missing', async () => {
  process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'st-'));
  assert.deepEqual(await loadState('queue'), []);
});

test('requireEnv throws naming missing keys but not values', () => {
  process.env.AAA_SECRET = 'supersecretvalue';
  delete process.env.BBB_MISSING;
  assert.throws(
    () => requireEnv(['AAA_SECRET', 'BBB_MISSING']),
    (e) => e.message.includes('BBB_MISSING') && !e.message.includes('supersecretvalue') && !e.message.includes('AAA_SECRET'),
  );
});

import { sanitize } from '../src/config.js';
test('sanitize masks secret values found in env', () => {
  process.env.TG_TOKEN = 'abc123SECRETtoken';
  assert.equal(sanitize('falhou com abc123SECRETtoken aqui'), 'falhou com *** aqui');
});
