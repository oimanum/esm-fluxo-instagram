// Ideias visuais dos Reels: cada frase do roteiro ganha uma animação que ilustra o que está sendo dito.
// O roteiro (IA) sugere a animação por frase; o que vier inválido é limpo, e o que faltar é deduzido do texto.
import { numbersIn } from './facts.js';
import { plain } from './text.js';

export const VISUAL_TYPES = ['search', 'chat', 'loading', 'versus', 'checklist', 'funnel', 'steps', 'notification', 'quote', 'map', 'clock', 'stat', 'site', 'none'];

const clip = (s, n) => {
  const t = plain(String(s ?? '')).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const list = (a, n, len) => (Array.isArray(a) ? a.map((x) => clip(typeof x === 'string' ? x : x?.text, len)).filter(Boolean).slice(0, n) : []);
const side = (o, fallbackTitle) => ({ title: clip(o?.title, 22) || fallbackTitle, items: list(o?.items, 3, 30) });

// Limpa um visual vindo da IA: tipo válido, textos curtos, listas limitadas. Devolve null se não der para usar.
export function cleanVisual(v) {
  if (!v || typeof v !== 'object' || !VISUAL_TYPES.includes(v.type)) return null;
  switch (v.type) {
    case 'search': return { type: 'search', query: clip(v.query, 38) || 'serviço perto de mim' };
    case 'chat': {
      const msgs = (Array.isArray(v.msgs) ? v.msgs : []).map((m) => ({ who: m?.who === 'voce' ? 'voce' : 'cliente', text: clip(m?.text, 44) })).filter((m) => m.text).slice(0, 3);
      return msgs.length >= 2 ? { type: 'chat', msgs } : null;
    }
    case 'loading': return { type: 'loading', label: clip(v.label, 22) || 'Carregando…', outcome: clip(v.outcome, 22) || 'Cliente saiu' };
    case 'versus': {
      const left = side(v.left, 'Sem site'); const right = side(v.right, 'Com site');
      return left.items.length >= 2 && right.items.length >= 2 ? { type: 'versus', left, right } : null;
    }
    case 'checklist': { const items = list(v.items, 4, 34); return items.length >= 3 ? { type: 'checklist', items } : null; }
    case 'funnel': { const steps = list(v.steps, 4, 18); return steps.length >= 3 ? { type: 'funnel', steps } : null; }
    case 'steps': { const steps = list(v.steps, 3, 20); return steps.length >= 3 ? { type: 'steps', steps } : null; }
    case 'notification': { const items = list(v.items, 3, 34); return items.length >= 2 ? { type: 'notification', items } : null; }
    case 'quote': return clip(v.text, 70) ? { type: 'quote', text: clip(v.text, 70), who: clip(v.who, 18) || 'Cliente' } : null;
    case 'map': return { type: 'map', name: clip(v.name, 26) || 'Sua empresa', label: clip(v.label, 24) || 'Aberto agora' };
    case 'clock': return { type: 'clock', label: clip(v.label, 30) || 'Sempre disponível' };
    case 'stat': return clip(v.value, 8) && clip(v.label, 40) ? { type: 'stat', value: clip(v.value, 8), label: clip(v.label, 40) } : null;
    case 'site': return { type: 'site', niche: Number.isInteger(v.niche) ? v.niche : 0 };
    default: return { type: 'none' };
  }
}

const norm = (s) => plain(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Termo de busca coerente com o nicho do post (clínica, advocacia, estética, solar).
function queryFor(text) {
  const t = norm(text);
  if (/dentist|odonto|sorriso|paciente|clinica|consulta/.test(t)) return 'dentista perto de mim';
  if (/advog|juridic|processo|direito/.test(t)) return 'advogado trabalhista';
  if (/estetic|pele|beleza|depila|harmoniz/.test(t)) return 'clínica de estética';
  if (/solar|energia|conta de luz/.test(t)) return 'energia solar orçamento';
  return 'serviço perto de mim';
}

// Dedução pelo texto quando a IA não sugeriu (ou sugeriu algo inválido). Sempre coerente com o que a frase diz.
export function guessVisual(sentence, context = '') {
  const t = norm(sentence);
  if (/concorrent|compar|diferenc|em vez/.test(t) && !/google|pesquis|busca/.test(t)) return { type: 'versus', left: { title: 'Sem site', items: ['Não aparece no Google', 'Passa pouca confiança'] }, right: { title: 'Com site', items: ['Aparece no Google', 'Passa confiança'] } };
  if (/teste|confira|cheque|verifique/.test(t)) return { type: 'checklist', items: ['Abre rápido no celular', 'Aparece no Google', 'Botão de WhatsApp visível'] };
  if (/google|pesquis|busca|procura|encontr/.test(t)) return { type: 'search', query: queryFor(`${sentence} ${context}`) };
  if (/lent|segundo|carreg|demor/.test(t)) return { type: 'loading', label: 'Carregando…', outcome: 'Cliente saiu' };
  if (/concorrent|enquanto|compar|diferenc|em vez/.test(t)) return { type: 'versus', left: { title: 'Sem site', items: ['Não aparece no Google', 'Passa pouca confiança'] }, right: { title: 'Com site', items: ['Aparece no Google', 'Passa confiança'] } };
  if (/whatsapp|mensagem|conversa|respond|atend|chama/.test(t)) return { type: 'chat', msgs: [{ who: 'cliente', text: 'Oi, vocês atendem hoje?' }, { who: 'voce', text: 'Atendemos! Qual horário?' }] };
  if (/passo|etapa|processo|primeiro|depois|comece/.test(t)) return { type: 'steps', steps: ['Briefing', 'Protótipo', 'Site no ar'] };
  if (/agenda|horario|qualquer hora|noite|madrugada|sempre|24/.test(t)) return { type: 'clock', label: 'Sempre disponível' };
  if (/confian|credib|profission|imagem|serio/.test(t)) return { type: 'quote', text: 'Será que essa empresa é confiável?', who: 'Cliente' };
  if (/perto|local|endereco|bairro|cidade|mapa|regiao/.test(t)) return { type: 'map', name: 'Sua empresa', label: 'Aberto agora' };
  if (/contato|novo cliente|cliente chega|pedido|orcamento|agendamento|lead/.test(t)) return { type: 'notification', items: ['Novo contato pelo WhatsApp', 'Pedido de orçamento', 'Novo agendamento'] };
  if (/site|pagina|landing|vitrine/.test(t)) return { type: 'site', niche: 0 };
  return { type: 'none' };
}

const FILLERS = [
  { type: 'funnel', steps: ['Pesquisa', 'Visita', 'Contato'] },
  { type: 'notification', items: ['Novo contato pelo WhatsApp', 'Pedido de orçamento'] },
  { type: 'clock', label: 'Sempre disponível' },
];

// Uma ideia visual por frase, sem repetir o mesmo tipo duas vezes seguidas e com no máximo 1 site por Reel.
export function visualsFor(post, sentences, allowedNumbers = new Set()) {
  const given = (Array.isArray(post.visuals) ? post.visuals : []).map((v) => {
    const c = cleanVisual(v);
    if (!c) return null;
    const unsourced = numbersIn(JSON.stringify(c)).filter((n) => !allowedNumbers.has(n));
    return unsourced.length ? null : c; // número sem fonte: descarta a sugestão
  });
  const ctx = `${post.hook || ''} ${post.script || ''}`;
  let sites = 0;
  const out = [];
  sentences.forEach((s, i) => {
    let v = given[i] || guessVisual(s, ctx);
    if (v.type === 'site' && sites >= 1) v = { type: 'none' };
    if (out.length && out[out.length - 1].type === v.type && v.type !== 'none') {
      const alt = guessVisual(s.replace(/google|pesquis|busca|procura|encontr/gi, ''), ctx);
      v = alt.type === v.type ? { type: 'none' } : alt;
    }
    // Sem pista no texto: uma animação neutra e coerente com o assunto (sem repetir tipo já usado).
    if (v.type === 'none') {
      const used = new Set(out.map((x) => x.type));
      const filler = FILLERS.find((f) => !used.has(f.type));
      if (filler && out.length && out[out.length - 1].type !== 'none') v = filler;
    }
    if (v.type === 'site') sites++;
    out.push(v);
  });
  return out;
}
