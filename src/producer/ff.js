import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ProducerError } from './tts.js';

const run = promisify(execFile);

export async function loadBrand() {
  const b = JSON.parse(await readFile(new URL('../../brand/brand.json', import.meta.url), 'utf8'));
  b.logoPath = fileURLToPath(new URL('../../' + b.logo, import.meta.url));
  return b;
}

export async function ffmpeg(args, cwd) {
  try {
    await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { cwd, maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    throw new ProducerError(`ffmpeg falhou: ${e.stderr || e.message}`);
  }
}

export async function durationOf(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(stdout);
}
