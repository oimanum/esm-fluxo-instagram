// Texto com marcação **destaque**: o destaque vai em peso forte e branco, o resto em peso leve e prata
// (como nos posts da ESM Web). Sem marcação, o texto inteiro fica forte.

export const plain = (text = '') => String(text).replace(/\*\*/g, '');

export function parseEmphasis(text = '') {
  const raw = String(text);
  if (!/\*\*[^*]+\*\*/.test(raw)) return [{ text: plain(raw), strong: true }];
  return raw.split('**').map((t, i) => ({ text: t, strong: i % 2 === 1 })).filter((p) => p.text);
}

// Quebra um texto em telas de legenda: por frase, e frases longas no sinal de pontuação mais perto do meio.
export function splitSegments(text, max = 110) {
  const out = [];
  const cut = (s) => {
    if (s.length <= max) { out.push(s); return; }
    const mid = s.length / 2;
    // Pontuação só vale se cair no miolo do texto (30%–70%); senão quebra no espaço mais perto do meio.
    const pick = (test, lo, hi) => {
      let idx = -1;
      let best = Infinity;
      for (let i = Math.ceil(s.length * lo); i < Math.floor(s.length * hi); i++) {
        if (test(s[i]) && Math.abs(i - mid) < best) { best = Math.abs(i - mid); idx = i; }
      }
      return idx;
    };
    let idx = pick((c) => ',;:'.includes(c), 0.3, 0.7);
    if (idx >= 0) idx += 1;
    else idx = pick((c) => c === ' ', 0.1, 0.9);
    if (idx <= 0 || idx >= s.length) { out.push(s); return; } // sem onde quebrar: mantém inteiro
    cut(s.slice(0, idx).trim());
    cut(s.slice(idx).trim());
  };
  for (const s of String(text).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)) cut(s);
  return out;
}
