// Slides do carrossel: a IA escolhe o tipo de cada slide pelo conteúdo; o que vier inválido é limpo,
// e sem sugestão os slides saem do roteiro (afirmação e numerado em alternância).
import { plain } from './text.js';

export const SLIDE_KINDS = ['statement', 'numbered', 'list', 'versus', 'big'];

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  const p = plain(t);
  if (p.length <= n) return t;
  // corta o texto sem deixar ** aberto
  const cut = `${plain(t).slice(0, n - 1).trimEnd()}…`;
  return cut;
};
const piece = (o, n) => (o && typeof o === 'object' ? { label: clip(o.label, 26).toUpperCase(), text: clip(o.text, n) } : null);

export function cleanSlide(s) {
  if (!s || typeof s !== 'object' || !SLIDE_KINDS.includes(s.kind)) return null;
  switch (s.kind) {
    case 'statement': {
      const title = clip(s.title, 90);
      return title ? { kind: 'statement', kicker: clip(s.kicker, 26).toUpperCase(), title, body: clip(s.body, 180) } : null;
    }
    case 'numbered': {
      const title = clip(s.title, 70);
      if (!title) return null;
      const card = s.card && clip(s.card.text, 70) ? piece(s.card, 70) : null;
      return { kind: 'numbered', n: Number.isInteger(s.n) ? s.n : 0, title, body: clip(s.body, 170), ...(card ? { card } : {}) };
    }
    case 'list': {
      const items = (Array.isArray(s.items) ? s.items : []).map((i) => ({ name: clip(i?.name, 24), desc: clip(i?.desc, 70) })).filter((i) => i.name).slice(0, 5);
      const title = clip(s.title, 40);
      return items.length >= 3 && title ? { kind: 'list', title, tag: clip(s.tag, 26).toUpperCase(), items } : null;
    }
    case 'versus': {
      const bad = piece(s.bad, 80); const good = piece(s.good, 80);
      const title = clip(s.title, 60);
      if (!bad?.text || !good?.text || !title) return null;
      const tip = s.tip && clip(s.tip.text, 120) ? piece(s.tip, 120) : null;
      return { kind: 'versus', title, bad: { ...bad, label: bad.label || 'RUIM' }, good: { ...good, label: good.label || 'BOM' }, ...(tip ? { tip: { ...tip, label: tip.label || 'COMO FAZER' } } : {}), why: clip(s.why, 120) };
    }
    case 'big': {
      const value = clip(s.value, 12);
      return value && clip(s.label, 70) ? { kind: 'big', value, label: clip(s.label, 70) } : null;
    }
    default: return null;
  }
}

// Todo texto de um slide (para a checagem de segurança e para derivar o "script").
export function slideTexts(slide) {
  const out = [];
  const walk = (v) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (k !== 'kind') walk(x); }); };
  walk(slide);
  return out;
}
export const slideTitle = (s) => s.title || s.value || s.items?.[0]?.name || '';

// Slides de conteúdo (sem capa e sem CTA). Usa as sugestões da IA; senão, deriva do roteiro.
export function slidesFor(post) {
  const given = (Array.isArray(post.slides) ? post.slides : []).map(cleanSlide).filter(Boolean).slice(0, 6);
  if (given.length >= 3) return given;
  const parts = String(post.script || '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 6);
  return parts.map((text, i) => (i % 2 === 0
    ? { kind: 'statement', kicker: i === 0 ? 'COMEÇA POR AQUI' : '', title: text, body: '' }
    : { kind: 'numbered', n: i, title: text, body: '' }));
}

// Ponte do carrossel: { title, text } curtos; sem título ou texto, nada.
export function cleanBridge(b) {
  if (!b || typeof b !== 'object') return null;
  const title = clip(b.title, 70);
  const text = clip(b.text, 180);
  return title && text ? { title, text } : null;
}
