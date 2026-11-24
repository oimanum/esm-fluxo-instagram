import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadFacts } from '../src/facts.js';
import { writePost } from '../src/writer.js';

test('loadFacts collects the numbers the user vouched for', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'facts-'));
  const file = join(dir, 'facts.json');
  await writeFile(file, JSON.stringify({ cases: [{ text: 'Landing page do cliente X: 35% mais pedidos em 60 dias' }], stats: [{ text: 'Sites lentos perdem visitas', source: 'Google', numbers: ['53%'] }] }));
  const f = await loadFacts(file);
  assert.ok(f.allowedNumbers.has('35%'));
  assert.ok(f.allowedNumbers.has('53%'));
  assert.ok(f.text.includes('Landing page do cliente X'));
});
test('loadFacts with a missing file means no facts, not a crash', async () => {
  const f = await loadFacts(join(tmpdir(), 'nao-existe-facts.json'));
  assert.equal(f.allowedNumbers.size, 0);
  assert.ok(f.text.includes('nenhum'));
});
test('writer prompt demands benefit hooks and only cites provided facts', async () => {
  let prompt = '';
  const llm = async (o) => { prompt = o.prompt; return { hook: 'h', script: 's', caption: 'c', hashtags: [], cta: 'x' }; };
  await writePost({ topic: 't', format: 'reel', llm, facts: { text: 'FATO UNICO 35%', allowedNumbers: new Set(['35%']) } });
  assert.ok(prompt.includes('FATOS'));
  assert.ok(prompt.includes('FATO UNICO 35%'));
  assert.ok(/benef[ií]cio/i.test(prompt));
  assert.ok(/React/.test(prompt));
});

test('writer prompt asks for label and **emphasis** markup (the design depends on them)', async () => {
  let prompt = '';
  await writePost({ topic: 't', format: 'reel', llm: async (o) => { prompt = o.prompt; return {}; }, facts: { text: 'x', allowedNumbers: new Set() } });
  assert.ok(prompt.includes('"label"'));
  assert.ok(prompt.includes('**'));
});

test('writer prompt is value-first (useful, savable, specific), keeps the honest-proof rule and no longer forces "you need a site"', async () => {
  let prompt = '';
  await writePost({ topic: 't', format: 'reel', llm: async (o) => { prompt = o.prompt; return {}; }, facts: { text: 'x', allowedNumbers: new Set(), data: {} }, funnel: { enabled: true, keyword: 'SITE' } });
  assert.ok(/SALVAR e MANDAR/.test(prompt));
  assert.ok(/GANCHO VIRAL/.test(prompt));
  assert.ok(/NÃO transforme o post inteiro em "você precisa de um site"/.test(prompt));
  assert.ok(!/PRECISA de um site/.test(prompt));
  assert.ok(/nunca.*(clientes|depoimentos|experi)/i.test(prompt));
  assert.ok(prompt.includes('Comente **SITE**'));
  await writePost({ topic: 't', format: 'reel', llm: async (o) => { prompt = o.prompt; return {}; }, facts: { text: 'x', allowedNumbers: new Set(), data: {} }, funnel: { enabled: false, keyword: 'SITE' } });
  assert.ok(!prompt.includes('Comente **SITE**'));
});
test('writer prompt carries the pillar, the audience and the hooks already published', async () => {
  let prompt = '';
  await writePost({ topic: 't', format: 'carousel', pillar: 'regras', niche: 'advocacia', recentHooks: ['Gancho antigo um', 'Gancho antigo dois'], llm: async (o) => { prompt = o.prompt; return {}; }, facts: { text: 'x', allowedNumbers: new Set(), data: {} }, funnel: { enabled: false } });
  assert.ok(prompt.includes('PILAR: O que pode e o que não pode'));
  assert.ok(prompt.includes('Nunca dê parecer jurídico'));
  assert.ok(prompt.includes('PÚBLICO: advocacia'));
  assert.ok(prompt.includes('- Gancho antigo um') && prompt.includes('JÁ PUBLICADOS'));
});
