export const config = {
  tz: 'America/Sao_Paulo',
  minScore: 6,
  noRepeatDays: 30,
  approvalDeadline: '11:00',
  approvalGraceMin: 20, // tolerância: o Telegram não informa a hora do clique e o cron do GitHub atrasa
  baseline: { reel: 4, carousel: 2 },
  competitors: [], // @ de 3 a 5 perfis de referência (preencher)

  // Locução dos Reels. Tenta a voz do Gemini (mesma chave GEMINI_KEY); se falhar, cai para a voz Edge.
  // Variáveis do GitHub (Settings > Variables): GEMINI_VOICE, GEMINI_TTS_MODEL e TTS_ENGINE=edge para forçar a reserva.
  voice: {
    engine: process.env.TTS_ENGINE || 'gemini',
    model: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts',
    name: process.env.GEMINI_VOICE || 'Sulafat',
    edge: 'pt-BR-AntonioNeural',
    style: 'Speak in natural, conversational Brazilian Portuguese, like a confident and friendly consultant talking face to face with a small business owner. Calm, steady pace, warm tone, a slight smile, real human pauses and emphasis. Never robotic, never like a news announcer.',
  },

  // Funil do Direct: comentou a palavra-chave, recebe a mensagem. Texto e link APROVADOS pelo dono em 07/11/2026.
  // Fica DESLIGADO até existir um IG_TOKEN com as permissões de comentários e mensagens. Para ligar: enabled: true.
  funnel: {
    enabled: false,
    keyword: 'SITE',
    ownUsername: 'esm_web',
    link: 'https://esmweb.vercel.app',
    maxPerRun: 20,
    publicReply: 'Te enviei no Direct! 📩',
    dm: [
      'Oi! 👋 Aqui é a ESM Web. Você comentou SITE, então já te mando o caminho.',
      '',
      'Hoje, antes de ligar ou ir até um negócio, muita gente pesquisa no Google. Quem não aparece com um site rápido, bonito e fácil de usar no celular perde esse cliente para o concorrente, e nem fica sabendo.',
      '',
      'A gente cria sites e landing pages pensados para transformar visita em contato (WhatsApp, agendamento).',
      '',
      'Veja o que fazemos: {link}',
      '',
      'Quer saber o que um site faria pelo seu negócio? Responda aqui com o nome do seu negócio e o que você faz.',
    ].join('\n'),
  },
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
