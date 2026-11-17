import { netFetch } from './net.js';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { config } from './config.js';

// Cliente real do Telegram. Nos testes entra um objeto falso com a mesma interface.
export function createTelegram(token, chatId, fetchImpl = netFetch) {
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

const headerOf = (item) => `[${item.format}] Tema: ${item.topic}${item.status === 'dry' ? ' — TESTE' : ''}`;

// Mídia primeiro (legenda curta), depois uma mensagem com a legenda COMPLETA e os botões.
export async function sendPreview(item, tg) {
  const dry = item.status === 'dry';
  if (item.format === 'reel') {
    await tg.upload('sendVideo', { caption: headerOf(item), supports_streaming: 'true' }, { video: item.media[0] });
  } else if (item.media.length === 1) {
    await tg.upload('sendPhoto', { caption: headerOf(item) }, { photo: item.media[0] });
  } else {
    const files = {};
    item.media.forEach((p, i) => { files[`f${i}`] = p; });
    await tg.upload('sendMediaGroup', { media: item.media.map((_, i) => ({ type: 'photo', media: `attach://f${i}` })) }, files);
  }
  if (item.story?.media?.length) {
    const m = item.story.media;
    if (m.length === 1) await tg.upload('sendPhoto', { caption: 'Stories que saem junto' }, { photo: m[0] });
    else {
      const files = {};
      m.forEach((p, i) => { files[`s${i}`] = p; });
      await tg.upload('sendMediaGroup', { media: m.map((_, i) => ({ type: 'photo', media: `attach://s${i}`, ...(i === 0 ? { caption: 'Stories que saem junto' } : {}) })) }, files);
    }
  }
  const body = `${item.post.caption}

${item.post.hashtags.join(' ')}`.slice(0, 3800);
  const text = dry
    ? `TESTE — não será publicado.

${headerOf(item)}

${body}`
    : `${headerOf(item)}

${body}

Aprovar a publicação?`;
  const m = await tg.call('sendMessage', dry ? { text } : { text, reply_markup: buttons(item.id) });
  return { messageId: m.message_id };
}

// Prazo = config.approvalDeadline (21:00, America/Sao_Paulo, UTC-3 fixo desde 2019) do dia em que o item foi criado.
export function deadlineOf(item) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: config.tz }).format(new Date(item.createdAt));
  return new Date(`${day}T${config.approvalDeadline}:00-03:00`);
}

// Prazo efetivo = prazo + tolerância (config.approvalGraceMin).
const cutoffOf = (item) => new Date(deadlineOf(item).getTime() + config.approvalGraceMin * 60000);

export function expireOverdue(queue, now) {
  return queue.map((i) => (i.status === 'pending' && now > cutoffOf(i) ? { ...i, status: 'sem_resposta' } : i));
}

const NEXT = { approve: 'approved', swap: 'swap', skip: 'skipped' };
// Resposta que aparece no Telegram assim que o botão é tocado (também faz o círculo de "carregando" parar).
const ANSWER = { approve: '✅ Aprovado! Publicando…', swap: '✏️ Trocando o tema…', skip: '❌ Pulado: nada será postado.' };
const STALE = { approved: 'Já aprovado, publicando.', publishing: 'Já está sendo publicado.', posted: 'Esse post já foi publicado.', skipped: 'Esse post já foi pulado.', swapped: 'Esse tema já foi trocado.', swap: 'A troca de tema já foi pedida.', expired: 'O prazo desse post acabou.', sem_resposta: 'O prazo desse post acabou.', failed: 'A publicação desse post falhou.', uncertain: 'Confira no Instagram se esse post saiu.' };

export const isOverdue = (item, now) => now > cutoffOf(item);

// Lê os toques nos botões. timeout > 0 faz o Telegram segurar a conexão até chegar um toque (resposta em segundos).
// Devolve também `answers`: o texto de resposta de cada toque, para o bot responder e tirar o "carregando".
export async function pollDecisions({ tg, queue, now, offset, timeout = 0 }) {
  const updates = await tg.call('getUpdates', { offset, timeout, allowed_updates: ['callback_query'] });
  const out = queue.map((i) => ({ ...i }));
  const decisions = [];
  const answers = [];
  let nextOffset = offset;
  for (const u of updates) {
    nextOffset = Math.max(nextOffset, u.update_id + 1);
    const cq = u.callback_query;
    const data = cq?.data;
    if (!data) continue;
    const [id, action] = data.split(':');
    const item = out.find((i) => i.id === id);
    // Prévia que o sistema não reconhece, já decidida ou vencida: janela de aviso (não só um balãozinho) e os botões saem da mensagem.
    const dead = (text) => answers.push({ id: cq.id, text, alert: true, messageId: cq.message?.message_id });
    if (!item || !NEXT[action]) { dead('Esta prévia não está mais ativa (foi substituída por outra). Use a prévia mais recente.'); continue; }
    if (item.status !== 'pending') { dead(STALE[item.status] || 'Esse post já foi tratado.'); continue; } // idempotente: só age sobre pendente
    if (now > cutoffOf(item)) { item.status = 'expired'; decisions.push({ id, action: 'expired' }); dead('O prazo acabou: nada foi postado.'); continue; }
    item.status = NEXT[action];
    decisions.push({ id, action });
    answers.push({ id: cq.id, text: ANSWER[action] });
  }
  return { queue: out, decisions, nextOffset, answers };
}
