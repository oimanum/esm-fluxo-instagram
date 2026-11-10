import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, rm } from 'node:fs/promises';
import { config } from '../config.js';

const run = promisify(execFile);

export class ProducerError extends Error {
  constructor(m) { super(m); this.name = 'ProducerError'; }
}

const mask = (msg, key) => (key && key.length >= 8 ? String(msg).split(key).join('***') : String(msg));

// Procura o áudio (base64) em qualquer ponto da resposta, sem depender do formato exato do JSON.
function findAudio(node) {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.data === 'string' && node.data.length > 100 && (node.type === 'audio' || /audio/i.test(node.mime_type || node.mimeType || ''))) return node.data;
  if (node.inlineData?.data || node.inline_data?.data) return node.inlineData?.data || node.inline_data.data;
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const found = findAudio(v);
    if (found) return found;
  }
  return null;
}

// Voz do Gemini (Interactions API): estilo pedido em linguagem natural. Devolve um mp3 em outPath.
export async function synthGemini(text, outPath, { fetchImpl = fetch, key, cfg }) {
  const res = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      model: cfg.model,
      input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: cfg.style }] }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: cfg.name }] },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = findAudio(await res.json());
  if (!data) throw new Error('a resposta veio sem áudio');
  const buf = Buffer.from(data, 'base64');
  const isWav = buf.subarray(0, 4).toString('latin1') === 'RIFF';
  const src = `${outPath}.src.${isWav ? 'wav' : 'pcm'}`; // sem cabeçalho = PCM 16 bits, 24 kHz, mono
  await writeFile(src, buf);
  try {
    const args = isWav ? ['-i', src] : ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', src];
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args, '-ac', '1', '-b:a', '128k', outPath]);
  } finally {
    await rm(src, { force: true });
  }
}

// Voz neural da Microsoft (edge-tts): é a reserva.
export async function synthEdge(text, outPath, { cmd = 'python', voice = 'pt-BR-AntonioNeural' } = {}) {
  try {
    await run(cmd, ['-m', 'edge_tts', '--voice', voice, '--rate', '+8%', '--text', text, '--write-media', outPath]);
  } catch (e) {
    throw new ProducerError(`Falha na locução: ${e.message}`);
  }
}

// Tenta a voz do Gemini; qualquer erro (limite, 403, instabilidade, resposta vazia) cai para a voz Edge.
export async function synth(text, outPath, { cmd, voice, fetchImpl = fetch, geminiKey = process.env.GEMINI_KEY, cfg = config.voice, edgeImpl } = {}) {
  const edge = edgeImpl || ((t, o) => synthEdge(t, o, { cmd, voice: voice || cfg.edge }));
  let geminiError;
  if (cfg.engine === 'gemini' && geminiKey) {
    try {
      await synthGemini(text, outPath, { fetchImpl, key: geminiKey, cfg });
      return { engine: 'gemini' };
    } catch (e) {
      geminiError = mask(e.message, geminiKey);
    }
  }
  try {
    await edge(text, outPath);
    return { engine: 'edge', geminiError };
  } catch (e) {
    const why = geminiError ? ` (Gemini: ${geminiError}; reserva Edge: ${mask(e.message, geminiKey)})` : `: ${mask(e.message, geminiKey)}`;
    throw new ProducerError(`Falha na locução${why}`);
  }
}
