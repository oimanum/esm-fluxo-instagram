import { readFile } from 'node:fs/promises';

const valid = (o) => !!(o && typeof o.hook === 'string' && o.hook.trim() && typeof o.script === 'string' && o.script.trim()
  && typeof o.caption === 'string' && Array.isArray(o.hashtags) && typeof o.cta === "string" && o.cta.trim());

export async function writePost({ topic, format, llm, angle = '' }) {
  const voice = await readFile(new URL('../brand/voice.md', import.meta.url), 'utf8');
  const spec = format === 'reel'
    ? 'Reel de 20 a 35 s: roteiro falado de 55 a 95 palavras, gancho nos 3 primeiros segundos (até 12 palavras).'
    : 'Carrossel de 5 a 8 slides: "script" traz o texto dos slides separados por " | ".';
  const prompt = `Escreva um post de Instagram em pt-BR para a ESM Web.\nTema: ${topic}\nÂngulo: ${angle}\n${spec}\nUm único CTA, curto, sem pontuação final extra. Sem promessa de resultado garantido.\n\n${voice}\n\nResponda JSON: {"hook":string,"script":string,"caption":string,"hashtags":string[],"cta":string}`;
  return llm({ prompt, schema: valid });
}
