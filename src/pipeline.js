import { mkdir } from 'node:fs/promises';
import { loadState, saveState } from './state.js';
import { config } from './config.js';
import { scoreTopics, pickToday } from './strategy.js';
import { writePost } from './writer.js';
import { checkPost } from './safety.js';
import { sendPreview, pollDecisions, expireOverdue } from './approval.js';

const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: config.tz }).format(new Date(d));
const ACTIVE = ['pending', 'approved', 'posted'];

async function writeChecked({ topic, angle, format, llm }) {
  let problems = [];
  for (let i = 0; i < 3; i++) {
    const post = await writePost({ topic, angle, format, llm });
    const check = checkPost(post, format);
    if (check.ok) return post;
    problems = check.problems;
  }
  throw new Error(`A checagem barrou o post: ${problems.join('; ')}`);
}

// Gera o conteúdo do dia e manda a prévia. Qualquer erro vira alerta; nada é publicado aqui.
export async function generate(d) {
  try {
    const queue = await loadState('queue');
    if (!d.scored && queue.some((i) => ymd(i.createdAt) === ymd(d.now) && ACTIVE.includes(i.status))) {
      return { status: 'skipped', reason: 'ja_gerado_hoje' };
    }
    const history = await loadState('history');
    const scored = d.scored ?? await scoreTopics(await d.collect(), d.llm);
    const pool = scored.filter((t) => !(d.exclude || []).includes(t.topic));
    const pick = pickToday({ scored: pool, history, now: d.now, plan: d.plan });
    if (pick.skip) {
      await d.alert(`Hoje não vou postar (${pick.skip}).`);
      return { status: 'skipped', reason: pick.skip };
    }
    const post = await writeChecked({ topic: pick.topic, angle: pick.angle, format: pick.format, llm: d.llm });
    const id = d.newId();
    const outDir = `out/${id}`;
    await mkdir(outDir, { recursive: true });
    const media = pick.format === 'reel' ? [(await d.render.reel(post, outDir)).path] : (await d.render.carousel(post, outDir)).paths;
    const item = {
      id, topic: pick.topic, angle: pick.angle, format: pick.format, post, media, status: 'pending',
      createdAt: d.now.toISOString(), alternatives: pool.filter((t) => t.topic !== pick.topic),
    };
    await saveState('queue', [...queue, item]);
    item.messageId = (await sendPreview(item, d.tg)).messageId;
    await saveState('queue', [...queue, item]);
    return item;
  } catch (e) {
    await d.alert(`Erro ao gerar o post do dia: ${e.message}`);
    return { status: 'error', error: e.message };
  }
}

// Lê as decisões do Telegram, publica o que foi aprovado e trata prazo e troca de tema.
export async function poll(d) {
  let queue = await loadState('queue');
  const prev = new Map(queue.map((i) => [i.id, i.status]));
  queue = expireOverdue(queue, d.now);
  for (const i of queue) if (prev.get(i.id) === 'pending' && i.status === 'sem_resposta') await d.alert(`Sem resposta até as ${config.approvalDeadline}: "${i.topic}" não foi postado.`);

  const offset = (await loadState('tgoffset'))[0] ?? 0;
  const r = await pollDecisions({ tg: d.tg, queue, now: d.now, offset });
  queue = r.queue;
  await saveState('tgoffset', [r.nextOffset]);
  await saveState('queue', queue);

  const history = await loadState('history');
  for (const item of queue) {
    if (item.status === 'approved' && !d.dry) {
      try {
        const urls = await d.upload(item.media, { tag: `post-${item.id}` });
        const { igMediaId } = await d.publish(item, urls, d.ig);
        Object.assign(item, { status: 'posted', igMediaId, postedAt: d.now.toISOString() });
        history.push({ id: item.id, topic: item.topic, format: item.format, postedAt: item.postedAt, status: 'posted', igMediaId });
        await d.alert(`Publicado: "${item.topic}" (${item.format}).`);
      } catch (e) {
        item.status = 'failed';
        await d.alert(`Falha ao publicar "${item.topic}": ${e.message}`);
      }
    }
  }
  const swaps = queue.filter((i) => i.status === 'swap');
  for (const item of swaps) item.status = 'swapped';
  await saveState('history', history);
  await saveState('queue', queue);

  for (const item of swaps) {
    await generate({ ...d, scored: item.alternatives, exclude: [item.topic] });
  }
  return { decisions: r.decisions };
}
