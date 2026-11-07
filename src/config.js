export const config = {
  tz: 'America/Sao_Paulo',
  minScore: 6,
  noRepeatDays: 30,
  approvalDeadline: '11:00',
  approvalGraceMin: 20, // tolerância: o Telegram não informa a hora do clique e o cron do GitHub atrasa
  baseline: { reel: 4, carousel: 2 },
  competitors: [], // @ de 3 a 5 perfis de referência (preencher)
};

export function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);
  return Object.fromEntries(keys.map((k) => [k, process.env[k]]));
}

const SECRET_KEYS = ['GEMINI_KEY', 'TG_TOKEN', 'IG_TOKEN', 'GH_ADMIN_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN'];

// Troca por *** qualquer valor secreto presente no ambiente. Use em toda mensagem de erro que sai do processo.
export function sanitize(text) {
  let out = String(text);
  for (const k of SECRET_KEYS) {
    const v = process.env[k];
    if (v && v.length >= 8) out = out.split(v).join('***');
  }
  return out;
}
