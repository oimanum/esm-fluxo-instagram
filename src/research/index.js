import { parseRss } from './rss.js';
import { fromReddit } from './reddit.js';
import { fromCompetitors, fetchCompetitor } from './competitors.js';

const NEWS_Q = encodeURIComponent('marketing digital OR site para clínica OR inteligência artificial negócios');
const text = async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); };
const json = async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

export async function collectSignals({ fetchImpl = fetch, competitors = [] }) {
  const jobs = [
    async () => parseRss(await text(await fetchImpl('https://trends.google.com/trending/rss?geo=BR')), 'google-trends'),
    async () => parseRss(await text(await fetchImpl(`https://news.google.com/rss/search?q=${NEWS_Q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`)), 'news'),
    async () => fromReddit(await json(await fetchImpl('https://www.reddit.com/r/marketing/top.json?t=day&limit=15'))),
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
