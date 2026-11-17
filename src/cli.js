import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { requireEnv, config, sanitize } from './config.js';
import { loadState, saveState } from './state.js';
import { askJson } from './llm.js';
import { collectSignals } from './research/index.js';
import { renderReel } from './producer/reel.js';
import { renderPost } from './producer/post.js';
import { runChecks, formatChecks, tokenExpires } from './check.js';
import { testMedia, formatMedia } from './testmedia.js';
import { listenLoop } from './listen.js';
import { renderStory } from './producer/story.js';
import { renderCarousel } from './producer/carousel.js';
import { renderChecklist } from './producer/checklist.js';
import { createTelegram } from './approval.js';
import { createInstagram, publish, publishStories } from './publisher.js';
import { stageMedia, publishRelease } from './media-host.js';
import { generate, poll, processSwaps } from './pipeline.js';
import { runFunnel } from './funnel.js';
import { collectInsights, adjustPlan, weeklyReport } from './analytics.js';
import { refreshToken, tokenDaysLeft, needsAlert } from './token.js';

const run = promisify(execFile);
const [cmd, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');

const plan = async () => ({ ...config.baseline, ...((await loadState('plan'))[0] ?? {}) });

function telegram() {
  const { TG_TOKEN, TG_CHAT_ID } = requireEnv(['TG_TOKEN', 'TG_CHAT_ID']);
  return createTelegram(TG_TOKEN, TG_CHAT_ID);
}

// Grava o estado (data/) no repositório. Só no GitHub Actions; local não mexe no git.
async function checkpoint() {
  if (!process.env.GITHUB_ACTIONS) return;
  const git = (...a) => run('git', a);
  await git('config', 'user.name', 'esm-bot');
  await git('config', 'user.email', 'bot@users.noreply.github.com');
  await git('add', 'data');
  try { await git('diff', '--cached', '--quiet'); return; } catch { /* há mudanças */ }
  await git('commit', '-m', 'chore: estado');
  for (let i = 0; i < 3; i++) {
    try { await git('pull', '--rebase', '--autostash'); await git('push'); return; } catch (e) { if (i === 2) throw e; }
  }
}

async function baseDeps() {
  const tg = telegram();
  const repo = process.env.GITHUB_REPOSITORY;
  const d = {
    now: new Date(), plan: await plan(), dry, tg, checkpoint,
    llm: (o) => askJson(o),
    collect: () => collectSignals({ competitors: config.competitors }),
    render: { reel: renderReel, carousel: renderCarousel, checklist: renderChecklist, post: renderPost, story: renderStory },
    newId: () => randomUUID().slice(0, 8),
    alert: (text) => tg.call('sendMessage', { text }),
  };
  if (repo && process.env.GH_TOKEN) {
    d.stage = (item) => stageMedia([...item.media, ...(item.story?.media ?? [])], { repo, tag: `post-${item.id}` });
    d.release = (item) => publishRelease(item.release, { repo });
  }
  return d;
}

// Passa o valor por stdin: não aparece na linha de comando nem na mensagem de erro.
function setSecret(name, value, repo, ghToken) {
  return new Promise((resolve, reject) => {
    const p = spawn('gh', ['secret', 'set', name, '--repo', repo], { env: { ...process.env, GH_TOKEN: ghToken } });
    let err = '';
    p.stderr.on('data', (c) => { err += c; });
    p.on('error', () => reject(new Error('gh indisponível')));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`gh secret set falhou (código ${code}): ${sanitize(err).slice(0, 200)}`))));
    p.stdin.end(value);
  });
}

