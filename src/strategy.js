import { config } from './config.js';
import { pillarsForPrompt, normalizePillar, formatFor } from './pillars.js';

const RUBRIC = `Você é estrategista de conteúdo VIRAL da ESM Web (sites e landing pages para clínicas, advocacia, estética e energia solar). O público são donos e gestores desses negócios.
OBJETIVO: ideias de posts que o dono SALVA e MANDA para um colega, que ensinam ou esclarecem algo que ele realmente precisa saber, e que fazem o perfil ser visto como referência. Não é para repetir "seu site perde cliente".
Proponha 10 ideias NOVAS, usando pelo menos 6 pilares diferentes, cada uma com uma ideia central própria e específica.
PILARES:
{PILARES}
REGRAS:
- Proibido repetir o assunto do HISTÓRICO nem apenas trocar o nicho (ex.: "Instagram não basta" virando versão para clínica, advocacia e estética). Duas ideias não podem ter a mesma ideia central.
- Cada ideia entrega algo concreto que a pessoa aplica sozinha ou entende melhor no próprio negócio. Site, Google e WhatsApp entram quando fazem sentido, nunca como o único assunto.
- "topic" é a PROMESSA em linguagem do dono (pergunta, contradição ou curiosidade), sem inventar dados, estudos ou números.
- "angle" diz a ideia central e o que a pessoa aprende ou faz depois.
- "niche": para quem é (clínicas e consultórios, advocacia, estética, energia solar ou negócio local em geral). Varie.
- Notas de 0 a 10 para utilidade (vale salvar), compartilhamento (manda para alguém), curiosidade, relevância para quem decide a compra e originalidade em relação ao HISTÓRICO. "score" é a média das cinco.
Responda JSON: {"topics":[{"topic":string,"pillar":string,"niche":string,"angle":string,"score":number}]}. "pillar" é um dos ids acima.`;

// signals: notícias do dia (só inspiração). recent: o que já foi publicado ou gerado, para não repetir.
export async function scoreTopics(signals, llm, { recent = [] } = {}) {
  const list = (signals || []).slice(0, 40).map((s) => `- [${s.source}] ${s.title}`).join(String.fromCharCode(10));
  const seen = recent.slice(-40).map((h) => `- ${h.topic}${h.hook ? ` | gancho: ${String(h.hook).replace(/\*\*/g, '')}` : ''}`).join(String.fromCharCode(10));
  const out = await llm({
    prompt: `${RUBRIC.replace('{PILARES}', pillarsForPrompt())}

HISTÓRICO (não repetir nem variar só o nicho):
${seen || '(vazio)'}

INSPIRAÇÃO (notícias de hoje; use só se render utilidade real, ignore o resto):
${list || '(sem notícias hoje)'}`,
    schema: (o) => Array.isArray(o?.topics) && o.topics.length > 0 && o.topics.every((t) => typeof t.topic === 'string' && typeof t.score === 'number'),
  });
  return out.topics.map((t) => ({ ...t, pillar: normalizePillar(t.pillar) })).sort((x, y) => y.score - x.score);
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '');
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 3));
function similar(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return norm(a) === norm(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / new Set([...A, ...B]).size >= 0.6;
}

const DAY = 86400000;
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: config.tz }).format(d);
function weekStart(now) {
  const [y, m, d] = ymd(now).split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = (utc.getUTCDay() + 6) % 7; // segunda = 0
  return ymd(new Date(utc.getTime() - dow * DAY));
}

export function pickToday({ scored, history, now, plan }) {
  const counted = history.filter((h) => h.status === 'posted' || h.status === 'approved');
  if (counted.some((h) => ymd(new Date(h.postedAt)) === ymd(now))) return { skip: 'ja_postou_hoje' };

  const ws = weekStart(now);
  const used = { reel: 0, carousel: 0, post: 0 };
  // Checklist é post estático em imagem(ns): conta na cota do carrossel.
  for (const h of counted) {
    const day = ymd(new Date(h.postedAt));
    if (day >= ws && day <= ymd(now)) used[h.format === 'checklist' ? 'carousel' : h.format] = (used[h.format === 'checklist' ? 'carousel' : h.format] || 0) + 1;
  }
  const left = { reel: (plan.reel ?? 0) - used.reel, carousel: (plan.carousel ?? 0) - used.carousel, post: (plan.post ?? 0) - used.post };
  const open = Object.keys(left).filter((k) => left[k] > 0);
  if (!open.length) return { skip: 'cota_semanal' };
  // Mais cota sobrando primeiro; nunca o mesmo formato duas vezes seguidas se houver outro; empate: o que saiu há mais tempo.
  const ordered = [...counted].sort((a, b) => new Date(a.postedAt) - new Date(b.postedAt));
  const kind = (f) => (f === 'checklist' ? 'carousel' : f);
  const lastKind = ordered.length ? kind(ordered[ordered.length - 1].format) : null;
  const lastIdx = (k) => ordered.map((h) => kind(h.format)).lastIndexOf(k);
  let pool = open.filter((k) => k !== lastKind);
  if (!pool.length) pool = open;
  pool.sort((x, y) => left[y] - left[x] || lastIdx(x) - lastIdx(y));
  const base = pool[0];

  const cutoff = now.getTime() - config.noRepeatDays * DAY;
  const recent = history.filter((h) => new Date(h.postedAt).getTime() >= cutoff);
  const fresh = scored
    .filter((t) => t.score >= config.minScore)
    .filter((t) => !recent.some((h) => similar(h.topic, t.topic)));
  if (!fresh.length) return { skip: 'sem_tema' };
  // Rodízio: nada de repetir o pilar dos 2 últimos posts nem o mesmo nicho em seguida (quando a lista permite).
  const lastPillars = ordered.slice(-2).map((h) => h.pillar).filter(Boolean);
  const lastNiche = ordered.length ? ordered[ordered.length - 1].niche : null;
  const topic = fresh.find((t) => !lastPillars.includes(t.pillar) && (!lastNiche || !t.niche || t.niche !== lastNiche))
    || fresh.find((t) => !lastPillars.includes(t.pillar))
    || fresh[0];
  // Formato: o que o pilar pede entre os que ainda cabem na semana; sem pilar (temas antigos), o da cota.
  let format = (topic.pillar && formatFor(topic.pillar, pool)) || base;
  if (!topic.pillar && format === 'carousel') {
    // Posts em várias imagens alternam: carrossel, checklist, carrossel...
    const lastStatic = ordered.filter((h) => h.format === 'carousel' || h.format === 'checklist').pop();
    if (lastStatic?.format === 'carousel') format = 'checklist';
  }
  return { topic: topic.topic, angle: topic.angle, format, pillar: topic.pillar || null, niche: topic.niche || null };
}
