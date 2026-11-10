import { requireEnv } from './config.js';

export class LlmError extends Error {
  constructor(message, code = 'invalid') { super(message); this.name = 'LlmError'; this.code = code; }
}

// Modelos com nível gratuito, do preferido para o reserva. O Google aposenta modelos (o gemini-2.0-flash saiu em
// 01/06/2026), então um 404 passa para o próximo. GEMINI_MODEL (variável do Actions) tem prioridade.
export const FREE_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
export const modelOrder = () => [...new Set([process.env.GEMINI_MODEL, ...FREE_MODELS].filter(Boolean))];

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Devolve { obj } com a resposta válida, ou { notFound: true } se o modelo não existe (404).
async function tryModel(model, { prompt, schema, fetchImpl, retries, key, sleep }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
      if (attempt === retries) throw new LlmError(`Gemini HTTP ${res.status} (modelo ${model})`, 'http');
      await sleep(1000 * (attempt + 1)); // erro temporário do servidor: espera um pouco e tenta de novo
      continue;
    }
    try {
      const data = await res.json();
      const obj = JSON.parse(data.candidates[0].content.parts[0].text);
      if (schema(obj)) return { obj };
    } catch { /* resposta inválida: tenta de novo */ }
  }
  throw new LlmError('Gemini devolveu JSON inválido', 'invalid');
}

export async function askJson({ prompt, schema, fetchImpl = fetch, retries = 2, sleep = defaultSleep }) {
  const { GEMINI_KEY } = requireEnv(['GEMINI_KEY']);
  const tried = [];
  for (const model of modelOrder()) {
    const r = await tryModel(model, { prompt, schema, fetchImpl, retries, key: GEMINI_KEY, sleep });
    if (r.notFound) { tried.push(model); continue; }
    return r.obj;
  }
  throw new LlmError(`Nenhum modelo do Gemini respondeu (404 em: ${tried.join(', ')}). Defina a variável GEMINI_MODEL com um modelo atual.`, 'model_not_found');
}
