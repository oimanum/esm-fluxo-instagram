const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

const BLOCKED = [
  /garant(e|ido|ida|imos)\b.*\b(resultado|ganho|lucro|cliente|vend)/i,
  /\b(resultado|ganho|lucro)s?\b.*\bgarant/i,
  /100\s?% de/i,
  /\bcura\b|\bcurar\b/i,
  /ganhe a causa|sem risco|dinheiro f[aá]cil|fique rico/i,
];

export function checkPost(post, format) {
  const problems = [];
  if (!post.hook || words(post.hook) > 12) problems.push('gancho ausente ou com mais de 12 palavras');
  const n = words(post.script || '');
  if (format === 'reel' && (n < 55 || n > 95)) problems.push(`roteiro com ${n} palavras (esperado 55–95, ≈20–35 s)`);
  if (format === 'carousel' && n < 5) problems.push('carrossel sem texto');
  if (!post.cta || (post.cta.match(/[.!?]\s+\S/g) || []).length > 0) problems.push('CTA ausente ou múltiplo');
  const all = [post.hook, post.script, post.caption, post.cta].join(' \n ');
  for (const re of BLOCKED) if (re.test(all)) problems.push(`alegação bloqueada: ${re}`);
  return { ok: problems.length === 0, problems };
}
