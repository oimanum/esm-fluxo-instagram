import { mkdir } from 'node:fs/promises';
import { loadState, saveState } from './state.js';
import { config, sanitize } from './config.js';
import { scoreTopics, pickToday } from './strategy.js';
import { writePost } from './writer.js';
import { checkPost } from './safety.js';
import { loadFacts } from './facts.js';
import { sendPreview, pollDecisions, expireOverdue } from './approval.js';

const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: config.tz }).format(new Date(d));
const ACTIVE = ['pending', 'approved', 'publishing', 'posted'];

// Alerta que nunca derruba o fluxo: falha do Telegram não pode mudar o resultado de um publish.
const safeAlert = (d) => async (text) => { try { await d.alert(sanitize(text)); } catch { /* sem canal de aviso */ } };
const checkpoint = (d) => (d.checkpoint ? d.checkpoint() : Promise.resolve());

async function writeChecked({ topic, angle, format, llm, facts }) {
  let problems = [];
  for (let i = 0; i < 3; i++) {
    const post = await writePost({ topic, angle, format, llm, facts });
    const check = checkPost(post, format, {
      allowedNumbers: facts.allowedNumbers,
      keyword: config.funnel.enabled ? config.funnel.keyword : undefined,
      socialProof: (facts.data?.cases?.length ?? 0) > 0,
    });
    if (check.ok) return post;
    problems = check.problems;
  }
  throw new Error(`A checagem barrou o post: ${problems.join('; ')}`);
}

// Gera o conteúdo do dia e manda a prévia. Com dry, a prévia sai como TESTE, sem botões. Nada é publicado aqui.
export async function generate(d) {
  const alert = safeAlert(d);
  try {
    const queue = await loadState('queue');
    if (!d.scored && !d.dry && queue.some((i) => ymd(i.createdAt) === ymd(d.now) && ACTIVE.includes(i.status))) {
      return { status: 'skipped', reason: 'ja_gerado_hoje' };
    }
    const history = await loadState('history');
    let scored = d.scored;
    if (!scored) {
      const signals = await d.collect();
      if (!signals.length) {
        await alert('Hoje não vou postar: nenhuma fonte de pesquisa respondeu (sem_sinais).');
        return { status: 'skipped', reason: 'sem_sinais' };
      }
      scored = await scoreTopics(signals, d.llm);
    }
    const pool = scored.filter((t) => !(d.exclude || []).includes(t.topic));
    const pick = pickToday({ scored: pool, history, now: d.now, plan: d.plan });
    if (pick.skip) {
      await alert(`Hoje não vou postar (${pick.skip}).`);
      return { status: 'skipped', reason: pick.skip };
    }
    const facts = d.facts ?? await loadFacts();
    const post = await writeChecked({ topic: pick.topic, angle: pick.angle, format: pick.format, llm: d.llm, facts });
    const id = d.newId();
    const outDir = `out/${id}`;
    await mkdir(outDir, { recursive: true });
    const media = pick.format === 'reel' ? [(await d.render.reel(post, outDir)).path] : (await d.render[pick.format](post, outDir)).paths;
    // Stories do dia, derivados do post. Se não saírem, o post principal segue sem eles.
    let story;
    if (d.render.story) {
      try { story = { media: (await d.render.story(post, outDir, { format: pick.format })).paths }; } catch (e) { await alert(`Os stories de hoje não saíram (${e.message}); o post segue normal.`); }
    }
    const item = {
      id, topic: pick.topic, angle: pick.angle, format: pick.format, post, media, status: d.dry ? 'dry' : 'pending',
      createdAt: d.now.toISOString(), alternatives: pool.filter((t) => t.topic !== pick.topic), release: null, ...(story ? { story } : {}),
    };
    // A mídia precisa sobreviver até o workflow de aprovação: sobe para um release em rascunho (não público).
    if (d.stage) item.release = await d.stage(item);
    await saveState('queue', [...queue, item]);
    item.messageId = (await sendPreview(item, d.tg)).messageId;
    await saveState('queue', [...queue, item]);
    return item;
  } catch (e) {
    await alert(`Erro ao gerar o post do dia: ${e.message}`);
    return { status: 'error', error: sanitize(e.message) };
  }
}

