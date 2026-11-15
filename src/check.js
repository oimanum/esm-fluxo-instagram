// Conferência da configuração: cada chave é testada de verdade, sem publicar nada.
import { GRAPH_BASE } from './publisher.js';

const mask = (msg, env) => Object.values(env).reduce((m, v) => (typeof v === 'string' && v.length >= 8 ? m.split(v).join('***') : m), String(msg));
// Token do Instagram Login (graph.instagram.com) expira em 60 dias; o do Unified login (graph.facebook.com, usuário do sistema) não expira.
export const tokenExpires = (base = GRAPH_BASE) => /graph\.instagram\.com/.test(base);

export async function runChecks({ env, fetchImpl = fetch, base = GRAPH_BASE }) {
  const out = [];
  const add = (name, ok, detail) => out.push({ name, ok, detail });
  const safe = async (name, fn) => { try { add(name, true, await fn()); } catch (e) { add(name, false, mask(e.message, env)); } };

  await safe('Gemini (roteiros e voz)', async () => {
    if (!env.GEMINI_KEY) throw new Error('GEMINI_KEY não cadastrada');
    const r = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': env.GEMINI_KEY } });
    if (!r.ok) throw new Error(`a chave foi recusada (HTTP ${r.status})`);
    return 'chave válida';
  });
  await safe('Telegram (aprovação)', async () => {
    if (!env.TG_TOKEN || !env.TG_CHAT_ID) throw new Error('TG_TOKEN ou TG_CHAT_ID não cadastrados');
    const r = await fetchImpl(`https://api.telegram.org/bot${env.TG_TOKEN}/getMe`);
    const j = await r.json();
    if (!j.ok) throw new Error('o token do bot foi recusado');
    return `bot @${j.result.username}`;
  });
  await safe('Instagram (publicação)', async () => {
    if (!env.IG_TOKEN || !env.IG_USER_ID) throw new Error('IG_TOKEN ou IG_USER_ID não cadastrados');
    // Lê a própria conta pelo ID: vale para os dois tipos de token e prova que o token enxerga a conta certa.
    const r = await fetchImpl(`${base}/${env.IG_USER_ID}?${new URLSearchParams({ fields: 'username' })}`, { headers: { authorization: `Bearer ${env.IG_TOKEN}` } });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`o token não consegue ler a conta ${env.IG_USER_ID} (${j.error?.message || r.status}). Confira o IG_USER_ID e se a conta @esm_web está ligada ao token`);
    return `@${j.username}`;
  });
  if (tokenExpires(base)) {
    await safe('Renovação do token (GH_ADMIN_TOKEN)', async () => {
      if (!env.GH_ADMIN_TOKEN) throw new Error('GH_ADMIN_TOKEN não cadastrado');
      const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/secrets`, { headers: { authorization: `Bearer ${env.GH_ADMIN_TOKEN}`, accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(`o token foi recusado ou não tem a permissão "Secrets: Read and write" (HTTP ${r.status})`);
      return 'pode gravar segredos';
    });
  } else {
    add('Renovação do token', true, 'não precisa: o token do Unified login não expira (GH_ADMIN_TOKEN dispensado)');
  }
  return out;
}

export function formatChecks(results) {
  const ok = results.every((r) => r.ok);
  const lines = results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.detail}`);
  return `Conferência da configuração\n\n${lines.join('\n')}\n\n${ok ? 'Tudo pronto. Falta só o primeiro post de verdade (Actions → generate, sem marcar "Prévia de TESTE").' : 'Corrija os itens com ❌ e rode a conferência de novo.'}`;
}
