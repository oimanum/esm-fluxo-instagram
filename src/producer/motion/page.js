// Roda dentro do Chrome. Tudo é função do tempo: window.__draw(t) desenha o quadro do instante t (segundos).
(() => {
  const D = window.__DATA;
  const SC = D.scenes;
  const stage = document.getElementById('stage');
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    lin: (x) => x,
    out3: (x) => 1 - Math.pow(1 - x, 3),
    out5: (x) => 1 - Math.pow(1 - x, 5),
    io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    back: (x) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    spring: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-7 * x) * Math.cos(11 * x)),
  };
  const p = (t, a, d, e = E.out3) => e(clamp((t - a) / d));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const el = (cls, parent, html = '', tag = 'div') => { const n = document.createElement(tag); if (cls) n.className = cls; if (html) n.innerHTML = html; parent.appendChild(n); return n; };
  const pad = (n) => String(n).padStart(2, '0');
  const fsFor = (n, k = 1) => Math.round((n <= 34 ? 92 : n <= 60 ? 80 : n <= 90 ? 68 : 58) * k);

  // palavras do texto, com o destaque (**) preservado
  const wordsOf = (parts) => parts.flatMap((pt) => pt.text.split(/\s+/).filter(Boolean).map((w) => ({ w, strong: pt.strong })));
  // Texto sem destaque marcado: realça as 2 palavras mais longas, para a tela ter hierarquia (forte x leve).
  function autoEmphasis(S) {
    if (S.parts.length !== 1 || !S.parts[0].strong) return;
    const toks = S.text.split(/(\s+)/);
    const cand = toks.map((w, k) => ({ k, n: w.replace(/[^\p{L}\p{N}]/gu, '').length })).filter((x) => x.n >= 5 && !/^\s+$/.test(toks[x.k]));
    const pick = new Set(cand.sort((a, b) => b.n - a.n).slice(0, 2).map((x) => x.k));
    if (!pick.size) return;
    const parts = [];
    toks.forEach((w, k) => {
      const strong = pick.has(k);
      const last = parts[parts.length - 1];
      if (last && last.strong === strong) last.text += w; else parts.push({ text: w, strong });
    });
    S.parts = parts;
  }
  SC.forEach(autoEmphasis);
  SC.forEach((S) => { S.words = wordsOf(S.parts); S.len = S.text.length; S.d = S.t1 - S.t0; });
  function partsHtml(parts, n = Infinity) {
    let used = 0;
    return parts.map((pt) => {
      const vis = Math.max(0, Math.min(pt.text.length, n - used));
      used += pt.text.length;
      return `<span class="${pt.strong ? 's' : 'l'}">${esc(pt.text.slice(0, vis))}<span class="hid">${esc(pt.text.slice(vis))}</span></span>`;
    }).join('');
  }
  const sceneAt = (t) => { let k = 0; SC.forEach((S, i) => { if (t >= S.t0) k = i; }); return k; };
  const curIndex = (t) => { const i = sceneAt(t); const S = SC[i]; return (i - 1) + (i === 0 ? 1 : p(t, S.t0, 0.6, E.out5)); };

  // ----- elementos comuns -----
  const bg = document.getElementById('bg');
  const grid = document.getElementById('grid');
  const tint = document.getElementById('tint');
  const chrome = document.getElementById('chrome');
  const ctaFoot = SC.map((S) => {
    if (S.kind !== 'cta') return null;
    const e = el('pillcta', document.getElementById('top'), `${esc(D.brand.site)} &nbsp;·&nbsp; ${esc(D.brand.handle)}`);
    e.style.top = '1500px';
    e.style.opacity = '0';
    return e;
  });
  const top = document.getElementById('top');
  const drawCommon = (t) => {
    grid.style.transform = `translateY(${-(t * 14) % 60}px)`;
    SC.forEach((S, i) => {
      const e = ctaFoot[i];
      if (!e) return;
      const q = p(t, S.t0 + 0.55, 0.5, E.back);
      e.style.opacity = String(clamp(q * 2) * (t >= S.t0 ? 1 : 0));
      e.style.transform = `translateY(${(1 - q) * 50}px) scale(${1 + Math.sin(clamp((t - S.t0 - 1.1) / 0.5) * Math.PI) * 0.04})`;
    });
  };

  // ============ 1 · TIPOGRAFIA CINÉTICA ============
  function kinetic() {
    const items = SC.map((S) => {
      const c = el('sc', stage);
      const ghostWord = ((S.words.find((w) => w.strong) || S.words[S.words.length - 1]).w.replace(/[^\p{L}\p{N}]/gu, '') || 'ESM').toUpperCase();
      const g = el('ghost', c, esc(ghostWord));
      const kick = el('kick', c, S.kind === 'hook' ? esc(S.label) : `${pad(S.i + 1)} / ${pad(SC.length)}`);
      kick.style.top = '330px';
      const box = el('kwords', c);
      box.style.fontSize = `${fsFor(S.len, S.kind === 'hook' ? 1.25 : 1.12)}px`;
      const ws = S.words.map((w) => el(`kw ${w.strong ? 's' : 'l'}`, box, `${esc(w.w)}${w.strong ? '<i class="u"></i>' : ''}`, 'span'));
      const bar = el('kbar', c);
      return { S, c, g, kick, ws, bar };
    });
    return (t) => items.forEach(({ S, c, g, kick, ws, bar }) => {
      const on = t >= S.t0 - 0.01 && t <= S.t1 + 0.02;
      c.style.display = on ? 'block' : 'none';
      if (!on) return;
      const stag = Math.min(0.12, (S.d * 0.5) / ws.length);
      ws.forEach((w, i) => {
        const q = p(t, S.t0 + 0.08 + i * stag, 0.45, E.back);
        w.style.opacity = String(clamp(q * 2.2));
        w.style.transform = `translateY(${(1 - q) * 80}px) scale(${1 + (1 - q) * 0.4})`;
        w.style.filter = q < 1 ? `blur(${(1 - clamp(q)) * 9}px)` : 'none';
        const u = w.querySelector('.u');
        if (u) u.style.transform = `scaleX(${p(t, S.t0 + 0.3 + i * stag, 0.4, E.out5)})`;
      });
      g.style.transform = `translateX(${lerp(60, -420, clamp((t - S.t0) / S.d))}px)`;
      kick.style.opacity = String(p(t, S.t0 + 0.1, 0.3));
      const a = p(t, S.t0, 0.3);
      const b = p(t, S.t0 + 0.25, 0.3, E.io);
      bar.style.transformOrigin = b > 0 ? 'right' : 'left';
      bar.style.transform = `scaleX(${a * (1 - b)})`;
      const ex = S.i === SC.length - 1 ? 0 : p(t, S.t1 - 0.2, 0.2, E.io);
      c.style.opacity = String(1 - ex);
      c.style.transform = `translateY(${-ex * 40}px)`;
    });
  }

  // ============ 2 · INTERFACE (cartões, digitação, cursor) ============
  function ui() {
    const cur = el('', top);
    cur.id = 'cursor';
    cur.innerHTML = '<svg width="54" height="54" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    const items = SC.map((S) => {
      const c = el('card', stage);
      c.style.zIndex = String(S.i + 1);
      const bar = el('bar', c, '<i class="dot" style="left:30px;background:#ff5f57"></i><i class="dot" style="left:56px;background:#febc2e"></i><i class="dot" style="left:82px;background:#28c840"></i>');
      el('ttl', bar, S.kind === 'hook' ? esc(D.brand.label) : S.kind === 'cta' ? esc(D.brand.site) : `dica ${pad(S.i)} · esm web`);
      const body = el('body', c);
      const k = S.kind === 'hook' ? 1.05 : 0.8;
      body.style.fontSize = `${fsFor(S.len, k)}px`;
      body.innerHTML = partsHtml(S.parts, 0);
      const strong = S.parts.filter((pt) => pt.strong).map((pt) => pt.text.trim()).filter(Boolean).slice(0, 3);
      const chips = strong.length ? el('chips', c) : null;
      const chipEls = strong.map((s) => el('chip', chips, `<i>✓</i>${esc(s.length > 26 ? s.slice(0, 25) + '…' : s)}`, 'span'));
      return { S, c, body, chipEls, rects: null };
    });
    // mede a posição dos chips com o cartão parado (para o cursor)
    items.forEach((it) => {
      it.body.innerHTML = partsHtml(it.S.parts);
      const base = it.c.getBoundingClientRect();
      it.rects = it.chipEls.map((ch) => { const r = ch.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      it.h = base.height;
    });
    return (t) => {
      const cu = curIndex(t);
      let cursorOn = false;
      items.forEach((it) => {
        const { S, c, body, chipEls, rects } = it;
        const d = cu - S.i;
        const on = d > -0.97 && d < 2.7;
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const y = d < 0 ? -d * 1100 : -d * 120;
        const sc = d < 0 ? 1 : 1 - d * 0.055;
        c.style.transform = `translateY(${y}px) scale(${sc})`;
        c.style.opacity = String(d < 0 ? 1 + d * 0.5 : clamp(1 - d * 0.42));
        // digitação
        const typing = d <= 0.0001 ? clamp((t - (S.t0 + 0.35)) / (S.d * 0.58)) : 1;
        const n = Math.floor(S.len * typing);
        body.innerHTML = partsHtml(S.parts, n) + (typing < 1 && d <= 0.0001 ? '<span class="caret"></span>' : '');
        chipEls.forEach((ch, k) => {
          const q = p(t, S.t0 + S.d * 0.6 + k * 0.16, 0.35, E.back);
          ch.style.opacity = String(clamp(q * 2));
          ch.style.transform = `scale(${0.6 + 0.4 * q})`;
        });
        // cursor clica no último chip
        if (S.i === sceneAt(t) && chipEls.length && t < S.t1 + 0.02) {
          const last = rects[rects.length - 1];
          const a0 = S.t0 + S.d * 0.62;
          const k = p(t, a0, S.d * 0.2, E.io);
          const cx = lerp(900, last.x, k);
          const cy = lerp(1640, last.y, k);
          const click = p(t, a0 + S.d * 0.22, 0.12) * (1 - p(t, a0 + S.d * 0.22 + 0.12, 0.15));
          cur.style.opacity = String(clamp((t - a0) / 0.2));
          cur.style.transform = `translate(${cx}px,${cy}px) scale(${1 - click * 0.2})`;
          cursorOn = true;
          const hit = t > a0 + S.d * 0.22;
          const lastChip = chipEls[chipEls.length - 1];
          lastChip.style.background = hit ? '#ECEEF1' : '#24262B';
          lastChip.style.color = hit ? '#0A0B0D' : '#E4E6E9';
        }
      });
      if (!cursorOn) cur.style.opacity = '0';
    };
  }

  // ============ 3 · PASSOS (trilho + painel) ============
  function steps() {
    const N = SC.length;
    const y = (i) => 360 + (1140 * i) / Math.max(1, N - 1);
    el('rail', stage);
    const fill = el('railfill', stage);
    const dots = SC.map((S) => { const d = el('rdot', stage); d.style.top = `${y(S.i) - 13}px`; return d; });
    const items = SC.map((S) => {
      const c = el('sc', stage);
      const num = el('bignum', c, pad(S.i + 1));
      const panel = el('panel', c);
      panel.innerHTML = `<div class="pk">${S.kind === 'hook' ? esc(D.brand.label) : `${pad(S.i + 1)} / ${pad(N)}`}</div><div class="tx" style="font-size:${fsFor(S.len, S.kind === 'hook' ? 0.95 : 0.78)}px">${partsHtml(S.parts)}</div>`;
      const h = panel.getBoundingClientRect().height;
      panel.style.top = `${900 - h / 2}px`;
      return { S, c, num, panel };
    });
    return (t) => {
      const cu = curIndex(t);
      fill.style.transform = `scaleY(${clamp(cu / Math.max(1, N - 1))})`;
      dots.forEach((d, i) => {
        const done = cu >= i - 0.02;
        d.style.background = done ? '#D4D7DC' : '#0A0B0D';
        d.style.borderColor = done ? '#D4D7DC' : '#3A3C43';
        const act = Math.round(cu) === i;
        d.style.boxShadow = act ? `0 0 0 ${6 + Math.sin(t * 6) * 3}px rgba(212,215,220,.18)` : 'none';
      });
      items.forEach(({ S, c, num, panel }) => {
        const on = t >= S.t0 - 0.01 && t <= S.t1 + 0.02;
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const q = p(t, S.t0, 0.6, E.spring);
        const ex = S.i === N - 1 ? 0 : p(t, S.t1 - 0.22, 0.22, E.io);
        panel.style.transform = `translateX(${(1 - q) * 420 - ex * 140}px)`;
        panel.style.opacity = String(clamp(q * 2.5) * (1 - ex));
        panel.style.setProperty('--hl', `${p(t, S.t0 + 0.55, 0.5, E.out5) * 100}%`);
        num.style.opacity = String(p(t, S.t0, 0.4) * (1 - ex));
        num.style.transform = `translateX(${(1 - p(t, S.t0, 0.7, E.out5)) * 160}px)`;
      });
    };
  }

  // ============ 4 · FORMAS GEOMÉTRICAS (risografia) ============
  function shapes() {
    tint.style.background = 'radial-gradient(700px 520px at 50% 34%,rgba(255,107,94,.13),transparent 70%)';
    tint.style.opacity = '1';
    const PRE = [
      { w: 560, h: 560, r: 280, rot: 0, f: 1 },
      { w: 500, h: 500, r: 70, rot: 45, f: 0 },
      { w: 820, h: 210, r: 105, rot: 0, f: 1 },
      { w: 560, h: 560, r: 280, rot: 0, f: 0 },
      { w: 470, h: 470, r: 0, rot: 90, f: 1 },
      { w: 720, h: 330, r: 165, rot: -10, f: 0 },
    ];
    const pre = (i) => (i === SC.length - 1 ? { w: 560, h: 560, r: 280, rot: 0, f: 1 } : PRE[i % PRE.length]);
    const shp = el('shp', stage); const fillEl = el('fill', shp);
    const shp2 = el('shp2', stage);
    const logo = el('', stage, `<img src="${D.brand.logo}" style="width:300px;display:block">`);
    logo.style.cssText = 'position:absolute;left:390px;top:540px;opacity:0';
    const sats = [0, 1, 2].map(() => el('sdot', stage));
    const pulses = SC.map(() => el('pulse', stage));
    const items = SC.map((S) => {
      const c = el('sc', stage);
      const kick = el('skick', c, S.kind === 'hook' ? esc(D.brand.label) : `— ${pad(S.i + 1)}`);
      const box = el('swords', c);
      box.style.fontSize = `${fsFor(S.len, S.kind === 'hook' ? 0.88 : 0.78)}px`;
      const ws = S.words.map((w) => { const o = el(`sw ${w.strong ? 's' : 'l'}`, box, '', 'span'); el('', o, esc(w.w), 'span'); return o.firstChild; });
      return { S, c, kick, ws };
    });
    return (t) => {
      const i = sceneAt(t); const S = SC[i];
      const A = pre(Math.max(0, i - 1)); const B = pre(i);
      const k = i === 0 ? 1 : p(t, S.t0, 0.8, E.spring);
      const w = lerp(A.w, B.w, k); const h = lerp(A.h, B.h, k); const r = Math.max(0, lerp(A.r, B.r, k));
      const rot = lerp(A.rot, B.rot, k) + Math.sin(t * 0.9) * 2;
      const f = clamp(lerp(A.f, B.f, k));
      const set = (n, dx, dy) => {
        n.style.width = `${w}px`; n.style.height = `${h}px`; n.style.borderRadius = `${r}px`;
        n.style.transform = `translate(${540 - w / 2 + dx}px,${600 - h / 2 + dy}px) rotate(${rot}deg)`;
      };
      set(shp, 0, 0); set(shp2, 26 + Math.sin(t * 1.3) * 6, 20);
      fillEl.style.opacity = String(f);
      logo.style.opacity = String(S.kind === 'cta' ? p(t, S.t0 + 0.4, 0.5) : 0);
      sats.forEach((s, n) => {
        const a = t * 0.9 + n * 2.09; const R = 400 + n * 24;
        s.style.transform = `translate(${540 + Math.cos(a) * R - 9}px,${600 + Math.sin(a) * R * 0.62 - 9}px) scale(${0.8 + n * 0.3})`;
        s.style.opacity = String(0.8 - n * 0.2);
      });
      pulses.forEach((pl, n) => {
        const q = clamp((t - SC[n].t0) / 0.9);
        pl.style.opacity = String(q > 0 && q < 1 ? 0.5 * (1 - q) : 0);
        const sz = lerp(300, 1100, E.out3(q));
        pl.style.width = `${sz}px`; pl.style.height = `${sz}px`;
        pl.style.transform = `translate(${540 - sz / 2}px,${600 - sz / 2}px)`;
      });
      items.forEach(({ S: s, c, kick, ws }) => {
        const on = t >= s.t0 - 0.01 && t <= s.t1 + 0.02;
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const stag = Math.min(0.1, (s.d * 0.5) / ws.length);
        const ex = s.i === SC.length - 1 ? 0 : p(t, s.t1 - 0.2, 0.2, E.io);
        ws.forEach((wd, n) => { wd.style.transform = `translateY(${(1 - p(t, s.t0 + 0.15 + n * stag, 0.5, E.out5)) * 118 + ex * -90}%)`; });
        kick.style.opacity = String(p(t, s.t0 + 0.1, 0.3) * (1 - ex));
      });
    };
  }

  // ============ 5 · TERMINAL ============
  function terminal() {
    const win = el('term', stage);
    const tb = el('tb', win, '<i class="dot" style="left:30px;background:#ff5f57"></i><i class="dot" style="left:56px;background:#febc2e"></i><i class="dot" style="left:82px;background:#28c840"></i>');
    el('t', tb, 'esm-web — zsh');
    const lines = el('lines', win);
    const items = SC.map((S) => {
      const ln = el('tl', lines);
      ln.style.fontSize = `${S.kind === 'hook' ? 44 : S.len > 120 ? 31 : S.len > 80 ? 34 : 38}px`;
      return { S, ln };
    });
    const kick = el('kick', stage, esc(D.brand.label)); kick.style.top = '210px';
    const prog = el('tprog', stage, '<i></i>');
    const cnt = el('tcount', stage);
    return (t) => {
      const cu = sceneAt(t);
      items.forEach(({ S, ln }) => {
        const started = t >= S.t0;
        ln.style.display = started ? 'block' : 'none';
        if (!started) return;
        const age = cu - S.i;
        const typing = age === 0 ? clamp((t - (S.t0 + 0.15)) / (S.d * 0.62)) : 1;
        const n = Math.floor(S.len * typing);
        const blink = Math.floor(t * 2.6) % 2 === 0 || typing < 1;
        ln.innerHTML = `<span class="pr">❯</span>${partsHtml(S.parts, n)}${typing >= 1 && age > 0 ? '<span class="ok">✓</span>' : ''}${age === 0 && blink ? '<span class="blk"></span>' : ''}`;
        ln.style.opacity = String(clamp(p(t, S.t0, 0.15)) * Math.max(0.32, 1 - age * 0.2));
      });
      prog.firstChild.style.width = `${(t / D.dur) * 100}%`;
      cnt.textContent = `${pad(cu + 1)} / ${pad(SC.length)}`;
    };
  }

  const STYLES = { kinetic, ui, steps, shapes, terminal };
  const draw = (STYLES[D.style] || kinetic)();
  window.__draw = (t) => { drawCommon(t); draw(t); };
  window.__draw(0);
})();
