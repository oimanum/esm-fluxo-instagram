// Roda dentro do Chrome. Tudo é função do tempo: window.__draw(t) desenha o quadro do instante t (segundos).
(() => {
  const D = window.__DATA;
  const SC = D.scenes;
  const N = SC.length;
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'); const bg = $('bg'); const top = $('top'); const chrome = $('chrome');
  const ctx = $('fx').getContext('2d');
  const chromeLogo = chrome.querySelector('img'); const chromeH = chrome.querySelector('.h');
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
  const css = (n, s) => { n.style.cssText += `;${s}`; return n; };
  const pad = (n) => String(n).padStart(2, '0');
  const fsFor = (n, k = 1) => Math.round((n <= 34 ? 96 : n <= 60 ? 84 : n <= 90 ? 72 : 62) * k);
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const tc = (t) => `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 30))}`;
  const clean = (w) => w.replace(/[^\p{L}\p{N}]/gu, '');

  // ----- texto: destaque marcado (**) ou, sem marcação, as 2 palavras mais longas -----
  function autoEmphasis(S) {
    if (S.parts.length !== 1 || !S.parts[0].strong) return;
    const toks = S.text.split(/(\s+)/);
    const cand = toks.map((w, k) => ({ k, n: clean(w).length })).filter((x) => x.n >= 5 && !/^\s+$/.test(toks[x.k]));
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
  SC.forEach((S) => {
    S.words = S.parts.flatMap((pt) => pt.text.split(/\s+/).filter(Boolean).map((w) => ({ w, strong: pt.strong })));
    S.len = S.text.length; S.d = S.t1 - S.t0;
    const strongs = S.words.filter((w) => w.strong);
    const pool = (strongs.length ? strongs : S.words).map((w) => clean(w.w)).filter(Boolean);
    S.big = (pool.sort((a, b) => b.length - a.length)[0] || 'ESM').toUpperCase();
  });
  const sceneAt = (t) => { let k = 0; SC.forEach((S, i) => { if (t >= S.t0) k = i; }); return k; };
  const curIndex = (t) => { const i = sceneAt(t); return i === 0 ? 0 : (i - 1) + p(t, SC[i].t0, 0.7, E.out5); };
  const blurIn = (n, q, dy = 40, sc = 1) => {
    n.style.opacity = String(clamp(q * 2.2));
    n.style.transform = `translateY(${(1 - q) * dy}px) scale(${lerp(sc, 1, q)})`;
    n.style.filter = q < 1 ? `blur(${(1 - clamp(q)) * 12}px)` : 'none';
  };
  // palavras em linha corrida (cada uma animada separadamente)
  const wordSpans = (box, S, fn) => S.words.map((w) => { const n = el('w', box, esc(w.w), 'span'); n.style.margin = '0 .12em'; fn(n, w); return n; });

  // ----- rodapé comum: pílula do CTA, cores por estilo -----
  const PILL = { ember: ['#FF5A1F', '#1b0a05'], editorial: ['#2F4BFF', '#fff'], gradient: ['#fff', '#0a0a0a'], selection: null, perspective: ['#14161D', '#fff'] }[D.style];
  const ctaFoot = SC.map((S) => {
    if (S.kind !== 'cta' || !PILL) return null;
    const e = el('pillcta', top, `${esc(D.brand.site)} &nbsp;↗`);
    css(e, `top:1500px;opacity:0;background:${PILL[0]};color:${PILL[1]}`);
    return e;
  });
  const setChrome = (ink, light) => {
    chromeLogo.style.filter = light ? 'brightness(.18)' : 'none';
    chromeH.style.color = ink;
  };

  // ----- efeitos de partículas (canvas) -----
  const embers = (() => { const r = rng(11); return Array.from({ length: 70 }, () => ({ x: r() * 1080, y: r() * 2100, s: 20 + r() * 70, z: 1 + r() * 3, f: 0.4 + r() * 1.2, ph: r() * 6.28 })); })();
  function drawEmbers(t) {
    embers.forEach((e) => {
      const y = ((e.y - t * e.s) % 2100 + 2100) % 2100 - 100;
      const x = e.x + Math.sin(t * e.f + e.ph) * 36;
      ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * e.f * 2 + e.ph));
      ctx.fillStyle = e.z > 3 ? '#FFB38A' : '#FF6A2B';
      ctx.beginPath(); ctx.arc(x, y, e.z, 0, 6.283); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  const stars = (() => { const r = rng(5); return Array.from({ length: 60 }, () => ({ x: r() * 1080, y: r() * 1920, z: 1 + r() * 2, ph: r() * 6.28 })); })();
  function drawStars(t) {
    stars.forEach((s) => { ctx.globalAlpha = 0.15 + 0.45 * Math.abs(Math.sin(t * 0.8 + s.ph)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.z, 0, 6.283); ctx.fill(); });
    ctx.globalAlpha = 1;
  }
  function burst(t, tb, ox, oy, count, colors, seed, life = 2.4, grav = 900, speed = 900) {
    const lt = t - tb;
    if (lt < 0 || lt > life) return;
    const r = rng(seed);
    for (let k = 0; k < count; k++) {
      const a = r() * 6.283; const v = (0.25 + r()) * speed; const rot = r() * 6.28; const sz = 6 + r() * 12; const c = colors[Math.floor(r() * colors.length)];
      const x = ox + Math.cos(a) * v * lt; const y = oy + Math.sin(a) * v * lt + 0.5 * grav * lt * lt * 0.35;
      ctx.globalAlpha = clamp(1 - lt / life); ctx.fillStyle = c;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot + lt * 6); ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  const drawCommon = (t) => {
    ctx.clearRect(0, 0, 1080, 1920);
    SC.forEach((S, i) => {
      const e = ctaFoot[i];
      if (!e) return;
      const q = p(t, S.t0 + 0.6, 0.5, E.back);
      e.style.opacity = String(clamp(q * 2) * (t >= S.t0 ? 1 : 0));
      e.style.transform = `translateY(${(1 - q) * 50}px) scale(${1 + Math.sin(clamp((t - S.t0 - 1.2) / 0.5) * Math.PI) * 0.04})`;
    });
  };
  const gateScene = (t, S, tail = 0.3) => t >= S.t0 - 0.01 && t <= S.t1 + tail;
  const exitOf = (t, S, d = 0.18) => (S.i === N - 1 ? 0 : p(t, S.t1 - d, d, E.io));

  // ============================================================================
  // 1 · EMBER — fundo escuro com brasa, HUD, palavras gigantes e painel laranja
  // ============================================================================
  function ember() {
    const OR = '#FF5A1F';
    bg.style.background = 'radial-gradient(1100px 900px at 18% 12%,#3b1507 0%,#170a07 46%,#07050a 100%)';
    const hud = el('', top);
    [['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].forEach(([x, y]) => {
      const c = el('hudc', hud); css(c, `${x}:36px;${y}:36px;border-${y}-width:2px;border-${x}-width:2px;border-color:rgba(255,255,255,.3)`);
    });
    const hl = css(el('hudt', hud), 'left:80px;bottom:78px'); const hr = css(el('hudt', hud), 'right:80px;bottom:78px');
    const items = SC.map((S) => {
      const v = S.kind === 'cta' ? 3 : S.kind === 'hook' ? 1 : S.i % 3 === 2 ? 2 : 0;
      const c = el('sc', stage);
      const o = { S, v, c };
      if (v === 1) {
        o.rows = [520, 1190, 1360].map((y, k) => { const r = el('abs mono', c, Array(7).fill(esc(S.big)).join('&nbsp;&nbsp;✦&nbsp;&nbsp;')); css(r, `left:0;top:${y}px;white-space:nowrap;font-family:'Inter Tight';font-weight:800;font-size:190px;line-height:1;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,${k ? 0.07 : 0.1})`); return r; });
        o.kick = css(el('kick', c, S.kind === 'hook' ? esc(S.label) : `[ ${pad(S.i + 1)} ]`), `left:0;right:0;text-align:center;top:560px;color:${OR}`);
        o.giant = css(el('abs', c, esc(S.big)), `left:0;right:0;top:${760}px;text-align:center;font-weight:800;line-height:1;letter-spacing:-.05em;font-size:${Math.min(300, Math.floor(950 / (S.big.length * 0.6)))}px;text-shadow:0 0 90px rgba(255,90,31,.45)`);
        const sub = css(el('abs', c), `left:90px;right:90px;top:1040px;text-align:center;font-size:${S.len > 70 ? 42 : 48}px;line-height:1.18;letter-spacing:-.02em;font-weight:500;color:#d8cdc7`);
        o.sub = wordSpans(sub, S, (n, w) => { if (w.strong) css(n, `color:${OR};font-weight:800`); });
      } else if (v === 2) {
        o.panel = css(el('abs', c), `inset:0;background:${OR}`);
        o.tag = css(el('kick', o.panel, `CASE ${pad(S.i + 1)} — ${esc(D.brand.label.split('·')[0].trim())}`), 'left:80px;top:560px;color:#1b0a05');
        o.badge = css(el('abs', o.panel, `<div style="font-family:'Inter Tight';font-weight:800;font-size:96px;letter-spacing:-.04em">${pad(S.i + 1)}</div>`), 'right:90px;top:480px;width:230px;height:230px;border-radius:50%;border:4px dashed #1b0a05;color:#1b0a05;display:flex;align-items:center;justify-content:center');
        const b = css(el('abs', o.panel), `left:80px;right:80px;top:780px;font-size:${fsFor(S.len, 1.02)}px;line-height:1.04;letter-spacing:-.045em;font-weight:800;color:#1b0a05`);
        o.words = S.words.map((w) => { const m = css(el('m', b), 'margin-right:.2em;padding-bottom:.1em'); const s = css(el('', m, esc(w.w), 'span'), `display:block;${w.strong ? 'color:#fff' : 'font-weight:600'}`); return s; });
      } else if (v === 0) {
        o.num = css(el('kick', c, `[ ${pad(S.i + 1)} ]`), `left:80px;top:690px;color:${OR}`);
        o.ln = css(el('line', c), 'left:80px;top:742px;width:220px');
        const b = css(el('abs', c), `left:80px;right:80px;top:790px;font-size:${fsFor(S.len, 1.08)}px;line-height:1.03;letter-spacing:-.045em;font-weight:800`);
        o.words = S.words.map((w) => { const m = css(el('m', b), 'margin-right:.2em;padding-bottom:.1em'); const s = css(el('', m, esc(w.w), 'span'), `display:block;${w.strong ? `color:${OR}` : 'color:#EDE4DF;font-weight:500'}`); return s; });
      } else {
        o.logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:330px;top:380px;width:420px');
        o.ring = css(el('abs', c), `left:0;top:0;width:10px;height:10px;border:3px solid ${OR};border-radius:50%`);
        const b = css(el('abs', c), `left:80px;right:80px;top:850px;text-align:center;font-size:${fsFor(S.len, 0.95)}px;line-height:1.06;letter-spacing:-.04em;font-weight:800`);
        o.words = S.words.map((w) => { const m = css(el('m', b), 'margin:0 .1em;padding-bottom:.1em'); return css(el('', m, esc(w.w), 'span'), `display:block;${w.strong ? `color:${OR}` : 'color:#fff'}`); });
      }
      return o;
    });
    return (t) => {
      setChrome('#a9958b', false);
      drawEmbers(t);
      const cur = SC[sceneAt(t)];
      hl.textContent = `${pad(cur.i + 1)} / ${pad(N)} · ${D.brand.label.split('·')[1]?.trim() || 'ESM WEB'}`;
      hr.innerHTML = `<span style="color:#ff4b2b">●</span> ${tc(t)}`;
      items.forEach((o) => {
        const { S, v, c } = o;
        const on = gateScene(t, S);
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const lt = t - S.t0; const ex = exitOf(t, S);
        c.style.opacity = String(v === 2 ? 1 : 1 - ex);
        c.style.filter = v === 2 || !ex ? 'none' : `blur(${ex * 10}px)`;
        const stag = Math.min(0.1, (S.d * 0.45) / Math.max(1, (o.words || o.sub || []).length));
        if (v === 1) {
          const q = p(t, S.t0 + 0.05, 0.55, E.back);
          o.giant.style.opacity = String(clamp(q * 3));
          o.giant.style.transform = `scale(${1.4 - 0.4 * q})`;
          o.giant.style.filter = q < 1 ? `blur(${(1 - clamp(q)) * 16}px)` : 'none';
          o.rows.forEach((r, k) => { r.style.transform = `translateX(${(k % 2 ? 1 : -1) * lt * 110 - 200}px)`; r.style.opacity = String(p(t, S.t0, 0.4)); });
          o.kick.style.opacity = String(p(t, S.t0 + 0.1, 0.3));
          o.sub.forEach((n, k) => blurIn(n, p(t, S.t0 + 0.35 + k * stag, 0.45, E.out5), 30));
        } else if (v === 2) {
          const q = p(t, S.t0, 0.42, E.io); const x = ex ? p(t, S.t1 - 0.18, 0.18, E.io) : 0;
          o.panel.style.clipPath = `inset(${(1 - q) * 100}% 0 ${x * 100}% 0)`;
          o.badge.style.transform = `rotate(${lt * 40}deg) scale(${p(t, S.t0 + 0.3, 0.5, E.back)})`;
          o.badge.firstChild.style.transform = `rotate(${-lt * 40}deg)`;
          o.words.forEach((n, k) => { n.style.transform = `translateY(${(1 - p(t, S.t0 + 0.25 + k * stag, 0.5, E.out5)) * 115}%)`; });
        } else if (v === 0) {
          o.ln.style.transform = `scaleX(${p(t, S.t0 + 0.05, 0.5, E.out5)})`;
          o.num.style.opacity = String(p(t, S.t0, 0.3));
          o.words.forEach((n, k) => { n.style.transform = `translateY(${(1 - p(t, S.t0 + 0.12 + k * stag, 0.5, E.out5)) * 115}%)`; });
        } else {
          const q = p(t, S.t0 + 0.05, 0.7, E.out5);
          o.logo.style.opacity = String(q); o.logo.style.transform = `scale(${0.85 + 0.15 * q})`;
          const rq = clamp((t - S.t0 - 0.1) / 1.2);
          const sz = lerp(60, 1300, E.out3(rq));
          css(o.ring, `width:${sz}px;height:${sz}px;left:${540 - sz / 2}px;top:${590 - sz / 2}px;opacity:${0.6 * (1 - rq)}`);
          o.words.forEach((n, k) => { n.style.transform = `translateY(${(1 - p(t, S.t0 + 0.4 + k * stag, 0.5, E.out5)) * 115}%)`; });
          burst(t, S.t0 + 0.1, 540, 590, 70, ['#FF5A1F', '#FFB38A', '#fff'], 31, 1.8, 600, 700);
        }
      });
    };
  }

  // ============================================================================
  // 2 · EDITORIAL — fundo escuro e claro alternados, troca em círculo, serifa itálica
  // ============================================================================
  function editorial() {
    const BLUE = '#2F4BFF';
    const isDark = (S) => S.kind !== 'line' || S.i % 2 === 0;
    const items = SC.map((S) => {
      const dark = isDark(S);
      const ink = dark ? '#fff' : '#12152B'; const soft = dark ? '#7F98FF' : BLUE;
      const ring = css(el('abs', stage), `inset:0;background:${BLUE};z-index:${S.i * 2}`);
      const c = css(el('sc', stage), `z-index:${S.i * 2 + 1};background:${dark ? 'radial-gradient(900px 800px at 70% 20%,#16237a 0%,#0A0E2A 62%)' : 'radial-gradient(900px 700px at 20% 15%,#ffffff 0%,#F3F3EE 70%)'}`);
      const r = rng(S.i * 97 + 13);
      const cards = Array.from({ length: 6 }, (_, k) => {
        const g = css(el('gcard', c), dark
          ? 'background:linear-gradient(150deg,rgba(90,120,255,.30),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.14)'
          : 'background:#fff;box-shadow:0 30px 70px rgba(40,60,140,.14)');
        const accents = [BLUE, '#FF8A4C', '#2BC48A'];
        css(el('bar', g), `background:${accents[k % 3]}`);
        [[70, 70], [100, 50], [130, 36]].forEach(([y, w], n) => css(el(`l${n + 1}`, g), `top:${y}px;width:${w}%;background:${dark ? 'rgba(255,255,255,.18)' : 'rgba(20,30,70,.10)'}`));
        return { g, x: r() * 760 - 40, y: 200 + r() * 1300, rot: r() * 24 - 12, sc: 0.7 + r() * 0.6, bl: r() < 0.4 ? 0 : 3 + r() * 6, ph: r() * 6, fl: 0.5 + r() };
      });
      const kick = css(el('kick', c, S.kind === 'hook' ? esc(S.label) : `${pad(S.i + 1)} — ${esc(D.brand.label.split('·')[1]?.trim() || 'ESM WEB')}`), `left:0;right:0;text-align:center;top:520px;color:${soft}`);
      const fs = fsFor(S.len, S.kind === 'hook' ? 1.18 : 1.08);
      const box = css(el('abs', c), `left:60px;right:60px;top:900px;transform:translateY(-50%);text-align:center;line-height:1.02;letter-spacing:-.04em;font-size:${fs}px;color:${ink}`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' serif'; css(n, `color:${soft};font-size:${Math.round(fs * 1.22)}px;letter-spacing:-.02em`); } else css(n, 'font-weight:800'); });
      const tagsRow = css(el('abs', c), 'left:0;right:0;top:1290px;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;padding:0 60px');
      const tags = S.kind === 'line' && !dark ? S.parts.filter((pt) => pt.strong).map((pt) => pt.text.trim()).slice(0, 3).map((s, k) => css(el('tag', tagsRow, `<b style="background:${['#2F4BFF', '#FF8A4C', '#2BC48A'][k % 3]}"></b>${esc(s.length > 24 ? s.slice(0, 23) + '…' : s)}`), 'background:#fff;color:#12152B;box-shadow:0 12px 30px rgba(40,60,140,.12)')) : [];
      let logo = null;
      if (S.kind === 'cta') logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:370px;top:360px;width:340px');
      return { S, dark, ink, ring, c, cards, kick, words, tags, logo };
    });
    return (t) => {
      const cs = SC[sceneAt(t)]; const dk = isDark(cs);
      setChrome(dk ? '#9AA7E6' : '#5A6285', !dk);
      items.forEach((o) => {
        const { S, ring, c } = o;
        const on = gateScene(t, S, 1.0) && t >= S.t0 - 0.01;
        const r1 = S.i === 0 ? 3000 : p(t, S.t0, 0.75, E.io) * 3000; const r2 = S.i === 0 ? 3000 : p(t, S.t0 + 0.14, 0.75, E.io) * 3000;
        const done = r2 >= 2999 && t > S.t1 + 0.2;
        ring.style.display = on && r1 < 2999 ? 'block' : 'none';
        c.style.display = on && !done ? 'block' : 'none';
        if (!on || done) return;
        ring.style.clipPath = `circle(${r1}px at 540px 1150px)`;
        c.style.clipPath = `circle(${r2}px at 540px 1150px)`;
        const lt = t - S.t0;
        o.cards.forEach((k) => {
          const q = p(t, S.t0 + 0.2, 0.8, E.out5);
          k.g.style.opacity = String(q * (o.dark ? 0.7 : 0.9));
          k.g.style.filter = `blur(${k.bl}px)`;
          k.g.style.transform = `translate(${k.x + Math.sin(lt * 0.5 * k.fl + k.ph) * 30}px,${k.y + Math.cos(lt * 0.4 * k.fl + k.ph) * 40 + (1 - q) * 120}px) rotate(${k.rot + Math.sin(lt * 0.3 + k.ph) * 4}deg) scale(${k.sc})`;
        });
        o.kick.style.opacity = String(p(t, S.t0 + 0.3, 0.3));
        const stag = Math.min(0.1, (S.d * 0.45) / o.words.length);
        o.words.forEach((n, k) => blurIn(n, p(t, S.t0 + 0.3 + k * stag, 0.5, E.out5), 36, 0.94));
        o.tags.forEach((n, k) => { const q = p(t, S.t0 + S.d * 0.55 + k * 0.15, 0.4, E.back); n.style.opacity = String(clamp(q * 2)); n.style.transform = `scale(${0.6 + 0.4 * q})`; });
        if (o.logo) { const q = p(t, S.t0 + 0.5, 0.7, E.out5); o.logo.style.opacity = String(q); o.logo.style.transform = `translateY(${(1 - q) * 40}px)`; }
      });
    };
  }

  // ============================================================================
  // 3 · GRADIENT — preto, texto em degradê, blocos de interface ao fundo, confete
  // ============================================================================
  function gradient() {
    bg.style.background = 'radial-gradient(900px 700px at 50% 38%,rgba(120,80,255,.16),transparent 70%),#050507';
    const cols = css(el('abs', stage), 'left:-120px;top:-300px;width:1320px;height:2500px;transform:rotate(-9deg)');
    const r = rng(21);
    const PAL = [['#7C4DFF', '#FF5FD2'], ['#FF8A4C', '#FF5FD2'], ['#2BC4FF', '#7C4DFF'], ['#FFB04D', '#FF5F7A'], ['#5F7CFF', '#2BC4FF']];
    const colEls = [0, 1, 2].map((ci) => {
      const col = css(el('abs', cols), `left:${ci * 420 + 20}px;top:0;width:390px`);
      for (let k = 0; k < 7; k++) {
        const pl = PAL[Math.floor(r() * PAL.length)];
        const h = 360 + Math.floor(r() * 180);
        const tl = css(el('tile', col), `position:relative;margin-bottom:30px;width:390px;height:${h}px;background:linear-gradient(${Math.floor(r() * 360)}deg,${pl[0]},${pl[1]})`);
        el('', tl, '', 'i');
        css(el('', tl), 'position:absolute;left:26px;top:26px;width:42%;height:12px;border-radius:6px;background:rgba(255,255,255,.55)');
        css(el('', tl), 'position:absolute;left:26px;top:52px;width:28%;height:10px;border-radius:5px;background:rgba(255,255,255,.3)');
      }
      return col;
    });
    const items = SC.map((S) => {
      const c = el('sc', stage);
      const pill = css(el('', c, `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#FF5FD2;margin-right:14px"></span>${S.kind === 'hook' ? esc(S.label) : `${esc(D.brand.label.split('·')[1]?.trim() || 'ESM WEB')} · ${pad(S.i + 1)} / ${pad(N)}`}`), 'position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:560px;padding:14px 30px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.05);font-family:JetBrains Mono;font-size:21px;letter-spacing:.2em;text-transform:uppercase;color:#d7d7e6');
      const fs = fsFor(S.len, S.kind === 'hook' ? 1.15 : 1.05);
      const box = css(el('abs', c), `left:60px;right:60px;top:930px;transform:translateY(-50%);text-align:center;line-height:1.04;letter-spacing:-.04em;font-size:${fs}px`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' grad'; css(n, `font-weight:800;font-size:${Math.round(fs * 1.1)}px`); } else css(n, 'font-weight:400;color:#DADAE6'); });
      let logo = null; let glow = null;
      if (S.kind === 'cta') {
        glow = css(el('abs', c), 'left:140px;top:150px;width:800px;height:640px;background:radial-gradient(closest-side,rgba(160,107,255,.45),rgba(255,95,210,.18) 55%,transparent);filter:blur(10px)');
        logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:350px;top:340px;width:380px');
      }
      return { S, c, pill, words, logo, glow };
    });
    return (t) => {
      setChrome('#9a9ab0', false);
      drawStars(t);
      const i = sceneAt(t); const S0 = SC[i];
      const prev = SC[Math.max(0, i - 1)];
      const f = (S) => (S.kind === 'line' && S.i % 3 === 1 ? 0.55 : 0.16);
      const op = i === 0 ? f(S0) : lerp(f(prev), f(S0), p(t, S0.t0, 0.6, E.io));
      cols.style.opacity = String(op);
      cols.style.filter = `blur(${lerp(5, 1.5, op / 0.55)}px)`;
      colEls.forEach((col, k) => { col.style.transform = `translateY(${(k % 2 ? 1 : -1) * t * 46 - (k % 2 ? 380 : 0)}px)`; });
      items.forEach((o) => {
        const { S, c } = o;
        const on = gateScene(t, S);
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const ex = exitOf(t, S);
        c.style.opacity = String(1 - ex); c.style.filter = ex ? `blur(${ex * 12}px)` : 'none';
        o.pill.style.opacity = String(p(t, S.t0 + 0.05, 0.3));
        const stag = Math.min(0.1, (S.d * 0.45) / o.words.length);
        o.words.forEach((n, k) => blurIn(n, p(t, S.t0 + 0.12 + k * stag, 0.5, E.out5), 30, 0.9));
        if (o.logo) {
          const q = p(t, S.t0 + 0.15, 0.7, E.out5);
          o.logo.style.opacity = String(q); o.logo.style.transform = `scale(${0.8 + 0.2 * q})`; o.glow.style.opacity = String(q);
          burst(t, S.t0 + 0.1, 540, 480, 90, ['#A06BFF', '#FF5FD2', '#FFB04D', '#2BC4FF', '#fff'], 77, 2.6, 900, 950);
        }
      });
    };
  }

  // ============================================================================
  // 4 · SELECTION — estética de ferramenta de design: caixa de seleção laranja, etiquetas
  // ============================================================================
  function selection() {
    const OR = '#FF5A1F';
    const TAGS = ['headline', 'copy', 'hero', 'callout', 'label', 'cta'];
    const isDark = (S) => S.kind !== 'line' || S.i % 2 === 0;
    const cur = css(el('', top, `<svg width="46" height="46" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg><div class="stag" style="left:20px;top:34px;background:#1b1b1d;color:#fff">esm</div>`), 'position:absolute;left:0;top:0;opacity:0;z-index:50');
    const items = SC.map((S) => {
      const dark = isDark(S);
      const ink = dark ? '#fff' : '#111114'; const mute = dark ? '#8d8d95' : '#6f6f78';
      const c = css(el('sc', stage), `z-index:${S.i + 1};background:${dark ? '#0b0b0d' : '#F4F4F0'}`);
      css(el('abs', c), `inset:0;background-image:radial-gradient(${dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.13)'} 1.6px,transparent 1.7px);background-size:40px 40px`);
      [[1290, 560], [1470, 380]].forEach(([y, w], k) => {
        const sk = css(el('skel', c), `left:${k ? 600 - 0 : 70}px;top:${y}px;width:${w}px;height:150px;background:${dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.045)'}`);
        [34, 66, 98].forEach((yy, n) => css(el('', sk, '', 'i'), `top:${yy}px;width:${[70, 48, 58][n]}%;background:${dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)'}`));
      });
      const cap = css(el('', c, `${esc(D.brand.label.split('·')[0].trim())} / ${esc(D.brand.label.split('·')[1]?.trim().toLowerCase() || 'sites')}`), `position:absolute;left:70px;bottom:110px;padding:8px 16px;background:${dark ? '#fff' : '#111114'};color:${dark ? '#111114' : '#fff'};font-family:JetBrains Mono;font-size:20px;letter-spacing:.04em`);
      let box; let words = []; let bar = null; let typed = null;
      if (S.kind === 'cta') {
        box = css(el('abs', c), 'left:90px;right:90px;top:640px;text-align:center;line-height:1.04;letter-spacing:-.045em;font-weight:800;font-size:' + fsFor(S.len, 1.1) + 'px;color:' + ink);
        words = wordSpans(box, S, (n, w) => { if (w.strong) css(n, `color:${OR}`); });
        bar = css(el('abs', c), 'left:110px;top:1010px;width:860px;height:112px;border-radius:56px;background:#1c1c1f');
        typed = css(el('abs', bar), 'left:44px;top:30px;font-family:JetBrains Mono;font-size:34px;color:#fff;white-space:nowrap');
        css(el('abs', bar, '↑'), 'right:16px;top:16px;width:80px;height:80px;border-radius:50%;background:#fff;color:#111;font-size:40px;text-align:center;line-height:78px;font-weight:800');
      } else {
        box = css(el('abs', c), `left:110px;right:110px;top:820px;text-align:center;line-height:1.05;letter-spacing:-.045em;font-size:${fsFor(S.len, 1.12)}px;color:${ink}`);
        words = wordSpans(box, S, (n, w) => { if (w.strong) css(n, `font-weight:800;padding:0 .08em;background-image:linear-gradient(rgba(255,90,31,.30),rgba(255,90,31,.30));background-repeat:no-repeat;background-position:0 100%;background-size:0% 100%`); else css(n, 'font-weight:500'); });
      }
      const target = bar || box;
      const rc = target.getBoundingClientRect();
      const W = rc.width + (bar ? 40 : 56); const H = rc.height + (bar ? 36 : 48);
      const X = rc.left - (bar ? 20 : 28); const Y = rc.top - (bar ? 18 : 24);
      const sel = css(el('sel', c), `left:${X}px;top:${Y}px;width:${W}px;height:${H}px`);
      const hs = [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2]].map(([x, y]) => css(el('hnd', sel), `left:${x}px;top:${y}px`));
      const tag = css(el('stag', c, TAGS[S.i % TAGS.length]), `left:${X - 2}px;top:${Y - 36}px`);
      const size = css(el('stag', c, `${Math.round(W)} × ${Math.round(H)}`), `left:${X + W - 120}px;top:${Y + H + 14}px;background:#1b1b1d;color:#fff`);
      return { S, dark, c, words, sel, hs, tag, size, X, Y, W, H, typed, bar, cap, ink };
    });
    return (t) => {
      const cs = SC[sceneAt(t)];
      setChrome(isDark(cs) ? '#8d8d95' : '#6f6f78', !isDark(cs));
      let curOn = 0;
      items.forEach((o) => {
        const { S, c } = o;
        const on = t >= S.t0 - 0.01 && t <= S.t1 + 0.06;
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const lt = t - S.t0;
        const q0 = p(t, S.t0, 0.4, E.out5);
        c.style.filter = q0 < 1 ? `blur(${(1 - q0) * 16}px)` : 'none';
        c.style.transform = `scale(${1.04 - 0.04 * q0})`;
        const stag = Math.min(0.09, (S.d * 0.4) / o.words.length);
        o.words.forEach((n, k) => {
          const q = p(t, S.t0 + 0.15 + k * stag, 0.45, E.out5);
          n.style.opacity = String(clamp(q * 2.2)); n.style.transform = `translateY(${(1 - q) * 28}px)`;
          if (n.style.backgroundSize) n.style.backgroundSize = `${p(t, S.t0 + S.d * 0.45 + k * 0.03, 0.4, E.out5) * 100}% 100%`;
        });
        const q = p(t, S.t0 + 0.5, 0.45, E.out5);
        o.sel.style.clipPath = `inset(${(1 - q) * 50}% ${(1 - q) * 50}% ${(1 - q) * 50}% ${(1 - q) * 50}%)`;
        const hq = p(t, S.t0 + 0.85, 0.3, E.back);
        o.hs.forEach((h) => { h.style.transform = `scale(${hq})`; });
        o.tag.style.opacity = String(p(t, S.t0 + 0.7, 0.2)); o.size.style.opacity = String(p(t, S.t0 + 0.9, 0.2));
        if (o.typed) { const n = Math.floor(D.brand.site.length * p(t, S.t0 + 0.6, Math.min(1.6, S.d * 0.5), E.lin)); o.typed.innerHTML = `${esc(D.brand.site.slice(0, n))}<span style="display:inline-block;width:3px;height:1em;background:#fff;vertical-align:-.12em;margin-left:3px"></span>`; }
        if (t < S.t1 && t >= S.t0) {
          const k = p(t, S.t0 + 0.45, 0.55, E.io);
          cur.style.transform = `translate(${lerp(900, o.X + o.W, k)}px,${lerp(1560, o.Y + o.H, k)}px)`;
          curOn = clamp((t - S.t0 - 0.4) / 0.2) * (1 - p(t, S.t1 - 0.15, 0.15));
        }
      });
      cur.style.opacity = String(curOn);
    };
  }

  // ============================================================================
  // 5 · PERSPECTIVE — plano 3D tombado, câmera que desliza e profundidade de campo
  // ============================================================================
  function perspective() {
    bg.style.background = 'linear-gradient(180deg,#F9F7F2 0%,#EEF2F8 55%,#DCE7F5 100%)';
    const persp = el('persp', stage); css(persp, 'inset:auto;left:0;top:640px;width:1080px;height:1280px;overflow:hidden;-webkit-mask-image:linear-gradient(transparent 0,#000 160px);mask-image:linear-gradient(transparent 0,#000 160px)');
    const plane = el('plane', persp);
    const PHOTO = [['#FFB27A', '#7A3E9D'], ['#9CCBFF', '#EAF4FF'], ['#A5D78F', '#2F6B3E'], ['#3B6BFF', '#0B2266'], ['#FFD79A', '#E86F5B'], ['#BFD0FF', '#6E8BFF']];
    const rows = Array.from({ length: N + 4 }, (_, r) => {
      const layout = [[{ x: 0, w: 1020 }], [{ x: 0, w: 480 }, { x: 540, w: 480 }], [{ x: 0, w: 320 }, { x: 350, w: 320 }, { x: 700, w: 320 }]][r % 3];
      return layout.map((l, k) => {
        const pl = PHOTO[(r * 2 + k) % PHOTO.length];
        const cardEl = css(el('pcard', plane), `left:${l.x}px;top:${r * 560}px;width:${l.w}px;height:470px;background:linear-gradient(${150 + k * 40}deg,${pl[0]},${pl[1]})`);
        css(el('', cardEl, '', 'i'), 'top:78%;width:60%'); css(el('', cardEl, '', 'i'), 'top:88%;width:36%');
        return { cardEl, r };
      });
    }).flat();
    const tiles = [['#FF7A4C', '✱', -1], ['#14161D', '✱', 1], ['#3B8BFF', '✱', -1]].map(([bgc, g, s], k) => css(el('itile', top, g), `background:${bgc};opacity:0;z-index:5`));
    const items = SC.map((S) => {
      const c = el('sc', stage); c.style.zIndex = '3'; c.style.overflow = 'visible';
      const pill = css(el('', c, `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#FF7A4C;margin-right:12px"></span>${S.kind === 'hook' ? esc(S.label) : `ESM WEB · ${pad(S.i + 1)}`}`), 'position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:236px;padding:10px 24px;border-radius:999px;background:rgba(255,255,255,.7);box-shadow:0 8px 24px rgba(40,60,120,.10);font-family:JetBrains Mono;font-size:20px;letter-spacing:.16em;text-transform:uppercase;color:#4a5270');
      const fs = fsFor(S.len, 0.86);
      const box = css(el('abs', c), `left:60px;right:60px;top:330px;text-align:center;line-height:1.04;letter-spacing:-.04em;font-size:${fs}px;color:#14161D;text-shadow:0 0 24px #F9F7F2,0 0 12px #F9F7F2`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' serif'; css(n, `font-size:${Math.round(fs * 1.2)}px;letter-spacing:-.02em;color:#4F6190`); } else css(n, 'font-weight:800'); });
      let hero = null;
      if (S.kind === 'cta') {
        hero = css(el('abs', c), 'left:130px;top:760px;width:820px;height:700px;border-radius:40px;overflow:hidden;background:linear-gradient(170deg,#7FB2FF 0%,#CFE3FF 55%,#FFE9C9 100%);box-shadow:0 60px 120px rgba(40,70,140,.3)');
        css(el('abs', hero, '<i style="position:absolute;left:26px;top:24px;width:12px;height:12px;border-radius:50%;background:#ff5f57"></i><i style="position:absolute;left:50px;top:24px;width:12px;height:12px;border-radius:50%;background:#febc2e"></i><i style="position:absolute;left:74px;top:24px;width:12px;height:12px;border-radius:50%;background:#28c840"></i>'), 'inset:0 0 auto 0;height:60px;background:rgba(255,255,255,.55)');
        css(el('abs', hero, `<img src="${D.brand.logo}" style="width:100%;display:block;filter:brightness(.22)">`), 'left:250px;top:220px;width:320px');
        css(el('abs', hero, esc(D.brand.label)), 'left:0;right:0;top:520px;text-align:center;font-family:JetBrains Mono;font-size:24px;letter-spacing:.2em;color:#2b3a66');
      }
      return { S, c, pill, words, hero };
    });
    return (t) => {
      setChrome('#4a5270', true);
      const cu = curIndex(t);
      const i = sceneAt(t);
      const isCta = SC[i].kind === 'cta';
      const flat = isCta ? p(t, SC[i].t0, 0.8, E.io) : 0;
      plane.style.transform = `rotateX(${67 - 4 * Math.sin(cu * 0.9)}deg) translateY(${-cu * 520 + 10}px) translateZ(${-flat * 600}px) scale(.92)`;
      persp.style.opacity = String(1 - flat * 0.65);
      rows.forEach(({ cardEl, r }) => { cardEl.style.filter = `blur(${clamp(Math.abs(r - cu - 1.1) * 2.3, 0, 8)}px)`; });
      tiles.forEach((tl, k) => {
        const q = p(t, 0.3 + k * 0.15, 0.7, E.back);
        const pos = [[70, 1180], [820, 1040], [740, 1560]][k];
        tl.style.opacity = String(clamp(q * 2) * 0.95);
        tl.style.transform = `translate(${pos[0] + Math.sin(t * 0.7 + k) * 14}px,${pos[1] + Math.cos(t * 0.6 + k * 2) * 22}px) rotate(${(k - 1) * 9 + Math.sin(t * 0.5 + k) * 4}deg) scale(${0.7 + 0.3 * q})`;
        tl.style.filter = k === 2 ? 'blur(2px)' : 'none';
      });
      items.forEach((o) => {
        const { S, c } = o;
        const on = gateScene(t, S);
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const ex = exitOf(t, S);
        c.style.opacity = String(1 - ex); c.style.filter = ex ? `blur(${ex * 10}px)` : 'none';
        o.pill.style.opacity = String(p(t, S.t0 + 0.05, 0.3));
        const stag = Math.min(0.1, (S.d * 0.45) / o.words.length);
        o.words.forEach((n, k) => blurIn(n, p(t, S.t0 + 0.12 + k * stag, 0.5, E.out5), 34, 0.94));
        if (o.hero) { const q = p(t, S.t0 + 0.3, 0.8, E.out5); o.hero.style.opacity = String(q); o.hero.style.transform = `translateY(${(1 - q) * 160}px) scale(${0.9 + 0.1 * q})`; }
      });
    };
  }

  const STYLES = { ember, editorial, gradient, selection, perspective };
  const draw = (STYLES[D.style] || ember)();
  window.__draw = (t) => { drawCommon(t); draw(t); };
  window.__draw(0);
})();
