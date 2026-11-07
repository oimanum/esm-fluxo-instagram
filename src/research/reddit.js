export function fromReddit(json) {
  const posts = json?.data?.children?.map((c) => c.data) ?? [];
  const max = Math.max(1, ...posts.map((p) => p.ups || 0));
  return posts.map((p) => ({ source: 'reddit', title: p.title, url: `https://reddit.com${p.permalink}`, strength: (p.ups || 0) / max }));
}
