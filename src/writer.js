import { readFile } from 'node:fs/promises';
import { loadFacts } from './facts.js';

const valid = (o) => !!(o && typeof o.hook === 'string' && o.hook.trim() && typeof o.script === 'string' && o.script.trim()
  && typeof o.caption === 'string' && Array.isArray(o.hashtags) && typeof o.cta === 'string' && o.cta.trim());

export async function writePost({ topic, format, llm, angle = '', facts }) {
  facts ||= await loadFacts();
  const voice = await readFile(new URL('../brand/voice.md', import.meta.url), 'utf8');
  const spec = format === 'reel'
    ? 'Reel de 20 a 35 s. A narração completa (gancho + roteiro + CTA) deve ter entre 60 e 85 palavras no total; o roteiro sozinho cerca de 50 a 75. Gancho nos 3 primeiros segundos, até 12 palavras.'
    : format === 'checklist'
      ? 'CHECKLIST de imagem única: "hook" é a pergunta do título (ex.: Seu site abre bem **no celular?**), "script" traz de 3 a 5 itens de autoavaliação em forma de pergunta, cada um com até 60 caracteres, separados por " | ". O "cta" é a frase de fechamento (ex.: Marcou menos de 3? **Fale com a ESM Web.**).'
      : 'Carrossel: "script" traz de 3 a 6 slides de texto curto, separados por " | " (o gancho vira a capa e o CTA o último slide).';
  const prompt = `Escreva um post de Instagram em pt-BR para a ESM Web.\nTema: ${topic}\nÂngulo: ${angle}\n${spec}\nUm único CTA, curto, sem pontuação final extra. Sem promessa de resultado garantido.\nGANCHO: foque no benefício que o cliente recebe (mais pacientes, mais agendamentos, mais contatos), nunca na técnica: é proibido citar React, HTML, CSS, código ou framework.\nFATOS (únicos números, resultados e clientes que você pode citar):\n${facts.text}\nSem fato que sustente, não invente: use a dor do cliente, uma pergunta ou a consequência.\nVisual: "label" é uma etiqueta curta em CAIXA ALTA (até 28 caracteres, ex.: TESTE RÁPIDO, NOSSO PROCESSO, ERRO COMUM). No "hook", nos slides do carrossel e no "cta", marque com ** a parte principal da frase (ex.: Seu site **perde paciente** todo dia); o resto fica em peso leve. Marque no máximo uma parte por frase. No "script" do Reel NÃO use **.\n\n${voice}\n\nResponda JSON: {"label":string,"hook":string,"script":string,"caption":string,"hashtags":string[],"cta":string}`;
  return llm({ prompt, schema: valid });
}
