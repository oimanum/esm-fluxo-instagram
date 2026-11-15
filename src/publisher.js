// Instagram API: por padrão o Unified login (graph.facebook.com, token de usuário do sistema que não expira). Para um token do Instagram Login, defina IG_GRAPH_BASE=https://graph.instagram.com/v27.0.
export const GRAPH_BASE = process.env.IG_GRAPH_BASE || 'https://graph.facebook.com/v27.0';

export function createInstagram(token, userId, fetchImpl = fetch) {
  const unwrap = async (res) => {
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(`Instagram: ${j.error?.message || res.status}`);
    return j;
  };
  return {
    userId,
    post: async (path, params) => unwrap(await fetchImpl(`${GRAPH_BASE}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(params),
    })),
    get: async (path, params = {}) => unwrap(await fetchImpl(`${GRAPH_BASE}${path}?${new URLSearchParams(params)}`, {
      headers: { authorization: `Bearer ${token}` },
    })),
  };
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fullCaption = (item) => `${item.post.caption}\n\n${item.post.hashtags.join(' ')}`.trim();

export async function waitFinished(ig, id, sleep, maxPolls = 40) {
  for (let i = 0; i < maxPolls; i++) {
    const { status_code } = await ig.get(`/${id}`, { fields: 'status_code' });
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram: processamento terminou em ${status_code}`);
    await sleep(5000);
  }
  throw new Error('Instagram: tempo esgotado aguardando o processamento da mídia');
}

export async function publish(item, urls, ig, { sleep = defaultSleep } = {}) {
  if (item.status !== 'approved') throw new Error('Item não aprovado: publicação recusada');
  const u = ig.userId || 'me';
  let creationId;
  if (item.format === 'reel') {
    ({ id: creationId } = await ig.post(`/${u}/media`, { media_type: 'REELS', video_url: urls[0], caption: fullCaption(item), share_to_feed: true }));
  } else if (item.format === 'checklist' || item.format === 'post') {
    ({ id: creationId } = await ig.post(`/${u}/media`, { image_url: urls[0], caption: fullCaption(item) }));
  } else {
    const kids = [];
    for (const url of urls) kids.push((await ig.post(`/${u}/media`, { image_url: url, is_carousel_item: true })).id);
    for (const k of kids) await waitFinished(ig, k, sleep);
    ({ id: creationId } = await ig.post(`/${u}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption: fullCaption(item) }));
  }
  await waitFinished(ig, creationId, sleep);
  return { igMediaId: await mediaPublish(ig, u, creationId, sleep) };
}

async function mediaPublish(ig, u, creationId, sleep) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { id } = await ig.post(`/${u}/media_publish`, { creation_id: creationId });
      return id;
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await sleep(10000 * attempt);
    }
  }
  throw lastErr;
}

// Stories: cada quadro é uma mídia STORIES publicada em sequência. Devolve os ids que saíram.
export async function publishStories(urls, ig, { sleep = defaultSleep } = {}) {
  const u = ig.userId || 'me';
  const ids = [];
  for (const url of urls) {
    const { id: creationId } = await ig.post(`/${u}/media`, { media_type: 'STORIES', image_url: url });
    await waitFinished(ig, creationId, sleep);
    ids.push(await mediaPublish(ig, u, creationId, sleep));
  }
  return ids;
}
