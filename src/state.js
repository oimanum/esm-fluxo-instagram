import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const dir = () => process.env.DATA_DIR || 'data';

export async function loadState(name) {
  try {
    return JSON.parse(await readFile(join(dir(), `${name}.json`), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

export async function saveState(name, rows) {
  await mkdir(dir(), { recursive: true });
  await writeFile(join(dir(), `${name}.json`), JSON.stringify(rows, null, 2));
}
