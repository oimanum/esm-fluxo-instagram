import { netFetch } from './net.js';
import { requireEnv } from './config.js';

export class LlmError extends Error {
  constructor(message, code = 'invalid') { super(message); this.name = 'LlmError'; this.code = code; }
}

// Modelos com nível gratuito, do preferido para o reserva. O Google aposenta modelos (o gemini-2.0-flash saiu em
// 01/06/2026), então um 404 passa para o próximo. GEMINI_MODEL (variável do Actions) tem prioridade.
export const FREE_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
export const modelOrder = () => [...new Set([process.env.GEMINI_MODEL, ...FREE_MODELS].filter(Boolean))];

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BACKOFF_MS = [2000, 6000, 12000];

// Devolve { obj } com a resposta válida, ou { notFound: true } se o modelo não existe (404).
async function tryModel(model, { prompt, schema, fetchImpl, retries, key, sleep }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let reason = 'sem resposta';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (res.status === 404) return { notFound: true };
    if (res.status === 429) throw new LlmError('Limite do Gemini atingido', 'rate_limit');
    if (!res.ok) {
      // 5xx = servidor sobrecarregado ou instável: espera mais a cada tentativa; esgotadas, passa para o próximo modelo.
      if (res.status < 500) throw new LlmError(`Gemini HTTP ${res.status} (modelo ${model})`, 'http');
      if (attempt === retries) return { overloaded: res.status };
      await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS.at(-1));
      continue;
    }
    try {
      const data = await res.json();
      const cand = data.candidates?.[0];
      try {
        const obj = JSON.parse(cand.content.parts[0].text);
        if (schema(obj)) return { obj };
        reason = `faltam campos (veio: ${Object.keys(obj || {}).join(', ') || 'nada'})`;
      } catch {
        reason = `JSON quebrado (${cand?.finishReason || 'sem motivo'})`;
      }
    } catch { reason = 'resposta ilegível'; }
    console.warn(`Gemini ${model}: resposta inválida na tentativa ${attempt + 1}: ${reason}`);
  }
  // Resposta inválida em todas as tentativas deste modelo: passa para o próximo modelo.
  return { invalid: reason };
}

export async function askJson({ prompt, schema, fetchImpl = netFetch, retries = 2, sleep = defaultSleep }) {
  const { GEMINI_KEY } = requireEnv(['GEMINI_KEY']);
  const tried = [];
  const overloaded = [];
  const invalid = [];
  for (const model of modelOrder()) {
    const r = await tryModel(model, { prompt, schema, fetchImpl, retries, key: GEMINI_KEY, sleep });
    if (r.notFound) { tried.push(model); continue; }
    if (r.overloaded) { overloaded.push(`${model} (HTTP ${r.overloaded})`); continue; }
    if (r.invalid) { invalid.push(`${model}: ${r.invalid}`); continue; }
    return r.obj;
  }
  if (invalid.length && !overloaded.length && !tried.length) throw new LlmError(`Gemini devolveu JSON inválido (${invalid.join('; ')})`, 'invalid');
  if (overloaded.length) {
    throw new LlmError(`Gemini sobrecarregado no momento (${overloaded.join(', ')}). É temporário: rode de novo em alguns minutos.`, 'overloaded');
  }
  throw new LlmError(`Nenhum modelo do Gemini respondeu (404 em: ${tried.join(', ')}). Defina a variável GEMINI_MODEL com um modelo atual.`, 'model_not_found');
}
