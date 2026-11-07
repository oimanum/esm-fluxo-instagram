import { config } from './config.js';

const RUBRIC = `Você é estrategista de conteúdo da ESM Web (sites e landing pages para clínicas, advogados, estética e energia solar).
Dos sinais abaixo, proponha até 8 temas para Instagram em pt-BR. Dê nota 0-10 = força da tendência × aderência ao nicho (dor de dono de negócio local: agendamento, anúncios, site lento, Google Meu Negócio, WhatsApp, IA no atendimento) × potencial de gerar cliente.
Responda JSON: {"topics":[{"topic":string,"score":number,"angle":string}]}.`;

export async function scoreTopics(signals, llm) {
  const list = signals.slice(0, 40).map((s) => `- [${s.source}] ${s.title}`).join('\n');
  const out = await llm({
    prompt: `${RUBRIC}\n\nSINAIS:\n${list}`,
    schema: (o) => Array.isArray(o?.topics) && o.topics.every((t) => typeof t.topic === 'string' && typeof t.score === 'number'),
  });
  return [...out.topics].sort((a, b) => b.score - a.score);
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
  const used = { reel: 0, carousel: 0 };
  for (const h of counted) if (ymd(new Date(h.postedAt)) >= ws && ymd(new Date(h.postedAt)) <= ymd(now)) used[h.format]++;
  const left = { reel: plan.reel - used.reel, carousel: plan.carousel - used.carousel };
  if (left.reel <= 0 && left.carousel <= 0) return { skip: 'cota_semanal' };
  const format = left.reel > 0 && left.reel >= left.carousel ? 'reel' : left.carousel > 0 ? 'carousel' : 'reel';

  const cutoff = now.getTime() - config.noRepeatDays * DAY;
  const recent = history.filter((h) => new Date(h.postedAt).getTime() >= cutoff);
  const topic = scored
    .filter((t) => t.score >= config.minScore)
    .find((t) => !recent.some((h) => similar(h.topic, t.topic)));
  if (!topic) return { skip: 'sem_tema' };
  return { topic: topic.topic, angle: topic.angle, format };
}