const commands = {
  async generate() {
    requireEnv(['GEMINI_KEY']);
    const d = await baseDeps();
    console.log(JSON.stringify(sanitizeObj(await generate(d)), null, 2));
    // Sem as chaves do Instagram a aprovação não publica: avisa uma vez por dia, na hora da prévia.
    if (!dry && !(process.env.IG_TOKEN && process.env.IG_USER_ID)) {
      try { await d.alert('⚠️ O Instagram ainda não está configurado (faltam IG_TOKEN e IG_USER_ID): aprovar ainda não publica. Rode Actions → check para ver o que falta.'); } catch { /* sem canal de aviso */ }
    }
  },

  async poll() {
    const d = await baseDeps();
    // Sem as chaves do Instagram não há o que publicar: sai sem erro e sem consumir os cliques do Telegram.
    if (!dry && !(process.env.IG_TOKEN && process.env.IG_USER_ID)) { console.log('Instagram não configurado (IG_TOKEN/IG_USER_ID): nada a fazer.'); return; }
    if (!dry) {
      const { IG_TOKEN, IG_USER_ID } = requireEnv(['IG_TOKEN', 'IG_USER_ID']);
      d.ig = createInstagram(IG_TOKEN, IG_USER_ID);
      d.publish = publish;
      d.publishStories = publishStories;
    }
    const { swaps } = await poll(d);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `swap=${swaps > 0}\n`);
  },

  // Fica escutando o Telegram até decidirem (ou o prazo vencer): resposta em segundos, sem depender do agendador do GitHub.
  // Sai quando não há mais nada pendente, quando alguém pede troca de tema (o workflow gera o novo tema) ou perto do limite
  // de 6 h do GitHub (o workflow se reabre sozinho).
  async listen() {
    if (!(process.env.IG_TOKEN && process.env.IG_USER_ID)) { console.log('Instagram não configurado: nada a escutar.'); return; }
    const { IG_TOKEN, IG_USER_ID } = requireEnv(['IG_TOKEN', 'IG_USER_ID']);
    const d = await baseDeps();
    d.ig = createInstagram(IG_TOKEN, IG_USER_ID);
    d.publish = publish;
    d.publishStories = publishStories;
    d.pollTimeout = 25;
    const { swap, rearm } = await listenLoop({
      refresh: async () => { if (process.env.GITHUB_ACTIONS) { try { await run('git', ['pull', '--rebase', '--autostash']); } catch { /* segue com o estado local */ } } },
      hasPending: async () => (await loadState('queue')).some((i) => i.status === 'pending'),
      pollOnce: async () => { d.now = new Date(); return poll(d); },
      onError: (e) => console.error(sanitize(e.message)),
    });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `swap=${swap}
rearm=${rearm}
`);
  },

  async swap() {
    requireEnv(['GEMINI_KEY']);
    console.log(`trocas processadas: ${await processSwaps(await baseDeps())}`);
  },

  async analytics() {
    const { IG_TOKEN, IG_USER_ID } = requireEnv(['IG_TOKEN', 'IG_USER_ID']);
    const tg = telegram();
    const errors = [];
    const metrics = await collectInsights(await loadState('history'), createInstagram(IG_TOKEN, IG_USER_ID), new Date(), errors);
    await saveState('metrics', metrics);
    await saveState('plan', [adjustPlan(await plan(), metrics)]);
    const extra = errors.length ? `\n\nNão consegui ler ${errors.length} post(s): ${sanitize(errors[0])}` : '';
    await tg.call('sendMessage', { text: weeklyReport(metrics) + extra });
  },

  // Renova o token longo, grava o novo valor no Secret IG_TOKEN (via stdin) e alerta se faltar pouco para expirar.
  async refresh() {
    // O token do Unified login (usuário do sistema) não expira: não há o que renovar.
    if (!tokenExpires()) { console.log('Token que não expira (Unified login): nada a renovar.'); return; }
    const { IG_TOKEN, GITHUB_REPOSITORY, GH_ADMIN_TOKEN } = requireEnv(['IG_TOKEN', 'GITHUB_REPOSITORY', 'GH_ADMIN_TOKEN']);
    const tg = telegram();
    try {
      const { token, expiresAt } = await refreshToken(IG_TOKEN);
      await setSecret('IG_TOKEN', token, GITHUB_REPOSITORY, GH_ADMIN_TOKEN);
      await saveState('token', [{ expiresAt }]);
      console.log(`token renovado; ${tokenDaysLeft(expiresAt)} dias restantes`);
    } catch (e) {
      const [row] = await loadState('token');
      const left = row ? tokenDaysLeft(row.expiresAt) : null;
      await tg.call('sendMessage', { text: sanitize(`Não consegui renovar o token do Instagram: ${e.message}. ${left !== null ? `Restam ${left} dias. ` : ''}Verifique se o GH_ADMIN_TOKEN não expirou e gere um novo token na Meta se precisar.`) });
      if (row && needsAlert(row.expiresAt)) process.exitCode = 1;
    }
  },

  // Responde no Direct a quem comentou a palavra-chave. Desligado por padrão (config.funnel.enabled).
  async funnel() {
    if (!config.funnel.enabled) { console.log('Funil desligado (config.funnel.enabled = false).'); return; }
    const { IG_TOKEN, IG_USER_ID } = requireEnv(['IG_TOKEN', 'IG_USER_ID']);
    const tg = telegram();
    const r = await runFunnel({ ig: createInstagram(IG_TOKEN, IG_USER_ID), history: await loadState('history'), handled: await loadState('funnel'), now: new Date(), cfg: config.funnel });
    await saveState('funnel', r.handled);
    if (r.sent) await tg.call('sendMessage', { text: `Direct enviado para ${r.sent} comentário(s) com ${config.funnel.keyword}.` });
    if (r.errors.length) await tg.call('sendMessage', { text: sanitize(`Funil do Direct: ${r.errors.length} erro(s). Primeiro: ${r.errors[0]}`).slice(0, 3500) });
  },

  // Testa cada chave de verdade (sem publicar) e manda o resultado no Telegram.
  async check() {
    const results = await runChecks({ env: process.env });
    const text = formatChecks(results);
    console.log(text);
    await telegram().call('sendMessage', { text });
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  },

  // Prova que o Instagram aceita as mídias do sistema (imagem, story, vídeo) sem publicar nada.
  async testmedia() {
    const { IG_TOKEN, IG_USER_ID, GITHUB_REPOSITORY: repo } = requireEnv(['IG_TOKEN', 'IG_USER_ID', 'GITHUB_REPOSITORY']);
    const dir = 'out/testmedia';
    await mkdir(dir, { recursive: true });
    const post = { label: 'TESTE DE MÍDIA', hook: 'Teste de **mídia**', sub: 'Nada é publicado nesta etapa.', script: 'Esta imagem só confere se o Instagram consegue baixar o arquivo.', cta: 'Chame no **WhatsApp**', caption: '', hashtags: [] };
    const files = {
      image: (await renderPost(post, dir)).paths[0],
      story: (await renderStory(post, dir, { format: 'post' })).paths[0],
      video: `${dir}/teste.mp4`,
    };
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x0A0B0D:s=1080x1920:r=30', '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=44100', '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', files.video]);
    const tag = `teste-midia-${Date.now()}`;
    const results = await testMedia({
      ig: createInstagram(IG_TOKEN, IG_USER_ID), files,
      stage: (paths) => stageMedia(paths, { repo, tag }),
      release: (staged) => publishRelease(staged, { repo }),
      cleanup: () => run('gh', ['release', 'delete', tag, '--repo', repo, '--yes', '--cleanup-tag']),
    });
    const text = sanitize(formatMedia(results));
    console.log(text);
    await telegram().call('sendMessage', { text });
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  },

  async checkpoint() { await checkpoint(); },
};

const sanitizeObj = (o) => JSON.parse(sanitize(JSON.stringify(o)));

if (!commands[cmd]) {
  console.error('Uso: node src/cli.js generate|poll|swap|analytics|refresh|funnel|check|testmedia|listen|checkpoint [--dry]');
  process.exit(2);
}
commands[cmd]().catch(async (e) => {
  const msg = sanitize(e.message);
  console.error(msg);
  try { await telegram().call('sendMessage', { text: `Erro em "${cmd}": ${msg}`.slice(0, 3500) }); } catch { /* sem Telegram configurado */ }
  process.exit(1);
});