// Lê as decisões do Telegram, publica o que foi aprovado e marca prazo e troca de tema.
export async function poll(d) {
  const alert = safeAlert(d);
  let queue = await loadState('queue');

  // Item que ficou em "publishing" é uma execução interrompida no meio: não sabemos se saiu. Nunca republicar.
  for (const i of queue) {
    if (i.status === 'publishing') {
      i.status = 'uncertain';
      await alert(`Confira no Instagram: "${i.topic}" estava sendo publicado quando a execução foi interrompida. Não vou tentar de novo.`);
    }
  }

  // Primeiro lê os cliques, depois expira: assim uma aprovação dada no limite não é descartada.
  const offset = (await loadState('tgoffset'))[0] ?? 0;
  const r = await pollDecisions({ tg: d.tg, queue, now: d.now, offset, timeout: d.pollTimeout ?? 0 });
  queue = r.queue;
  // O bot responde a cada toque (para o "carregando" parar) e tira os botões do que já foi decidido.
  for (const a of r.answers || []) {
    try { await d.tg.call('answerCallbackQuery', { callback_query_id: a.id, text: a.text, ...(a.alert ? { show_alert: true } : {}) }); } catch { /* o toque já expirou no Telegram */ }
    if (a.messageId) { try { await d.tg.call('editMessageReplyMarkup', { message_id: a.messageId, reply_markup: { inline_keyboard: [] } }); } catch { /* mensagem antiga ou já editada */ } }
  }
  for (const dec of r.decisions) {
    const it = queue.find((i) => i.id === dec.id);
    if (it?.messageId) { try { await d.tg.call('editMessageReplyMarkup', { message_id: it.messageId, reply_markup: { inline_keyboard: [] } }); } catch { /* mensagem antiga ou já editada */ } }
  }
  const prev = new Map(queue.map((i) => [i.id, i.status]));
  queue = expireOverdue(queue, d.now);
  for (const i of queue) {
    if (prev.get(i.id) === 'pending' && i.status === 'sem_resposta') await alert(`Sem resposta até as ${config.approvalDeadline}: "${i.topic}" não foi postado.`);
  }
  await saveState('tgoffset', [r.nextOffset]);
  await saveState('queue', queue);
  await checkpoint(d); // aprovação e offset ficam gravados antes de qualquer publicação

  const history = await loadState('history');
  for (const item of queue) {
    if (item.status !== 'approved' || d.dry) continue;
    item.status = 'publishing';
    await saveState('queue', queue);
    await checkpoint(d); // se a execução morrer daqui em diante, o próximo poll vê "publishing" e não republica
    try {
      const urls = await d.release(item);
      const { igMediaId } = await d.publish({ ...item, status: 'approved' }, urls.slice(0, item.media.length), d.ig);
      Object.assign(item, { status: 'posted', igMediaId, postedAt: d.now.toISOString() });
      history.push({ id: item.id, topic: item.topic, format: item.format, postedAt: item.postedAt, status: 'posted', igMediaId });
      await saveState('history', history);
      await saveState('queue', queue);
      await checkpoint(d);
      await alert(`Publicado: "${item.topic}" (${item.format}).`);
      // Stories depois do post. Falha aqui não desfaz nem repete o post principal.
      const storyUrls = urls.slice(item.media.length);
      if (storyUrls.length && d.publishStories) {
        try {
          const ids = await d.publishStories(storyUrls, d.ig);
          item.storiesPosted = ids.length;
          await saveState('queue', queue);
          await checkpoint(d);
          await alert(`Stories publicados: ${ids.length}.`);
        } catch (e) {
          await alert(`O post saiu, mas os stories falharam: ${e.message}`);
        }
      }
    } catch (e) {
      item.status = 'failed';
      await saveState('queue', queue);
      await alert(`Falha ao publicar "${item.topic}": ${e.message}`);
    }
  }
  await checkpoint(d);
  return { decisions: r.decisions, answers: r.answers || [], swaps: queue.filter((i) => i.status === 'swap').length };
}

// "Trocar tema": renderiza em outro job (com ffmpeg e voz instalados), usando o segundo melhor tema.
export async function processSwaps(d) {
  const queue = await loadState('queue');
  const swaps = queue.filter((i) => i.status === 'swap');
  for (const item of swaps) item.status = 'swapped';
  await saveState('queue', queue);
  for (const item of swaps) await generate({ ...d, scored: item.alternatives, exclude: [item.topic] });
  await checkpoint(d);
  return swaps.length;
}
