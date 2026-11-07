import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

export class ProducerError extends Error {
  constructor(m) { super(m); this.name = 'ProducerError'; }
}

export async function synth(text, outPath, { cmd = 'python', voice = 'pt-BR-AntonioNeural' } = {}) {
  try {
    await run(cmd, ['-m', 'edge_tts', '--voice', voice, '--rate', '+8%', '--text', text, '--write-media', outPath]);
  } catch (e) {
    throw new ProducerError(`Falha na locução: ${e.message}`);
  }
}
