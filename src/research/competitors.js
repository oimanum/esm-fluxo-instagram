export function fromCompetitors(json) {
  const media = json?.business_discovery?.media?.data ?? [];
  const eng = (m) => (m.like_count || 0) + 3 * (m.comments_count || 0);
  const max = Math.max(1, ...media.map(eng));
  return media.map((m) => ({ source: 'competitors', title: (m.caption || '').slice(0, 140), url: m.permalink, strength: eng(m) / max }));
}

export async function fetchCompetitor(username, { token, userId, fetchImpl }) {
  const fields = `business_discovery.username(${username}){media.limit(25){caption,like_count,comments_count,permalink,timestamp}}`;
  const res = await fetchImpl(`https://graph.facebook.com/v21.0/${userId}?fields=${encodeURIComponent(fields)}&access_token=${token}`);
  return res.json();
}
