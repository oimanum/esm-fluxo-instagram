// Gera a mesma frase em várias vozes (Gemini e Edge) para você ouvir e escolher. Usa GEMINI_KEY do ambiente.
import { mkdir, writeFile } from 'node:fs/promises';
import { synthGemini, synthEdge } from '../src/producer/tts.js';
import { config } from '../src/config.js';

const TEXT = 'Muita gente pesquisa no Google antes de escolher quem contratar. Se o seu negócio não aparece, ou o site demora a abrir, esse cliente vai para o concorrente. Teste agora: pesquise o seu negócio, pelo celular.';
const VOICES = ['Sulafat', 'Aoede', 'Achird', 'Zubenelgenubi', 'Charon', 'Orus', 'Algieba', 'Puck'];
const MODELS = [config.voice.model, 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'];
const key = process.env.GEMINI_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];

await mkdir('out/voices', { recursive: true });

let model = null;
for (const voice of VOICES) {
  const candidates = model ? [model] : MODELS;
  let done = false;
  for (const m of candidates) {
    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      try {
        await synthGemini(TEXT, `out/voices/gemini-${voice}.mp3`, { key, cfg: { ...config.voice, model: m, name: voice } });
        model = m;
        done = true;
        report.push(`OK   gemini ${voice} (modelo ${m})`);
      } catch (e) {
        const msg = String(e.message).replaceAll(key || '\u0000', '***');
        report.push(`FALHA gemini ${voice} (modelo ${m}) tentativa ${attempt + 1}: ${msg}`);
        if (/429/.test(msg)) await sleep(35000); else break; // limite por minuto: espera e tenta de novo; outros erros: próximo modelo
      }
    }
    if (done) break;
  }
  await sleep(8000);
}

for (const v of ['pt-BR-AntonioNeural', 'pt-BR-FranciscaNeural', 'pt-BR-ThalitaMultilingualNeural']) {
  try { await synthEdge(TEXT, `out/voices/edge-${v}.mp3`, { voice: v }); report.push(`OK   edge ${v}`); } catch (e) { report.push(`FALHA edge ${v}: ${e.message}`); }
}

await writeFile('out/voices/relatorio.txt', report.join('\n') + `\n\nmodelo do Gemini que funcionou: ${model ?? 'nenhum'}\n`);
console.log(report.join('\n'));
console.log('modelo que funcionou:', model ?? 'nenhum');
