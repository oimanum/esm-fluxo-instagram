import { config } from './config.js';

// saves e shares existem em todos os formatos; visitas ao perfil só quando a API devolve.
const score = (m) => (m.profileVisits || 0) + 5 * (m.linkClicks || 0) + 3 * (m.saves || 0) + 5 * (m.shares || 0);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const hourBR = (iso) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: config.tz, hour: '2-digit', hour12: false }).format(new Date(iso)));
const METRICS = { reel: 'reach,saved,shares', carousel: 'reach,saved,shares,profile_visits' };

// Lê métricas de posts com mais de 24 h. Cliques no link não existem por mídia na API; ficam 0 aqui.
export async function collectInsights(history, ig, now = new Date(), errors = []) {
  const out = [];
  for (const h of history) {
    if (h.status !== 'posted' || !h.igMediaId) continue;
    if (now.getTime() - new Date(h.postedAt).getTime() < 86400000) continue;
    try {
      const { data } = await ig.get(`/${h.igMediaId}/insights`, { metric: METRICS[h.format] || METRICS.carousel });
      const v = (name) => data.find((d) => d.name === name)?.values?.[0]?.value ?? 0;
      out.push({
        igMediaId: h.igMediaId, topic: h.topic, format: h.format, postedAt: h.postedAt, hour: hourBR(h.postedAt),
        reach: v('reach'), saves: v('saved'), shares: v('shares'), profileVisits: v('profile_visits'), linkClicks: 0,
      });
    } catch (e) {
      errors.push(`${h.igMediaId}: ${e.message}`);
    }
  }
  return out;
}

// Move no máximo 1 post/semana do formato pior para o melhor; só com ≥2 amostras de cada e vantagem de 30%.
export function adjustPlan(plan, metrics) {
  const by = { reel: [], carousel: [] };
  for (const m of metrics) by[m.format === 'checklist' ? 'carousel' : m.format]?.push(score(m)); // checklist = post estático; post de imagem única fica fora do ajuste
  if (by.reel.length < 2 || by.carousel.length < 2) return { ...plan };
  const r = avg(by.reel), c = avg(by.carousel);
  const next = { ...plan };
  if (c > r * 1.3 && next.reel > 1) { next.reel -= 1; next.carousel += 1; }
  else if (r > c * 1.3 && next.carousel > 1) { next.carousel -= 1; next.reel += 1; }
  while (next.reel + next.carousel > 7) { if (next.reel >= next.carousel) next.reel--; else next.carousel--; }
  return next;
}

export function bestHour(metrics) {
  const byHour = {};
  for (const m of metrics) (byHour[m.hour] ||= []).push(score(m));
  const ranked = Object.entries(byHour).map(([h, s]) => [Number(h), avg(s)]).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

export function weeklyReport(metrics) {
  if (!metrics.length) return 'Sem dados suficientes ainda.';
  const ranked = [...metrics].sort((a, b) => score(b) - score(a));
  const lines = ranked.slice(0, 8).map((m, i) => `${i + 1}. [${m.format}] ${m.topic ?? m.igMediaId} — visitas ${m.profileVisits}, cliques ${m.linkClicks}, alcance ${m.reach}, salvos ${m.saves}`);
  const h = bestHour(metrics);
  return `Relatório semanal\n${lines.join('\n')}${h !== null ? `\nMelhor horário: ${h}h` : ''}`;
}
