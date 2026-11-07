export const config = {
  tz: 'America/Sao_Paulo',
  minScore: 6,
  noRepeatDays: 30,
  approvalDeadline: '11:00',
  baseline: { reel: 4, carousel: 2 },
  competitors: [], // @ de 3 a 5 perfis de referência (preencher)
};

export function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Variáveis ausentes: ${missing.join(', ')}`);
  return Object.fromEntries(keys.map((k) => [k, process.env[k]]));
}
