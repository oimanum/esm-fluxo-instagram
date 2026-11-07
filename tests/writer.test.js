import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writePost } from '../src/writer.js';

const post = { hook: 'Gancho', script: 'roteiro', caption: 'c', hashtags: ['#a'], cta: 'Chame' };
test('writePost returns structured post from llm', async () => {
  const llm = async ({ schema }) => { assert.ok(schema(post)); return post; };
  assert.deepEqual(await writePost({ topic: 't', format: 'reel', llm }), post);
});
test('writePost schema rejects missing hook', async () => {
  let schema;
  await writePost({ topic: 't', format: 'reel', llm: async (o) => { schema = o.schema; return post; } });
  assert.equal(schema({ ...post, hook: '' }), false);
});
