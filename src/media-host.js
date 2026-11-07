import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename } from 'node:path';

const run = promisify(execFile);
const defaultGh = async (args) => (await run('gh', args)).stdout;

// Publica os arquivos como assets de um GitHub Release e devolve as URLs públicas (a Meta exige URL pública).
export async function uploadMedia(paths, { repo, tag, gh = defaultGh }) {
  try {
    await gh(['release', 'create', tag, '--repo', repo, '--title', tag, '--notes', 'mídia do post']);
  } catch { /* release já existe */ }
  await gh(['release', 'upload', tag, ...paths, '--repo', repo, '--clobber']);
  return paths.map((p) => `https://github.com/${repo}/releases/download/${tag}/${basename(p)}`);
}
