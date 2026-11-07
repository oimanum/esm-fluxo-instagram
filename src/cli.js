import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { requireEnv, config } from './config.js';
import { loadState, saveState } from './state.js';
import { askJson } from './llm.js';
import { collectSignals } from './research/index.js';
import { renderReel } from './producer/reel.js';
import { renderCarousel } from './producer/carousel.js';
import { createTelegram } from './approval.js';
import { createInstagram, publish } from './publisher.js';
import { uploadMedia } from './media-host.js';
import { generate, poll } from './pipeline.js';
import { collectInsights, adjustPlan, weeklyReport } from './analytics.js';
import { refreshToken, tokenDaysLeft, needsAlert } from './token.js';

const run = promisify(execFile);
const [cmd, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');

async function plan() {
  return (await loadState('plan'))[0] ?? { ...config.baseline };
}

function telegram() {
  const { TG_TOKEN, TG_CHAT_ID } = requireEnv(['TG_TOKEN', 'TG_CHAT_ID']);
  return createTelegram(TG_TOKEN, TG_CHAT_ID);
}

async function baseDeps() {
  const tg = telegram();
  return {
    now: new Date(), plan: await plan(), dry, tg,
    llm: (o) => askJson(o),
    collect: () => collectSignals({ competitors: config.competitors }),
    render: { reel: renderReel, carousel: renderCarousel },
    newId: () => randomUUID().slice(0, 8),
    alert: (text) => tg.call('sendMessage', { text }),
  };
}

const commands = {
  async generate() {
    requireEnv(['GEMINI_KEY']);
    console.log(JSON.stringify(await generate(await baseDeps()), null, 2));
  },

  async poll() {
    const d = await baseDeps();
    if (!dry) {
      const { IG_TOKEN, IG_USER_ID, GITHUB_REPOSITORY } = requireEnv(['IG_TOKEN', 'IG_USER_ID', 'GITHUB_REPOSITORY']);
      d.ig = createInstagram(IG_TOKEN, IG_USER_ID);
      d.publish = publish;
      d.upload = (paths, { tag }) => uploadMedia(paths, { repo: GITHUB_REPOSITORY, tag });
    }
    await poll(d);
  },

  async analytics() {
    const { IG_TOKEN, IG_USER_ID } = requireEnv(['IG_TOKEN', 'IG_USER_ID']);
    const tg = telegram();
    const ig = createInstagram(IG_TOKEN, IG_USER_ID);
    const metrics = await collectInsights(await loadState('history'), ig, new Date());
    await saveState('metrics', metrics);
    await saveState('plan', [adjustPlan(await plan(), metrics)]);
    await tg.call('sendMessage', { text: weeklyReport(metrics) });
  },

  // Renova o token longo, grava o novo valor no Secret IG_TOKEN e alerta se faltar pouco para expirar.
  async refresh() {
    const { IG_TOKEN, GITHUB_REPOSITORY, GH_ADMIN_TOKEN } = requireEnv(['IG_TOKEN', 'GITHUB_REPOSITORY', 'GH_ADMIN_TOKEN']);
    const tg = telegram();
    try {
      const { token, expiresAt } = await refreshToken(IG_TOKEN);
      await run('gh', ['secret', 'set', 'IG_TOKEN', '--repo', GITHUB_REPOSITORY, '--body', token], { env: { ...process.env, GH_TOKEN: GH_ADMIN_TOKEN } });
      await saveState('token', [{ expiresAt }]);
      console.log(`token renovado; ${tokenDaysLeft(expiresAt)} dias restantes`);
    } catch (e) {
      const [row] = await loadState('token');
      const left = row ? tokenDaysLeft(row.expiresAt) : null;
      await tg.call('sendMessage', { text: `Não consegui renovar o token do Instagram (${e.message}). ${left !== null ? `Restam ${left} dias.` : ''} Gere um novo no painel da Meta.` });
      if (row && needsAlert(row.expiresAt)) process.exitCode = 1;
    }
  },
};

if (!commands[cmd]) {
  console.error('Uso: node src/cli.js generate|poll|analytics|refresh [--dry]');
  process.exit(2);
}
commands[cmd]().catch(async (e) => {
  console.error(e.message);
  process.exit(1);
});
