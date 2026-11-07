import { readFile } from 'node:fs/promises';

// Números de resultado: porcentagens e valores em R$. Só podem aparecer nos posts se estiverem em brand/facts.json.
const NUM = /R\$\s?\d[\d.,]*|\d[\d.,]*\s?%/g;

export const normalizeNumber = (s) => s.replace(/\s+/g, '').replace(/[.,]+$/, '');
export const numbersIn = (text) => (String(text).match(NUM) || []).map(normalizeNumber);

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}

// Fatos que o dono do negócio garante serem verdadeiros: casos reais, dados com fonte e etapas do processo.
export async function loadFacts(file = new URL('../brand/facts.json', import.meta.url)) {
  let data = {};
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`brand/facts.json inválido: ${e.message}`);
  }
  const lines = [
    ...(data.cases || []).map((c) => `- Caso real: ${c.text}`),
    ...(data.stats || []).map((s) => `- Dado: ${s.text}${s.source ? ` (fonte: ${s.source})` : ''}`),
    ...(data.process || []).map((p, i) => `- Etapa ${i + 1} do processo: ${typeof p === 'string' ? p : p.text}`),
    ...(data.about || []).map((a) => `- Sobre a empresa: ${a}`),
  ];
  const allowedNumbers = new Set(strings(data).flatMap(numbersIn));
  const text = lines.length ? lines.join('\n') : 'nenhum fato cadastrado: NÃO cite resultados, porcentagens, valores em R$ nem clientes reais.';
  return { text, allowedNumbers, data };
}
