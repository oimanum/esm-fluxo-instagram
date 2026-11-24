import { readFile } from 'node:fs/promises';
import { loadFacts } from './facts.js';
import { config } from './config.js';
import { PILLARS } from './pillars.js';
import { plain } from './text.js';
import { visualsFor } from './visuals.js';
import { cleanSlide, slideTitle, cleanBridge } from './slides.js';

const SLIDES_SPEC = `SLIDES (só no Carrossel): inclua "slides", de 3 a 6 slides de conteúdo (sem a capa e sem o CTA, que já existem), cada um do tipo que MELHOR mostra aquela ideia, variando os tipos. Marque com ** a parte principal das frases. Tipos e campos:
- {"kind":"statement","kicker":"COMEÇA POR AQUI","title":"frase forte (até 90 caracteres)","body":"explicação curta (até 180)"}  (afirmação, abertura, virada)
- {"kind":"numbered","n":1,"title":"título curto","body":"explicação","card":{"label":"O QUE MUDA","text":"frase de destaque"}}  (passo ou ponto numerado; card é opcional)
- {"kind":"list","title":"No seu site","tag":"O ESSENCIAL","items":[{"name":"Google","desc":"o que isso faz"},{"name":"...","desc":"..."},{"name":"...","desc":"..."}]}  (3 a 5 itens)
- {"kind":"versus","title":"Como pedir","bad":{"label":"RUIM","text":"pedido fraco"},"good":{"label":"BOM","text":"pedido melhor"},"tip":{"label":"O QUE FAZEMOS","text":"..."},"why":"por que funciona"}  (erro comum x jeito certo)
- {"kind":"big","value":"53%","label":"o que o número mostra"}  (SÓ com número dos FATOS)
Também inclua "sub": uma frase curta de apoio da capa (até 12 palavras). Sem número que não esteja nos FATOS. "script" continua obrigatório: os títulos dos slides separados por " | ".`;
const VISUALS_SPEC = `VISUAIS (só no Reel): inclua "visuals", uma lista com UMA entrada por frase do "script" (cada frase termina em . ? ou !), na mesma ordem. Cada entrada é a animação que ILUSTRA o que aquela frase diz, escolhida pelo conteúdo, nunca por enfeite. Tipos e campos:
- {"type":"search","query":"o que a pessoa digita no Google"}  (frases sobre pesquisar e achar)
- {"type":"chat","msgs":[{"who":"cliente","text":"..."},{"who":"voce","text":"..."}]}  (2 a 3 mensagens; frases sobre WhatsApp e atendimento)
- {"type":"loading","label":"Carregando…","outcome":"Cliente saiu"}  (site lento, celular)
- {"type":"versus","left":{"title":"Sem site","items":["...","..."]},"right":{"title":"Com site","items":["...","..."]}}  (comparações, concorrente)
- {"type":"checklist","items":["...","...","..."]}  (testes e verificações)
- {"type":"funnel","steps":["Pesquisa","Visita","Contato"]}  (caminho do cliente)
- {"type":"steps","steps":["...","...","..."]}  (processo em passos)
- {"type":"notification","items":["Novo contato pelo WhatsApp","..."]}  (cliente chegando)
- {"type":"quote","text":"o que o cliente pensa ou pergunta","who":"Cliente"}
- {"type":"map","name":"Sua empresa","label":"Aberto agora"}  (busca local)
- {"type":"clock","label":"Sempre disponível"}  (tempo, horário, 24 horas)
- {"type":"stat","value":"53%","label":"..."}  (SÓ com número dos FATOS)
- {"type":"site","niche":0}  (0 clínica, 1 advocacia, 2 estética, 3 solar; no máximo 1 por Reel e só se a frase for sobre o próprio site)
- {"type":"none"}  (frase sem o que mostrar)
Textos curtos (até 34 caracteres), sem número que não esteja nos FATOS. Varie: não repita o mesmo tipo em frases seguidas.`;


const valid = (o) => !!(o && typeof o.hook === 'string' && o.hook.trim() && ((typeof o.script === 'string' && o.script.trim()) || Array.isArray(o.slides))
  && typeof o.caption === 'string' && Array.isArray(o.hashtags) && typeof o.cta === 'string' && o.cta.trim());

