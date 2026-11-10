import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { synth, ProducerError } from '../src/producer/tts.js';

const cfg = { engine: 'gemini', model: 'gemini-3.8-flash-tts', name: 'Sulafat', edge: 'pt-BR-FranciscaNeural', style: 'natural e conversado' };
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const exists = async (f) => { try { await access(f); return true; } catch { return false; } };

async function wavBase64(secs = 1) {
  const dir = await mkdtemp(join(tmpdir(), 'wav-'));
  const f = join(dir, 'a.wav');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=300:sample_rate=24000', '-t', String(secs), '-ac', '1', '-c:a', 'pcm_s16le', f], { stdio: 'ignore' });
  return { b64: (await readFile(f)).toString('base64'), raw: await readFile(f) };
}
const okFetch = (b64, calls = []) => async (url, init) => {
  calls.push({ url, init });
  return { ok: true, status: 200, json: async () => ({ steps: [{ content: [{ type: 'audio', data: b64, mime_type: 'audio/wav' }] }] }) };
};
const edgeOk = (log) => async (text, out) => { log.push('edge'); execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '2', out], { stdio: 'ignore' }); };

test('gemini voice: sends the interactions request with voice, style and key, and writes an mp3', async () => {
  const out = join(await mkdtemp(join(tmpdir(), 'tts-')), 'voz.mp3');
  const { b64 } = await wavBase64(1);
  const calls = [];
  const r = await synth('Olá, tudo bem?', out, { fetchImpl: okFetch(b64, calls), geminiKey: 'CHAVE', cfg, edgeImpl: edgeOk([]) });
  assert.equal(r.engine, 'gemini');
  assert.match(calls[0].url, /\/v1beta\/interactions$/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'CHAVE');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, 'gemini-3.8-flash-tts');
  assert.deepEqual(body.generation_config.speech_config, [{ voice: 'Sulafat' }]);
  assert.equal(body.response_format.type, 'audio');
  assert.equal(body.input[0].content[0].text, 'Olá, tudo bem?');
  assert.equal(body.input[0].content[0].annotations[0].style, 'natural e conversado');
  assert.ok(dur(out) > 0.8 && dur(out) < 1.3);
});
test('gemini voice: raw PCM (no WAV header) is understood too', async () => {
  const out = join(await mkdtemp(join(tmpdir(), 'tts-')), 'voz.mp3');
  const { raw } = await wavBase64(1);
  const pcm = raw.subarray(44).toString('base64'); // tira o cabeçalho de 44 bytes
  const r = await synth('oi', out, { fetchImpl: okFetch(pcm), geminiKey: 'K', cfg, edgeImpl: edgeOk([]) });
  assert.equal(r.engine, 'gemini');
  assert.ok(dur(out) > 0.8 && dur(out) < 1.3);
});
test('falls back to the edge voice on 429, 5xx, 403 or a reply without audio', async () => {
  for (const reply of [{ ok: false, status: 429 }, { ok: false, status: 503 }, { ok: false, status: 403 }, { ok: true, status: 200, json: async () => ({ steps: [] }) }]) {
    const out = join(await mkdtemp(join(tmpdir(), 'tts-')), 'voz.mp3');
    const log = [];
    const r = await synth('oi', out, { fetchImpl: async () => reply, geminiKey: 'K', cfg, edgeImpl: edgeOk(log) });
    assert.equal(r.engine, 'edge');
    assert.deepEqual(log, ['edge']);
    assert.ok(await exists(out));
  }
});
test('without a Gemini key, or with the engine set to edge, only the edge voice runs', async () => {
  const out = join(await mkdtemp(join(tmpdir(), 'tts-')), 'voz.mp3');
  let fetched = false;
  const fetchImpl = async () => { fetched = true; return { ok: true, status: 200, json: async () => ({}) }; };
  assert.equal((await synth('oi', out, { fetchImpl, geminiKey: '', cfg, edgeImpl: edgeOk([]) })).engine, 'edge');
  assert.equal((await synth('oi', out, { fetchImpl, geminiKey: 'K', cfg: { ...cfg, engine: 'edge' }, edgeImpl: edgeOk([]) })).engine, 'edge');
  assert.equal(fetched, false);
});
test('both engines failing gives a ProducerError that names both', async () => {
  const out = join(await mkdtemp(join(tmpdir(), 'tts-')), 'voz.mp3');
  await assert.rejects(
    synth('oi', out, { fetchImpl: async () => ({ ok: false, status: 503 }), geminiKey: 'K', cfg, edgeImpl: async () => { throw new ProducerError('edge caiu'); } }),
    (e) => e instanceof ProducerError && /gemini/i.test(e.message) && /edge caiu/.test(e.message),
  );
});
test('the Gemini key never appears in an error message', async () => {
  const out = join(await mkdtemp(join(tmpdir(), 'tts-')), 'voz.mp3');
  await assert.rejects(
    synth('oi', out, { fetchImpl: async () => { throw new Error('falha com SEGREDO123456 na url'); }, geminiKey: 'SEGREDO123456', cfg, edgeImpl: async () => { throw new ProducerError('edge caiu'); } }),
    (e) => !e.message.includes('SEGREDO123456'),
  );
});
test('legacy call with a missing edge command still rejects with ProducerError', async () => {
  const out = join(await mkdtemp(join(tmpdir(), 'tts-')), 'x.mp3');
  await assert.rejects(synth('oi', out, { cmd: 'comando-que-nao-existe', geminiKey: '', cfg }), ProducerError);
});
test('writeFile helper sanity (temp dir is writable)', async () => {
  const f = join(await mkdtemp(join(tmpdir(), 'tts-')), 'a.txt');
  await writeFile(f, 'x');
  assert.ok(await exists(f));
});
