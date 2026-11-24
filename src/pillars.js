// Pilares de conteúdo: cada post nasce de um pilar com função própria, para o perfil nunca virar "o mesmo post trocando o nicho".
// O que faz um post circular: a pessoa SALVA (útil) e MANDA para alguém (relevante, curioso ou polêmico na medida certa).

export const NICHES = ['clínicas e consultórios', 'advocacia', 'estética', 'energia solar', 'negócio local em geral'];

export const PILLARS = {
  tutorial: {
    nome: 'Faça você mesmo',
    descricao: 'passo a passo que o dono aplica hoje, de graça, e salva: Google Meu Negócio, WhatsApp Business, fotos, resposta a avaliações, perfil do Instagram, como testar a velocidade do site',
    formatos: ['carousel', 'reel'],
    ganchos: ['Faça isto no seu Google Meu Negócio hoje', 'O ajuste de 5 minutos que muda o que o cliente vê de você', 'Passo a passo: como ... sem pagar ninguém'],
  },
  mitos: {
    nome: 'Mito ou verdade',
    descricao: 'derruba uma crença comum de dono de negócio local sobre Google, Instagram, site, anúncio ou IA, e explica o que é verdade',
    formatos: ['reel', 'post'],
    ganchos: ['Quem te disse isso errou', 'Isso que todo mundo repete sobre anúncio não é bem assim', 'Mito: ...? A verdade é outra'],
  },
  erros: {
    nome: 'Erro que custa cliente',
    descricao: 'um erro ESPECÍFICO e pouco percebido (em atendimento, agenda, resposta no WhatsApp, página, anúncio ou perfil) com a consequência e a correção',
    formatos: ['reel', 'carousel'],
    ganchos: ['Seu cliente desiste aqui e você nem vê', 'O erro silencioso do primeiro atendimento', 'Você faz isso no WhatsApp? Então perde'],
  },
  bastidor: {
    nome: 'Como funciona por dentro',
    descricao: 'explica, em linguagem simples, como o cliente escolhe, como o Google decide quem aparece, como as IAs recomendam negócios, o que acontece quando alguém pesquisa o serviço',
    formatos: ['reel', 'carousel'],
    ganchos: ['O que o Google olha antes de mostrar você', 'Como a pessoa escolhe entre você e o concorrente em segundos', 'O que acontece nos 5 segundos depois que ela clica'],
  },
  noticia: {
    nome: 'O que mudou e o que fazer',
    descricao: 'uma mudança real (Google, Meta, WhatsApp, IA, lei) traduzida em "o que muda para o seu negócio e o que fazer hoje". Só entra se der utilidade; nunca só repete a manchete',
    formatos: ['reel', 'carousel'],
    ganchos: ['Mudou ...: o que isso muda para você', 'Se você ainda faz ... , pare'],
  },
  regras: {
    nome: 'O que pode e o que não pode',
    descricao: 'orientação geral sobre comunicação e publicidade do nicho (OAB para advocacia, conselhos de medicina e odontologia para clínicas, vigilância sanitária para estética) e LGPD, em linguagem simples',
    formatos: ['carousel', 'post'],
    ganchos: ['O que sua clínica NÃO pode postar', 'Advogado pode fazer isto no Instagram?', 'O cuidado com dados do cliente que quase todo mundo ignora'],
    cuidado: 'Fale só do que é de conhecimento geral, sem citar artigo, número de resolução nem multa. Feche lembrando de confirmar as regras atuais com o próprio conselho ou profissional. Nunca dê parecer jurídico.',
  },
  comparacao: {
    nome: 'A ou B?',
    descricao: 'compara duas escolhas reais do dono (ex.: só Instagram ou também Google, link na bio ou página própria, responder na hora ou depois, anúncio ou orgânico) e diz quando cada uma serve',
    formatos: ['carousel', 'reel'],
    ganchos: ['Instagram ou Google: onde seu cliente de verdade está?', 'Qual dos dois traz o cliente que paga'],
  },
  checklist: {
    nome: 'Checklist salvável',
    descricao: 'lista curta de autoavaliação que a pessoa confere no próprio negócio em minutos',
    formatos: ['checklist', 'carousel'],
    ganchos: ['Confira em 2 minutos se seu negócio passa nisso', 'Marque quantos você já faz'],
  },
  opiniao: {
    nome: 'Opinião forte',
    descricao: 'uma posição clara e contrária ao senso comum do nicho ("pare de...", "não faça..."), defendida com um motivo concreto',
    formatos: ['post', 'reel'],
    ganchos: ['Pare de postar assim', 'Posso discordar de quem diz que ...?', 'Isso não é estratégia, é barulho'],
  },
  cenario: {
    nome: 'Imagine este cenário',
    descricao: 'cenário HIPOTÉTICO do dia a dia (sem cliente real e sem números) que mostra um problema de forma que o dono se reconheça; sempre apresentado como hipótese',
    formatos: ['reel', 'carousel'],
    ganchos: ['Imagine: são 22h e alguém procura sua clínica', 'Terça, 9h: o telefone toca e ninguém atende'],
  },
};

export const pillarIds = Object.keys(PILLARS);
export const normalizePillar = (id) => (PILLARS[id] ? id : null);

export function pillarsForPrompt() {
  return pillarIds.map((id) => `- ${id}: ${PILLARS[id].nome}. ${PILLARS[id].descricao}`).join('\n');
}

// Melhor formato entre os que ainda cabem na cota da semana: o preferido do pilar, senão o primeiro disponível.
export function formatFor(pillarId, open) {
  const prefs = PILLARS[pillarId]?.formatos || [];
  const kind = (f) => (f === 'checklist' ? 'carousel' : f);
  for (const f of prefs) if (open.includes(kind(f))) return f;
  return null;
}
