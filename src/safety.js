import { plain } from './text.js';

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

export function checkPost(post, format) {
  const problems = [];
  if (!post.hook || words(post.hook) > 12) problems.push('gancho ausente ou com mais de 12 palavras');
  if (format === 'reel') {
    const n = words(`${post.hook || ''} ${post.script || ''} ${post.cta || ''}`);
    if (n < NARRATION_MIN || n > NARRATION_MAX) problems.push(`narração (gancho+roteiro+CTA) com ${n} palavras (esperado ${NARRATION_MIN}–${NARRATION_MAX}, ≈20–35 s)`);
  } else {
    const parts = (post.script || '').split('|').map((s) => s.trim()).filter(Boolean).length;
    if (parts < 3 || parts > 6) problems.push(`carrossel com ${parts} partes separadas por | (esperado 3–6)`);
  }
  if (!post.cta || (post.cta.match(/[.!?]\s+\S/g) || []).length > 0) problems.push('CTA ausente ou múltiplo');
  const all = [post.hook, post.script, post.caption, post.cta].join(' \n ');
  for (const re of BLOCKED) if (re.test(all)) problems.push(`alegação bloqueada: ${re}`);
  return { ok: problems.length === 0, problems };
}
