// Funil do Direct: quem comenta a palavra-chave num post recebe uma resposta privada com o caminho para falar com a ESM Web.
// Regras da Meta: uma resposta privada por comentário, até 7 dias depois do comentário, só para quem comentou.

const DAY = 86400000;
const WINDOW = 7 * DAY;
const MAX_TRIES = 3;

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A palavra inteira, sem acento nem caixa: "SITE" casa com "quero um site", mas não com "website".
export function matchKeyword(text, keyword) {
  const k = escapeRe(strip(keyword));
  return new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`).test(strip(text));
}

export const renderDm = (template, link) => template.split('{link}').join(link);

export async function runFunnel({ ig, history, handled, now, cfg }) {
  const out = handled.map((h) => ({ ...h }));
  const errors = [];
  let sent = 0;
  if (!cfg.enabled) return { handled: out, sent, errors };

  const done = new Set(out.filter((h) => h.status === 'sent' || (h.status === 'failed' && h.tries >= MAX_TRIES)).map((h) => h.commentId));
  const media = history.filter((h) => h.status === 'posted' && h.igMediaId && now - new Date(h.postedAt) <= WINDOW);
  let attempts = 0;

  for (const m of media) {
    let comments = [];
    try {
      ({ data: comments } = await ig.get(`/${m.igMediaId}/comments`, { fields: 'id,text,username,timestamp', limit: '50' }));
    } catch (e) {
      errors.push(`comentários de ${m.igMediaId}: ${e.message}`);
      continue;
    }
    for (const cm of comments || []) {
      if (attempts >= cfg.maxPerRun) return { handled: out, sent, errors };
      if (done.has(cm.id) || cm.username === cfg.ownUsername) continue;
      if (now - new Date(cm.timestamp) > WINDOW) continue;
      if (!matchKeyword(cm.text, cfg.keyword)) continue;

      let row = out.find((h) => h.commentId === cm.id);
      if (!row) { row = { commentId: cm.id, mediaId: m.igMediaId, tries: 0 }; out.push(row); }
      attempts++;
      try {
        await ig.post(`/${ig.userId}/messages`, { recipient: { comment_id: cm.id }, message: { text: renderDm(cfg.dm, cfg.link) } });
        Object.assign(row, { status: 'sent', at: now.toISOString() });
        sent++;
        if (cfg.publicReply) { try { await ig.post(`/${cm.id}/replies`, { message: cfg.publicReply }); } catch { /* resposta pública é opcional */ } }
      } catch (e) {
        row.tries += 1;
        row.status = 'failed';
        errors.push(`comentário ${cm.id}: ${e.message}`);
      }
    }
  }
  return { handled: out, sent, errors };
}
