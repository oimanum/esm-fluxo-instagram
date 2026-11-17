import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderReel } from '../src/producer/reel.js';
import { MOTION_STYLES, pickStyle, motionSfx, motionScenes } from '../src/producer/motion.js';

const probe = (f, e) => execFileSync('ffprobe', ['-v', 'error', ...(e === 'stream=width,height' ? ['-select_streams', 'v:0'] : []), '-show_entries', e, '-of', 'csv=p=0', f]).toString().trim().replace(/,$/, '');
const fakeTts = (secs) => async (_t, out) => {
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=200:sample_rate=24000', '-t', String(secs), '-q:a', '9', out], { stdio: 'ignore' });
};
const words = (n) => Array.from({ length: n }, (_, i) => `palavra${i}`).join(' ');
const post = { hook: 'Seu site **perde paciente** todo dia', label: 'TESTE', script: 'Primeira frase curta. Segunda frase um pouco maior, com vírgula. ' + words(50) + '.', caption: 'c', hashtags: [], cta: 'Comente **SITE** agora' };

test('every motion style renders a 1080x1920 reel with audio', async () => {
  for (const style of MOTION_STYLES) {
    const dir = await mkdtemp(join(tmpdir(), `mo-${style}-`));
    const { path, durationSec } = await renderReel(post, dir, { ttsImpl: fakeTts(25), style, fps: 3 });
    assert.equal(probe(path, 'stream=width,height'), '1080,1920', style);
    assert.ok(durationSec >= 20 && durationSec <= 35, `${style} ${durationSec}`);
    assert.ok(probe(path, 'stream=codec_name').includes('aac'), style);
  }
});
test('the style rotates day by day and MOTION_STYLE forces one', () => {
  const day = (n) => pickStyle(new Date(n * 86400000), {});
  assert.notEqual(day(100), day(101));
  assert.equal(day(100), day(100));
  assert.equal(new Set(Array.from({ length: MOTION_STYLES.length }, (_, i) => day(200 + i))).size, MOTION_STYLES.length);
  assert.equal(pickStyle(new Date(), { MOTION_STYLE: 'selection' }), 'selection');
  assert.ok(MOTION_STYLES.includes(pickStyle(new Date(), { MOTION_STYLE: 'xx' })));
});
test('scenes cover the whole narration and sound effects stay lean', () => {
  const screens = [{ title: 'Gancho **forte**' }, { title: 'Frase um.' }, { title: 'Frase dois bem maior.' }, { title: 'Comente SITE', cta: true }];
  const sc = motionScenes(screens, 30);
  assert.equal(sc[0].kind, 'hook');
  assert.equal(sc[3].kind, 'cta');
  assert.ok(Math.abs(sc[3].t1 - 30) < 1e-6);
  for (let i = 1; i < sc.length; i++) assert.ok(Math.abs(sc[i].t0 - sc[i - 1].t1) < 1e-9);
  for (const st of MOTION_STYLES) assert.ok(motionSfx(sc, st).length / 30 <= 0.8, st);
});

test('every style renders every kind of animation without errors (visual catalog)', async () => {
  const all = [
    { type: 'search', query: 'dentista perto de mim' },
    { type: 'chat', msgs: [{ who: 'cliente', text: 'Oi, atendem hoje?' }, { who: 'voce', text: 'Atendemos! Qual horário?' }] },
    { type: 'loading', label: 'Carregando…', outcome: 'Cliente saiu' },
    { type: 'versus', left: { title: 'Sem site', items: ['a', 'b'] }, right: { title: 'Com site', items: ['c', 'd'] } },
    { type: 'checklist', items: ['um', 'dois', 'três'] },
    { type: 'funnel', steps: ['Pesquisa', 'Visita', 'Contato'] },
    { type: 'steps', steps: ['Briefing', 'Protótipo', 'No ar'] },
    { type: 'notification', items: ['Novo contato', 'Pedido de orçamento'] },
    { type: 'quote', text: 'Será que é confiável?', who: 'Cliente' },
    { type: 'map', name: 'Sua empresa', label: 'Aberto agora' },
    { type: 'clock', label: 'Sempre disponível' },
    { type: 'stat', value: '53%', label: 'saem se demora' },
    { type: 'site', niche: 2 },
    { type: 'none' },
  ];
  const script = all.map((_, i) => `Frase número ${i + 1} que a animação ilustra aqui.`).join(' ');
  const rich = { ...post, script, visuals: all };
  for (const style of MOTION_STYLES) {
    const dir = await mkdtemp(join(tmpdir(), `vis-${style}-`));
    const { path } = await renderReel(rich, dir, { ttsImpl: fakeTts(33), style, fps: 2 });
    assert.equal(probe(path, 'stream=width,height'), '1080,1920', style);
  }
});
