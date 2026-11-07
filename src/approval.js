import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { config } from './config.js';

// Cliente real do Telegram. Nos testes entra um objeto falso com a mesma interface.
export function createTelegram(token, chatId, fetchImpl = fetch) {
  const base = `https://api.telegram.org/bot${token}`;
  const unwrap = async (res) => {
    const j = await res.json();
    if (!j.ok) throw new Error(`Telegram: ${j.description || res.status}`);
    return j.result;
  };
  return {
    chatId,
    call: async (method, body = {}) => unwrap(await fetchImpl(`${base}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, ...body }),
    })),
    upload: async (method, fields, files) => {
      const form = new FormData();
      form.set('chat_id', String(chatId));
      for (const [k, v] of Object.entries(fields)) form.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      for (const [field, path] of Object.entries(files)) form.set(field, new Blob([await readFile(path)]), basename(path));
      return unwrap(await fetchImpl(`${base}/${method}`, { method: 'POST', body: form }));
    },
  };
}

const buttons = (id) => ({
  inline_keyboard: [[
    { text: '✅ Aprovar', callback_data: `${id}:approve` },
    { text: '✏️ Trocar tema', callback_data: `${id}:swap` },
    { text: '❌ Pular', callback_data: `${id}:skip` },
  ]],
});

const captionOf = (item) => `${item.post.caption}\n\n${item.post.hashtags.join(' ')}\n\n[${item.format}] Tema: ${item.topic}`.slice(0, 1000);

export async function sendPreview(item, tg) {
  if (item.format === 'reel') {
    const m = await tg.upload('sendVideo', { caption: captionOf(item), reply_markup: buttons(item.id), supports_streaming: 'true' }, { video: item.media[0] });
    return { messageId: m.message_id };
  }
  const files = {};
  item.media.forEach((p, i) => { files[`f${i}`] = p; });
  await tg.upload('sendMediaGroup', { media: item.media.map((_, i) => ({ type: 'photo', media: `attach://f${i}` })) }, files);
  const m = await tg.call('sendMessage', { text: `${captionOf(item)}\n\nAprovar a publicação?`, reply_markup: buttons(item.id) });
  return { messageId: m.message_id };
}

// Prazo = 11:00 (America/Sao_Paulo, UTC-3 fixo desde 2019) do dia em que o item foi criado.
export function deadlineOf(item) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: config.tz }).format(new Date(item.createdAt));
  return new Date(`${day}T${config.approvalDeadline}:00-03:00`);
}

export function expireOverdue(queue, now) {
  return queue.map((i) => (i.status === 'pending' && now > deadlineOf(i) ? { ...i, status: 'sem_resposta' } : i));
}

const NEXT = { approve: 'approved', swap: 'swap', skip: 'skipped' };

export async function pollDecisions({ tg, queue, now, offset }) {
  const updates = await tg.call('getUpdates', { offset, timeout: 0, allowed_updates: ['callback_query'] });
  const out = queue.map((i) => ({ ...i }));
  const decisions = [];
  let nextOffset = offset;
  for (const u of updates) {
    nextOffset = Math.max(nextOffset, u.update_id + 1);
    const data = u.callback_query?.data;
    if (!data) continue;
    const [id, action] = data.split(':');
    const item = out.find((i) => i.id === id);
    if (!item || !NEXT[action] || item.status !== 'pending') continue; // idempotente: só age sobre pendente
    if (now > deadlineOf(item)) { item.status = 'expired'; decisions.push({ id, action: 'expired' }); continue; }
    item.status = NEXT[action];
    decisions.push({ id, action });
  }
  return { queue: out, decisions, nextOffset };
}
