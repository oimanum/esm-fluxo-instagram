// Ponte final: todo post termina ligando o assunto ao porquê de o negócio precisar de um site ou de um sistema sob medida.
import { plain } from './text.js';

export const BRIDGE_RE = /\b(sites?|sistemas?|p[áa]ginas?|landing|painel|agendamento online|automa[çc][ãa]o|crm)\b/i;

const lastSentences = (t) => plain(t).split(/(?<=[.!?])\s+/).filter(Boolean).slice(-2).join(' ');

export function hasBridge(post, format) {
  switch (format) {
    case 'reel': return BRIDGE_RE.test(lastSentences(post.script || ''));
    case 'carousel': return !!post.bridge && BRIDGE_RE.test(plain(`${post.bridge.title || ''} ${post.bridge.text || ''}`));
    case 'post': return BRIDGE_RE.test(plain(post.script || ''));
    case 'checklist': return BRIDGE_RE.test(plain(post.cta || ''));
    default: return true;
  }
}

// Texto da ponte para os stories (do campo bridge do carrossel ou da última frase com a ponte).
export function bridgeText(post, pieces = []) {
  if (post.bridge?.title) return post.bridge.text ? `${post.bridge.title}. ${post.bridge.text}` : post.bridge.title;
  return [...pieces].reverse().find((p) => BRIDGE_RE.test(plain(p))) || null;
}
