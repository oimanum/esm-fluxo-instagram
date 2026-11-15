import { readFile } from 'node:fs/promises';
import { loadFacts } from './facts.js';
import { config } from './config.js';

const valid = (o) => !!(o && typeof o.hook === 'string' && o.hook.trim() && typeof o.script === 'string' && o.script.trim()
  && typeof o.caption === 'string' && Array.isArray(o.hashtags) && typeof o.cta === 'string' && o.cta.trim());

export async function writePost({ topic, format, llm, angle = '', facts, funnel = config.funnel }) {
  facts ||= await loadFacts();
  const ctaRule = funnel.enabled
    ? `O CTA deve convidar a comentar a palavra-chave, neste formato: Comente **${funnel.keyword}** e receba o caminho no Direct. (a palavra ${funnel.keyword} sempre dentro de ** **).`
    : 'O CTA convida a chamar no WhatsApp ou clicar no link da bio.';
  const voice = await readFile(new URL('../brand/voice.md', import.meta.url), 'utf8');
  const spec = format === 'reel'
    ? 'Reel de 20 a 35 s. A narração completa (gancho + roteiro + CTA) deve ter entre 60 e 85 palavras no total; o roteiro sozinho cerca de 50 a 75. Gancho nos 3 primeiros segundos, até 12 palavras.'
    : format === 'post'
      ? 'POST de imagem única: "hook" é a frase de impacto da imagem (até 12 palavras) e "script" é UMA frase de apoio com até 25 palavras que completa a ideia. Sem lista e sem " | ".'
      : format === 'checklist'
      ? 'CHECKLIST de imagem única: "hook" é a pergunta do título (ex.: Seu site abre bem **no celular?**), "script" traz de 3 a 5 itens de autoavaliação em forma de pergunta, cada um com até 60 caracteres, separados por " | ". O "cta" é a frase de fechamento (ex.: Marcou menos de 3? **Fale com a ESM Web.**).'
      : 'Carrossel: "script" traz de 3 a 6 slides de texto curto, separados por " | " (o gancho vira a capa e o CTA o último slide).';
  const prompt = `Escreva um post de Instagram em pt-BR para a ESM Web.\nTema: ${topic}\nÂngulo: ${angle}\n${spec}\nUm único CTA, curto, sem pontuação final extra. Sem promessa de resultado garantido.\nGANCHO: foque no benefício que o cliente recebe (mais pacientes, mais agendamentos, mais contatos), nunca na técnica: é proibido citar React, HTML, CSS, código ou framework.\nFATOS (únicos números, resultados e clientes que você pode citar):\n${facts.text}\nSem fato que sustente, não invente: use a dor do cliente, uma pergunta ou a consequência.\nPERSUASÃO (o dono do negócio precisa sentir que PRECISA de um site): 1) abra pela dor ou pela perda concreta (cliente que procura no Google e não acha, agendamento que vai para o concorrente, parecer menos confiável só com Instagram); 2) mostre o custo de não agir, o que ele perde a cada dia; 3) use um dado com fonte dos FATOS ou convide a testar: "Teste você mesmo: pesquise seu negócio no Google, pelo celular"; 4) mostre o que o site faz por ele (aparecer no Google, passar confiança, receber contatos no WhatsApp a qualquer hora); 5) feche com um próximo passo fácil. NUNCA cite clientes, depoimentos, cases, número de projetos ou tempo de experiência: você não tem esses fatos.\n${ctaRule}\nVisual: "label" é uma etiqueta curta em CAIXA ALTA (até 28 caracteres, ex.: TESTE RÁPIDO, NOSSO PROCESSO, ERRO COMUM). No "hook", nos slides do carrossel e no "cta", marque com ** a parte principal da frase (ex.: Seu site **perde paciente** todo dia); o resto fica em peso leve. Marque no máximo uma parte por frase. No "script" do Reel NÃO use **.\n\n${voice}\n\nResponda JSON: {"label":string,"hook":string,"script":string,"caption":string,"hashtags":string[],"cta":string}`;
  return llm({ prompt, schema: valid });
}
