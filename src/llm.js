import { requireEnv } from './config.js';

export class LlmError extends Error {
  constructor(message, code = 'invalid') { super(message); this.name = 'LlmError'; this.code = code; }
}

const MODEL = 'gemini-2.0-flash';

export async function askJson({ prompt, schema, fetchImpl = fetch, retries = 2 }) {
  const { GEMINI_KEY } = requireEnv(['GEMINI_KEY']);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (res.status === 429) throw new LlmError('Limite do Gemini atingido', 'rate_limit');
    if (!res.ok) { if (attempt === retries) throw new LlmError(`Gemini HTTP ${res.status}`, 'http'); continue; }
    try {
      const data = await res.json();
      const obj = JSON.parse(data.candidates[0].content.parts[0].text);
      if (schema(obj)) return obj;
    } catch { /* tenta de novo */ }
  }
  throw new LlmError('Gemini devolveu JSON inválido', 'invalid');
}
