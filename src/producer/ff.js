import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ProducerError } from './tts.js';

const run = promisify(execFile);
const BS = String.fromCharCode(92);

export async function loadBrand() {
  const b = JSON.parse(await readFile(new URL('../../brand/brand.json', import.meta.url), 'utf8'));
  b.fontFile = platform() === 'win32' ? b.font.file : b.font.linuxFile;
  b.logoPath = fileURLToPath(new URL('../../' + b.logo, import.meta.url));
  return b;
}

// escapa caminho para uso dentro de filtros do ffmpeg (barra e dois-pontos)
export const esc = (p) => p.split(BS).join('/').split(':').join(BS + ':');

export function wrap(text, max) {
  const lines = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.join('\n');
}

export async function ffmpeg(args, cwd) {
  try {
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { cwd });
  } catch (e) {
    throw new ProducerError(`ffmpeg falhou: ${e.stderr || e.message}`);
  }
}

export async function durationOf(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(stdout);
}

export async function textFile(dir, name, text) {
  await writeFile(`${dir}/${name}`, text);
  return name;
}

// Uma linha = um drawtext. Nunca grava quebra de linha em arquivo: versões antigas do ffmpeg desenham como um quadrado.
// `top` é uma expressão do ffmpeg para o y da primeira linha; `x` idem. Devolve os filtros drawtext.
export async function drawLines({ dir, id, text, maxChars, font, size, color, x, top, enable }) {
  const lines = wrap(text, maxChars).split('\n').filter(Boolean);
  const lh = Math.round(size * 1.3);
  const filters = [];
  for (let i = 0; i < lines.length; i++) {
    const f = await textFile(dir, `${id}-${i}.txt`, lines[i]);
    filters.push(`drawtext=fontfile='${font}':textfile=${f}:fontsize=${size}:fontcolor=0x${color}:x=${x}:y=${top}+${i * lh}:expansion=none${enable ? `:enable='${enable}'` : ''}`);
  }
  return { filters, height: lines.length * lh };
}
