import { parseRss } from './rss.js';
import { fromCompetitors, fetchCompetitor } from './competitors.js';

// Buscas de notícia por nicho (pt-BR). Cada uma vira uma fonte independente.
const NEWS_QUERIES = [
  'marketing digital OR inteligência artificial pequenas empresas',
  'clínica OR consultório marketing OR agendamento online OR Google Meu Negócio',
  'advogado OR escritório de advocacia marketing jurídico',
  'estética OR clínica estética redes sociais OR anúncios',
  'energia solar vendas OR leads OR marketing',
];
const text = async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); };

export async function collectSignals({ fetchImpl = fetch, competitors = [] }) {
  const jobs = [
    async () => parseRss(await text(await fetchImpl('https://trends.google.com/trending/rss?geo=BR')), 'google-trends'),
    ...NEWS_QUERIES.map((q) => async () => parseRss(
      await text(await fetchImpl(`https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:2d')}&hl=pt-BR&gl=BR&ceid=BR:pt-419`)), 'news',
    ).slice(0, 8)),
    ...competitors.map((c) => async () => {
      const { IG_TOKEN, IG_USER_ID } = process.env;
      if (!IG_TOKEN || !IG_USER_ID) return [];
      return fromCompetitors(await fetchCompetitor(c, { token: IG_TOKEN, userId: IG_USER_ID, fetchImpl }));
    }),
  ];
  const results = await Promise.allSettled(jobs.map((j) => j()));
  return results.flatMap((r) => {
    if (r.status === 'fulfilled') return r.value;
    console.warn('fonte de pesquisa falhou:', r.reason?.message);
    return [];
  });
}
