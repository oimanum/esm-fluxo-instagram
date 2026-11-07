import { readFile } from 'node:fs/promises';

const valid = (o) => !!(o && typeof o.hook === 'string' && o.hook.trim() && typeof o.script === 'string' && o.script.trim()
  && typeof o.caption === 'string' && Array.isArray(o.hashtags) && typeof o.cta === 'string' && o.cta.trim());

export async function writePost({ topic, format, llm, angle = '' }) {
  const voice = await readFile(new URL('../brand/voice.md', import.meta.url), 'utf8');
  const spec = format === 'reel'
    ? 'Reel de 20 a 35 s. A narração completa (gancho + roteiro + CTA) deve ter entre 60 e 85 palavras no total; o roteiro sozinho cerca de 50 a 75. Gancho nos 3 primeiros segundos, até 12 palavras.'
    : 'Carrossel: "script" traz de 3 a 6 slides de texto curto, separados por " | " (o gancho vira a capa e o CTA o último slide).';
  const prompt = `Escreva um post de Instagram em pt-BR para a ESM Web.\nTema: ${topic}\nÂngulo: ${angle}\n${spec}\nUm único CTA, curto, sem pontuação final extra. Sem promessa de resultado garantido.\n\n${voice}\n\nResponda JSON: {"hook":string,"script":string,"caption":string,"hashtags":string[],"cta":string}`;
  return llm({ prompt, schema: valid });
}
