import { randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFileSync } from 'node:fs';
import { requireEnv, config, sanitize } from './config.js';
import { loadState, saveState } from './state.js';
import { askJson } from './llm.js';
import { collectSignals } from './research/index.js';
import { renderReel } from './producer/reel.js';
import { renderCarousel } from './producer/carousel.js';
import { renderChecklist } from './producer/checklist.js';
import { createTelegram } from './approval.js';
import { createInstagram, publish } from './publisher.js';
import { stageMedia, publishRelease } from './media-host.js';
import { generate, poll, processSwaps } from './pipeline.js';
import { collectInsights, adjustPlan, weeklyReport } from './analytics.js';
import { refreshToken, tokenDaysLeft, needsAlert } from './token.js';

const run = promisify(execFile);
const [cmd, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');

const plan = async () => (await loadState('plan'))[0] ?? { ...config.baseline };

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
    render: { reel: renderReel, carousel: renderCarousel, checklist: renderChecklist },
    newId: () => randomUUID().slice(0, 8),
    alert: (text) => tg.call('sendMessage', { text }),
  };
  if (repo && process.env.GH_TOKEN) {
    d.stage = (item) => stageMedia(item.media, { repo, tag: `post-${item.id}` });
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
    console.log(JSON.stringify(sanitizeObj(await generate(await baseDeps())), null, 2));
  },

  async poll() {
    const d = await baseDeps();
    if (!dry) {
      const { IG_TOKEN, IG_USER_ID } = requireEnv(['IG_TOKEN', 'IG_USER_ID']);
      d.ig = createInstagram(IG_TOKEN, IG_USER_ID);
      d.publish = publish;
    }
    const { swaps } = await poll(d);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `swap=${swaps > 0}\n`);
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

  async checkpoint() { await checkpoint(); },
};

const sanitizeObj = (o) => JSON.parse(sanitize(JSON.stringify(o)));

if (!commands[cmd]) {
  console.error('Uso: node src/cli.js generate|poll|swap|analytics|refresh|checkpoint [--dry]');
  process.exit(2);
}
commands[cmd]().catch(async (e) => {
  const msg = sanitize(e.message);
  console.error(msg);
  try { await telegram().call('sendMessage', { text: `Erro em "${cmd}": ${msg}`.slice(0, 3500) }); } catch { /* sem Telegram configurado */ }
  process.exit(1);
});
