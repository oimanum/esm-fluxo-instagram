import { config } from './config.js';

const RUBRIC = `Você é estrategista de conteúdo da ESM Web (sites e landing pages para clínicas, advogados, estética e energia solar).
Dos sinais abaixo, proponha até 8 temas para Instagram em pt-BR. Dê nota 0-10 = força da tendência × aderência ao nicho (dor de dono de negócio local: agendamento, anúncios, site lento, Google Meu Negócio, WhatsApp, IA no atendimento) × potencial de gerar cliente.
Dê preferência a temas que façam o dono do negócio sentir que PRECISA de um site: cliente que pesquisa no Google e não acha a empresa, só Instagram não basta, site lento, parecer menos confiável sem site, concorrente que aparece primeiro. Ligue a tendência a essa dor.
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
  let format = pool[0];
  // Posts em várias imagens alternam: carrossel, checklist, carrossel...
  if (format === 'carousel') {
    const lastStatic = ordered.filter((h) => h.format === 'carousel' || h.format === 'checklist').pop();
    if (lastStatic?.format === 'carousel') format = 'checklist';
  }

  const cutoff = now.getTime() - config.noRepeatDays * DAY;
  const recent = history.filter((h) => new Date(h.postedAt).getTime() >= cutoff);
  const topic = scored
    .filter((t) => t.score >= config.minScore)
    .find((t) => !recent.some((h) => similar(h.topic, t.topic)));
  if (!topic) return { skip: 'sem_tema' };
  return { topic: topic.topic, angle: topic.angle, format };
}
