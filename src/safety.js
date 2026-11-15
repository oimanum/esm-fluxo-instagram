import { plain } from './text.js';
import { numbersIn } from './facts.js';
import { slideTexts } from './slides.js';

const words = (s) => plain(s).trim().split(/\s+/).filter(Boolean).length;

const BLOCKED = [
  /garant(e|ido|ida|imos)\b.*\b(resultado|ganho|lucro|cliente|vend)/i,
  /\b(resultado|ganho|lucro)s?\b.*\bgarant/i,
  /100\s?% de/i,
  /\bcura\b|\bcurar\b/i,
  /ganhe a causa|sem risco|dinheiro f[aá]cil|fique rico/i,
];

// Medido com edge-tts pt-BR a +8%: ~2,6 palavras/s. 55–88 palavras de narração ≈ 21–34 s.
const NARRATION_MIN = 55;
const NARRATION_MAX = 88;

// Gancho técnico vende a ferramenta, não o resultado.
const TECH = new RegExp('(?<![\p{L}])(react|html|css|javascript|typescript|next\.?js|php|wordpress|framework|back-?end|front-?end|c[óo]digo|programa[çc][ãa]o|stack)(?![\p{L}])', 'iu');

// Prova social só com fatos reais: sem casos cadastrados, o post não pode sugerir carteira de clientes nem experiência.
const PROOF = [
  /nossos clientes/i,
  /clientes? (satisfeit|que atendemos)/i,
  /cases? de sucesso/i,
  /j[áa] (ajudamos|atendemos|entregamos)/i,
  /mais de \d+\s+(clientes|empresas|sites|projetos|neg[óo]cios)/i,
  /depoimentos?/i,
  /resultados? comprovad/i,
  /\d+\s+anos de (experi[êe]ncia|mercado)/i,
  /experi[êe]ncia (comprovada|de mercado)/i,
];

// Textos das animações do Reel também passam pela checagem (alegações, prova social e números).
const visualText = (v) => (Array.isArray(v) ? v : []).map((x) => JSON.stringify(x, (k, val) => (k === 'type' || k === 'who' ? undefined : val))).join(' ');

export function checkPost(post, format, { allowedNumbers = new Set(), keyword, socialProof = false } = {}) {
  const problems = [];
  if (!post.hook || words(post.hook) > 12) problems.push('gancho ausente ou com mais de 12 palavras');
  if (format === 'reel') {
    const n = words(`${post.hook || ''} ${post.script || ''} ${post.cta || ''}`);
    if (n < NARRATION_MIN || n > NARRATION_MAX) problems.push(`narração (gancho+roteiro+CTA) com ${n} palavras (esperado ${NARRATION_MIN}–${NARRATION_MAX}, ≈20–35 s)`);
  } else if (format === 'post') {
    const n = words(post.script || '');
    if (n < 5 || n > 32) problems.push(`post com apoio de ${n} palavras (esperado 5–32)`);
    if ((post.script || '').includes('|')) problems.push('post de imagem única não usa |');
  } else if (format === 'checklist') {
    const items = (post.script || '').split('|').map((s) => s.trim()).filter(Boolean);
    if (items.length < 3 || items.length > 5) problems.push(`checklist com ${items.length} itens separados por | (esperado 3–5)`);
    if (items.some((i) => plain(i).length > 70)) problems.push('item de checklist com mais de 70 caracteres');
  } else {
    const parts = (post.script || '').split('|').map((s) => s.trim()).filter(Boolean).length;
    if (parts < 3 || parts > 6) problems.push(`carrossel com ${parts} partes separadas por | (esperado 3–6)`);
  }
  // No checklist o fechamento é "pergunta? chamada." por desenho; nos demais, o CTA é uma frase só.
  const manySentences = format !== 'checklist' && (post.cta || '').match(/[.!?]\s+\S/g)?.length > 0;
  if (!post.cta || manySentences) problems.push('CTA ausente ou múltiplo');
  const all = [post.hook, post.script, post.caption, post.cta, visualText(post.visuals), (post.slides || []).flatMap(slideTexts).join(' '), post.sub || ''].join(' \n ');
  for (const re of BLOCKED) if (re.test(all)) problems.push(`alegação bloqueada: ${re}`);
  if (keyword && !plain(post.cta || '').toLowerCase().includes(keyword.toLowerCase())) problems.push(`o CTA deve convidar a comentar a palavra ${keyword}`);
  if (!socialProof) for (const re of PROOF) if (re.test(plain(all))) problems.push(`prova social sem fato real cadastrado: ${re}`);
  const unsourced = [...new Set(numbersIn(all))].filter((n) => !allowedNumbers.has(n));
  if (unsourced.length) problems.push(`número de resultado sem fonte em brand/facts.json: ${unsourced.join(', ')}`);
  if (TECH.test(plain(post.hook || ''))) problems.push('gancho técnico: fale do benefício para o cliente, não da ferramenta');
  return { ok: problems.length === 0, problems };
}