export async function writePost({ topic, format, llm, angle = '', facts, funnel = config.funnel, feedback = '', pillar = null, niche = null, recentHooks = [] }) {
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
  const sl = format === 'carousel' ? `\n${SLIDES_SPEC}\n` : '';
  const fb = feedback ? `\nATENÇÃO: a sua versão anterior foi barrada pela checagem (${feedback}). Reescreva corrigindo exatamente isso.\n` : '';
  const pl = PILLARS[pillar];
  const pillarBlock = pl ? `PILAR: ${pl.nome}. ${pl.descricao}. Formas de gancho que funcionam aqui: ${pl.ganchos.join(' | ')}.${pl.cuidado ? ` CUIDADO: ${pl.cuidado}` : ''}\nPÚBLICO: ${niche || 'dono de negócio local'}. Fale com esse público de forma específica (cenário, exemplo e vocabulário dele), sem só trocar a palavra do nicho.` : '';
  const recentBlock = recentHooks.length ? `JÁ PUBLICADOS (não repita a ideia nem a estrutura do gancho):\n${recentHooks.map((h) => `- ${h}`).join('\n')}` : '';
  const FMT = {
    reel: 'No Reel, as 1 ou 2 ÚLTIMAS frases do "script" são a ponte (antes do CTA).',
    carousel: 'No carrossel, o campo "bridge" ({"title":"frase curta que liga o assunto à solução","text":"como o site ou sistema sob medida resolve isso, em até 170 caracteres"}) vira o penúltimo slide.',
    post: 'No post de imagem única, o "script" (a frase de apoio) É a ponte: liga o gancho ao porquê de um site ou sistema sob medida.',
    checklist: 'No checklist, a frase de fechamento ("cta") é a ponte: liga o resultado do teste ao porquê de um site ou sistema sob medida.',
  }[format] || '';
  const ponte = `PONTE (obrigatória, só no FINAL do post): ligue o assunto ao porquê de este negócio precisar de um SITE ou de um SISTEMA feito sob medida pela ESM Web (página que converte, agendamento online, WhatsApp integrado, painel ou CRM, automação do atendimento). Escolha o que combina com o assunto e diga, de forma concreta, o que falta no negócio e como isso resolve EXATAMENTE aquele problema. Sem prometer resultado e sem citar clientes ou casos. O corpo do post continua entregando valor: NÃO transforme o post inteiro em "você precisa de um site". ${FMT}`;
  const valor = [
    'OBJETIVO DO POST: entregar valor de verdade para o dono do negócio (ensinar, esclarecer ou alertar sobre algo que ele precisa saber), de um jeito que ele queira SALVAR e MANDAR para alguém. A autoridade e a venda nascem de ajudar.',
    pillarBlock,
    'GANCHO VIRAL: precisa parar a rolagem em 2 segundos com uma promessa concreta, uma contradição ("pare de..."), um erro que a pessoa comete sem saber ou uma pergunta que ela não sabe responder. Nada de gancho genérico.',
    'ESTRUTURA: gancho, por que importa (a consequência real), o conteúdo útil (passos, regra, comparação ou explicação simples) e um fechamento com o próximo passo.',
    'VALOR: quem terminar de ler precisa saber FAZER ou ENTENDER algo novo. Sem generalidade ("invista em marketing"); dê instruções que dá para executar hoje, com exemplo do dia a dia do público.',
    ponte,
    recentBlock,
    'NUNCA cite clientes, depoimentos, cases, número de projetos ou tempo de experiência: você não tem esses fatos.',
  ].filter(Boolean).join('\n');
  const vis = format === 'reel' ? `\n${VISUALS_SPEC}\n` : '';
  const prompt = `Escreva um post de Instagram em pt-BR para a ESM Web.\nTema: ${topic}\nÂngulo: ${angle}\n${spec}\nUm único CTA, curto, sem pontuação final extra. Sem promessa de resultado garantido.\nGANCHO: foque no benefício que o cliente recebe (mais pacientes, mais agendamentos, mais contatos), nunca na técnica: é proibido citar React, HTML, CSS, código ou framework.\nFATOS (únicos números, resultados e clientes que você pode citar):\n${facts.text}\nSem fato que sustente, não invente: use a dor do cliente, uma pergunta ou a consequência.\n${valor}\n${ctaRule}${vis}${sl}\nNÚMEROS: o tema e o ângulo vêm de notícias e podem citar números, valores em R$, US$ ou porcentagens. NÃO repita nenhum deles nos textos; os únicos números permitidos são os de FATOS.${fb}\nVisual: "label" é uma etiqueta curta em CAIXA ALTA (até 28 caracteres, ex.: TESTE RÁPIDO, NOSSO PROCESSO, ERRO COMUM). No "hook", nos slides do carrossel e no "cta", marque com ** a parte principal da frase (ex.: Seu site **perde paciente** todo dia); o resto fica em peso leve. Marque no máximo uma parte por frase. No "script" do Reel NÃO use **.\n\n${voice}\n\nResponda JSON: {"label":string,"hook":string,"script":string,"caption":string,"hashtags":string[],"cta":string${format === 'reel' ? ',"visuals":object[]' : ''}${format === 'carousel' ? ',"slides":object[],"sub":string,"bridge":{"title":string,"text":string}' : ''}}`;
  const post = await llm({ prompt, schema: valid });
  if (format === 'carousel') {
    // Slides escolhidos pela IA (limpos); o "script" vira o resumo por títulos, usado na checagem e nos stories.
    const slides = (Array.isArray(post.slides) ? post.slides : []).map(cleanSlide).filter(Boolean).slice(0, 6);
    post.bridge = cleanBridge(post.bridge);
    if (!post.bridge) delete post.bridge;
    if (slides.length >= 3) {
      post.slides = slides;
      if (!post.script || !String(post.script).trim()) post.script = slides.map((x) => plain(slideTitle(x))).join(' | ');
    } else delete post.slides;
  }
  if (format === 'reel') {
    // Resolve uma ideia visual por frase: sugestão da IA limpa, ou dedução pelo texto quando faltar ou for inválida.
    const sentences = plain(post.script).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    post.visuals = visualsFor(post, sentences, facts.allowedNumbers);
  }
  return post;
}
