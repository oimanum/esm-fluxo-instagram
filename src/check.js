// Conferência da configuração: cada chave é testada de verdade, sem publicar nada.
import { GRAPH_BASE } from './publisher.js';

const mask = (msg, env) => Object.values(env).reduce((m, v) => (typeof v === 'string' && v.length >= 8 ? m.split(v).join('***') : m), String(msg));

export async function runChecks({ env, fetchImpl = fetch }) {
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
    const r = await fetchImpl(`${GRAPH_BASE}/me?${new URLSearchParams({ fields: 'user_id,username,account_type' })}`, { headers: { authorization: `Bearer ${env.IG_TOKEN}` } });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`o token foi recusado (${j.error?.message || r.status})`);
    if (String(j.user_id) !== String(env.IG_USER_ID)) throw new Error(`o IG_USER_ID (${env.IG_USER_ID}) não é o da conta do token (${j.user_id})`);
    if (!/BUSINESS|MEDIA_CREATOR/i.test(j.account_type || '')) throw new Error(`a conta é ${j.account_type}; precisa ser Profissional (Business ou Criador)`);
    return `@${j.username} (${j.account_type})`;
  });
  await safe('Renovação do token (GH_ADMIN_TOKEN)', async () => {
    if (!env.GH_ADMIN_TOKEN) throw new Error('GH_ADMIN_TOKEN não cadastrado');
    const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/secrets`, { headers: { authorization: `Bearer ${env.GH_ADMIN_TOKEN}`, accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`o token foi recusado ou não tem a permissão "Secrets: Read and write" (HTTP ${r.status})`);
    return 'pode gravar segredos';
  });
  return out;
}

export function formatChecks(results) {
  const ok = results.every((r) => r.ok);
  const lines = results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.detail}`);
  return `Conferência da configuração\n\n${lines.join('\n')}\n\n${ok ? 'Tudo pronto. Falta só o primeiro post de verdade (Actions → generate, sem marcar "Prévia de TESTE").' : 'Corrija os itens com ❌ e rode a conferência de novo.'}`;
}
