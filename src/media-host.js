import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename } from 'node:path';

const run = promisify(execFile);
const defaultGh = async (args) => (await run('gh', args)).stdout;

// Na geração: sobe a mídia para um release em RASCUNHO (não público). Assim ela sobrevive entre workflows
// e nada fica visível antes da aprovação.
export async function stageMedia(paths, { repo, tag, gh = defaultGh }) {
  try {
    await gh(['release', 'create', tag, '--repo', repo, '--draft', '--title', tag, '--notes', 'mídia do post']);
  } catch { /* release já existe */ }
  await gh(['release', 'upload', tag, ...paths, '--repo', repo, '--clobber']);
  return { tag, files: paths.map((p) => basename(p)) };
}

// Na aprovação: torna o release público e devolve as URLs que a Meta vai buscar.
export async function publishRelease({ tag, files }, { repo, gh = defaultGh }) {
  await gh(['release', 'edit', tag, '--repo', repo, '--draft=false']);
  return files.map((f) => `https://github.com/${repo}/releases/download/${tag}/${f}`);
}
