// Roda dentro do Chrome. Tudo é função do tempo: window.__draw(t) desenha o quadro do instante t (segundos).
// Paleta da ESM Web: preto #0A0B0D, painéis #14161A/#1B1D21, prata #C9CCD1/#E4E6E9, cinza #9A9EA5 e branco.
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
  const LABEL2 = D.brand.label.split('·')[1]?.trim() || 'SITES E LANDING PAGES';
  const LABEL1 = D.brand.label.split('·')[0].trim();

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
  const wordSpans = (box, S, fn) => S.words.map((w) => { const n = el('w', box, esc(w.w), 'span'); n.style.margin = '0 .12em'; fn(n, w); return n; });

  // ----- mockup de site (ilustração): negócio fictício com botão de contato que pulsa e aviso de novo contato -----
  const NICHES = [
    { name: 'Clínica Exemplo', dom: 'clinicaexemplo.com.br', head: 'Cuide do seu sorriso', cta: 'Agendar consulta', feat: ['Avaliação', 'Equipe', 'Contato'] },
    { name: 'Advocacia Exemplo', dom: 'advocaciaexemplo.com.br', head: 'Defenda seus direitos', cta: 'Falar com advogado', feat: ['Áreas', 'Equipe', 'Contato'] },
    { name: 'Estética Exemplo', dom: 'esteticaexemplo.com.br', head: 'Realce a sua beleza', cta: 'Agendar avaliação', feat: ['Serviços', 'Antes', 'Contato'] },
    { name: 'Solar Exemplo', dom: 'solarexemplo.com.br', head: 'Reduza sua conta de luz', cta: 'Pedir orçamento', feat: ['Como é', 'Projetos', 'Contato'] },
  ];
  function siteMock(parent, k, theme) {
    const v = NICHES[k % NICHES.length]; const dark = theme === 'dark';
    const T = dark
      ? { bg: '#14161A', bar: '#1B1D21', line: '#2C2E34', ink: '#FFFFFF', mute: '#9A9EA5', blk: '#2C2E34', btn: '#FFFFFF', btnInk: '#0A0B0D', img: 'linear-gradient(135deg,#3A3D44,#1B1D21)', dot: '#4A4D55' }
      : { bg: '#FFFFFF', bar: '#F1F2F4', line: '#E1E3E6', ink: '#0A0B0D', mute: '#6B6F76', blk: '#E1E3E6', btn: '#0A0B0D', btnInk: '#FFFFFF', img: 'linear-gradient(135deg,#D6D9DE,#AEB2B9)', dot: '#C4C7CC' };
    const root = css(el('', parent), `position:absolute;width:480px;height:470px;border-radius:24px;overflow:hidden;background:${T.bg};border:1px solid ${T.line};box-shadow:0 36px 90px rgba(0,0,0,${dark ? 0.55 : 0.3});transform-origin:0 0`);
    const a = (html, s) => css(el('', root, html), `position:absolute;${s}`);
    a('', `left:0;top:0;right:0;height:44px;background:${T.bar};border-bottom:1px solid ${T.line}`);
    [0, 1, 2].forEach((i) => a('', `left:${18 + i * 18}px;top:17px;width:10px;height:10px;border-radius:50%;background:${T.dot}`));
    a(v.dom, `left:112px;right:52px;top:9px;height:26px;border-radius:13px;background:${T.bg};font:500 14px/26px 'JetBrains Mono';color:${T.mute};text-align:center`);
    a('', `left:24px;top:62px;width:24px;height:24px;border-radius:7px;background:${T.ink}`);
    a(v.name, `left:58px;top:61px;font:800 17px/26px 'Inter Tight';letter-spacing:-.02em;color:${T.ink}`);
    [0, 1, 2].forEach((i) => a('', `right:${24 + i * 34}px;top:70px;width:22px;height:8px;border-radius:4px;background:${T.blk}`));
    a(v.head, `left:24px;top:106px;width:272px;font:800 38px/1.04 'Inter Tight';letter-spacing:-.04em;color:${T.ink}`);
    a('', `left:24px;top:238px;width:230px;height:10px;border-radius:5px;background:${T.blk}`);
    a('', `left:24px;top:258px;width:170px;height:10px;border-radius:5px;background:${T.blk}`);
    const ring = a('', `left:24px;top:288px;width:214px;height:54px;border-radius:27px;border:3px solid ${T.btn}`);
    const btn = a(v.cta, `left:24px;top:288px;width:214px;height:54px;border-radius:27px;background:${T.btn};color:${T.btnInk};font:800 18px/54px 'Inter Tight';text-align:center;letter-spacing:-.01em`);
    const img = a('', `left:308px;top:106px;width:150px;height:200px;border-radius:20px;background:${T.img};overflow:hidden`);
    css(el('', img), `position:absolute;left:50px;top:44px;width:50px;height:50px;border-radius:50%;background:${dark ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.7)'}`);
    css(el('', img), `position:absolute;left:22px;top:104px;width:106px;height:120px;border-radius:53px;background:${dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.55)'}`);
    v.feat.forEach((f, i) => {
      const c = a('', `left:${24 + i * 148}px;top:366px;width:136px;height:84px;border-radius:16px;border:1px solid ${T.line}`);
      css(el('', c), `position:absolute;left:14px;top:14px;width:26px;height:26px;border-radius:50%;background:${T.blk}`);
      css(el('', c, f), `position:absolute;left:14px;top:50px;font:600 15px/20px 'Inter Tight';color:${T.ink}`);
    });
    const toast = a('<b style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7BE3A0;margin-right:10px"></b>Novo contato', `right:14px;top:296px;padding:0 18px;height:40px;border-radius:20px;background:${dark ? '#FFFFFF' : '#0A0B0D'};color:${dark ? '#0A0B0D' : '#FFFFFF'};font:800 16px/40px 'Inter Tight';white-space:nowrap;box-shadow:0 14px 30px rgba(0,0,0,.35);opacity:0`);
    return { root, ring, toast, btn };
  }
  // pulso no botão e aviso "novo contato" que entra com mola (t0 = início da animação)
  function animMock(m, t, t0) {
    const q = (((t - t0) % 1.7) + 1.7) % 1.7 / 1.7;
    m.ring.style.transform = `scale(${1 + q * 0.28},${1 + q * 0.5})`;
    m.ring.style.opacity = String(t < t0 ? 0 : (1 - q) * 0.75);
    const k = p(t, t0 + 0.8, 0.45, E.back);
    m.toast.style.opacity = String(clamp(k * 2));
    m.toast.style.transform = `translateY(${(1 - k) * 18}px) scale(${0.7 + 0.3 * k})`;
  }
  const FOOT = css(el('', chrome, 'ILUSTRAÇÃO · EMPRESAS FICTÍCIAS'), 'position:absolute;left:0;right:0;bottom:56px;text-align:center;font-family:JetBrains Mono;font-size:17px;letter-spacing:.18em;color:#6b6f76;opacity:0');

  // ----- rodapé comum: pílula do CTA (prata) -----
  const PILL = { ember: ['#E4E6E9', '#0A0B0D'], editorial: ['#E4E6E9', '#0A0B0D'], gradient: ['#FFFFFF', '#0A0B0D'], selection: null, perspective: ['#E4E6E9', '#0A0B0D'] }[D.style];
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

  // ----- partículas (canvas) -----
  const embers = (() => { const r = rng(11); return Array.from({ length: 70 }, () => ({ x: r() * 1080, y: r() * 2100, s: 20 + r() * 70, z: 1 + r() * 3, f: 0.4 + r() * 1.2, ph: r() * 6.28 })); })();
  function drawEmbers(t) {
    embers.forEach((e) => {
      const y = ((e.y - t * e.s) % 2100 + 2100) % 2100 - 100;
      const x = e.x + Math.sin(t * e.f + e.ph) * 36;
      ctx.globalAlpha = 0.2 + 0.5 * Math.abs(Math.sin(t * e.f * 2 + e.ph));
      ctx.fillStyle = e.z > 3 ? '#FFFFFF' : '#C9CCD1';
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
    FOOT.style.opacity = D.style === 'ember' ? '0' : '0.85';
  };
  const gateScene = (t, S, tail = 0.3) => t >= S.t0 - 0.01 && t <= S.t1 + tail;
  const exitOf = (t, S, d = 0.18) => (S.i === N - 1 ? 0 : p(t, S.t1 - d, d, E.io));

  // ============================================================================
  // 1 · EMBER — fundo escuro com brasas prateadas, HUD, palavras gigantes e painel prata
  // ============================================================================
  function ember() {
    bg.style.background = 'radial-gradient(1100px 900px at 18% 12%,#2b2d33 0%,#14161A 46%,#0A0B0D 100%)';
    const hud = el('', top);
    [['left', 'top'], ['right', 'top'], ['left', 'bottom'], ['right', 'bottom']].forEach(([x, y]) => {
      const c = el('hudc', hud); css(c, `${x}:36px;${y}:36px;border-${y}-width:2px;border-${x}-width:2px;border-color:rgba(255,255,255,.3)`);
    });
    const hl = css(el('hudt', hud), 'left:80px;bottom:78px'); const hr = css(el('hudt', hud), 'right:80px;bottom:78px');
    const items = SC.map((S) => {
      const v = S.kind === 'cta' ? 3 : S.kind === 'hook' ? 1 : S.i % 3 === 2 ? 2 : 0;
      const c = el('sc', stage);
      const o = { S, v, c };
      const wordMask = (b, strongCss, lightCss, margin = '.2em') => S.words.map((w) => { const m = css(el('m', b), `margin-right:${margin};padding-bottom:.1em`); return css(el('', m, esc(w.w), 'span'), `display:block;${w.strong ? strongCss : lightCss}`); });
      if (v === 1) {
        o.rows = [520, 1190, 1360].map((y, k) => css(el('abs', c, Array(7).fill(esc(S.big)).join('&nbsp;&nbsp;✦&nbsp;&nbsp;')), `left:0;top:${y}px;white-space:nowrap;font-weight:800;font-size:190px;line-height:1;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,${k ? 0.07 : 0.1})`));
        o.kick = css(el('kick', c, S.kind === 'hook' ? esc(S.label) : `[ ${pad(S.i + 1)} ]`), 'left:0;right:0;text-align:center;top:560px;color:#C9CCD1');
        o.giant = css(el('abs', c, esc(S.big)), `left:0;right:0;top:760px;text-align:center;font-weight:800;line-height:1;letter-spacing:-.05em;font-size:${Math.min(300, Math.floor(950 / (S.big.length * 0.6)))}px;text-shadow:0 0 90px rgba(201,204,209,.4)`);
        const sub = css(el('abs', c), `left:90px;right:90px;top:1040px;text-align:center;font-size:${S.len > 70 ? 42 : 48}px;line-height:1.18;letter-spacing:-.02em;font-weight:500;color:#9A9EA5`);
        o.sub = wordSpans(sub, S, (n, w) => { if (w.strong) css(n, 'color:#fff;font-weight:800'); });
      } else if (v === 2) {
        o.panel = css(el('abs', c), 'inset:0;background:linear-gradient(150deg,#F1F2F4 0%,#C9CCD1 55%,#9A9EA5 100%)');
        o.tag = css(el('kick', o.panel, `CASE ${pad(S.i + 1)} — ${esc(LABEL1)}`), 'left:80px;top:560px;color:#0A0B0D');
        o.badge = css(el('abs', o.panel, `<div style="font-weight:800;font-size:96px;letter-spacing:-.04em">${pad(S.i + 1)}</div>`), 'right:90px;top:480px;width:230px;height:230px;border-radius:50%;border:4px dashed #0A0B0D;color:#0A0B0D;display:flex;align-items:center;justify-content:center');
        const b = css(el('abs', o.panel), `left:80px;right:80px;top:780px;font-size:${fsFor(S.len, 1.02)}px;line-height:1.04;letter-spacing:-.045em;font-weight:800;color:#0A0B0D`);
        o.words = wordMask(b, 'color:#0A0B0D', 'color:#4A4D55;font-weight:600');
      } else if (v === 0) {
        o.num = css(el('kick', c, `[ ${pad(S.i + 1)} ]`), 'left:80px;top:690px;color:#C9CCD1');
        o.ln = css(el('line', c), 'left:80px;top:742px;width:220px');
        const b = css(el('abs', c), `left:80px;right:80px;top:790px;font-size:${fsFor(S.len, 1.08)}px;line-height:1.03;letter-spacing:-.045em;font-weight:800`);
        o.words = wordMask(b, 'color:#fff', 'color:#8B8F97;font-weight:500');
      } else {
        o.logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:330px;top:380px;width:420px');
        o.ring = css(el('abs', c), 'left:0;top:0;width:10px;height:10px;border:3px solid #C9CCD1;border-radius:50%');
        const b = css(el('abs', c), `left:80px;right:80px;top:850px;text-align:center;font-size:${fsFor(S.len, 0.95)}px;line-height:1.06;letter-spacing:-.04em;font-weight:800`);
        o.words = wordMask(b, 'color:#fff', 'color:#9A9EA5;font-weight:500', '.2em');
      }
      return o;
    });
    return (t) => {
      setChrome('#9A9EA5', false);
      drawEmbers(t);
      const cur = SC[sceneAt(t)];
      hl.textContent = `${pad(cur.i + 1)} / ${pad(N)} · ${LABEL2}`;
      hr.innerHTML = `<span style="color:#fff">●</span> ${tc(t)}`;
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
          burst(t, S.t0 + 0.1, 540, 590, 70, ['#FFFFFF', '#C9CCD1', '#9A9EA5'], 31, 1.8, 600, 700);
        }
      });
    };
  }

  // ============================================================================
  // 2 · EDITORIAL — cenas escuras e prata alternadas, troca em círculo, serifa itálica, site em destaque
  // ============================================================================
  function editorial() {
    const isDark = (S) => S.kind !== 'line' || S.i % 2 === 0;
    const items = SC.map((S) => {
      const dark = isDark(S);
      const ink = dark ? '#fff' : '#0A0B0D'; const soft = dark ? '#C9CCD1' : '#4A4D55';
      const ring = css(el('abs', stage), `inset:0;background:#C9CCD1;z-index:${S.i * 2}`);
      const c = css(el('sc', stage), `z-index:${S.i * 2 + 1};background:${dark ? 'radial-gradient(900px 800px at 70% 20%,#2b2d33 0%,#0A0B0D 62%)' : 'radial-gradient(900px 700px at 20% 15%,#F4F5F7 0%,#D9DCE1 80%)'}`);
      const r = rng(S.i * 97 + 13);
      // site principal (claro sobre fundo escuro e escuro sobre fundo claro) e dois ao fundo, desfocados
      const main = siteMock(c, S.i, dark ? 'light' : 'dark');
      const bgm = [siteMock(c, S.i + 1, dark ? 'dark' : 'light'), siteMock(c, S.i + 2, dark ? 'dark' : 'light')];
      const place = [
        { m: main, x: 252, y: 1130, sc: 1.2, rot: 0, bl: 0, op: S.kind === 'cta' ? 0 : 1, fl: 0.6 },
        { m: bgm[0], x: -170, y: 170 + r() * 80, sc: 0.78, rot: -9, bl: 5, op: dark ? 0.55 : 0.8, fl: 0.9 },
        { m: bgm[1], x: 790, y: 260 + r() * 80, sc: 0.7, rot: 8, bl: 7, op: dark ? 0.5 : 0.75, fl: 1.1 },
      ];
      const kick = css(el('kick', c, S.kind === 'hook' ? esc(S.label) : `${pad(S.i + 1)} — ${esc(LABEL2)}`), `left:0;right:0;text-align:center;top:520px;color:${soft}`);
      const fs = fsFor(S.len, S.kind === 'hook' ? 1.15 : 1.05);
      const box = css(el('abs', c), `left:60px;right:60px;top:880px;transform:translateY(-50%);text-align:center;line-height:1.02;letter-spacing:-.04em;font-size:${fs}px;color:${ink}`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' serif'; css(n, `color:${soft};font-size:${Math.round(fs * 1.22)}px;letter-spacing:-.02em`); } else css(n, 'font-weight:800'); });
      let logo = null;
      if (S.kind === 'cta') logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:370px;top:340px;width:340px');
      return { S, dark, ring, c, place, kick, words, logo };
    });
    return (t) => {
      const cs = SC[sceneAt(t)]; const dk = isDark(cs);
      setChrome(dk ? '#9A9EA5' : '#4A4D55', !dk);
      FOOT.style.color = dk ? '#6b6f76' : '#4A4D55';
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
        o.place.forEach((k, n) => {
          const q = p(t, S.t0 + 0.2 + n * 0.1, 0.8, E.out5);
          k.m.root.style.opacity = String(q * k.op);
          k.m.root.style.filter = k.bl ? `blur(${k.bl}px)` : 'none';
          k.m.root.style.transform = `translate(${k.x + Math.sin(lt * 0.5 * k.fl + n) * 16}px,${k.y + Math.cos(lt * 0.4 * k.fl + n) * 20 + (1 - q) * 160}px) rotate(${k.rot + Math.sin(lt * 0.3 + n) * 2}deg) scale(${k.sc})`;
          animMock(k.m, t, S.t0 + 0.4);
        });
        o.kick.style.opacity = String(p(t, S.t0 + 0.3, 0.3));
        const stag = Math.min(0.1, (S.d * 0.45) / o.words.length);
        o.words.forEach((n, k) => blurIn(n, p(t, S.t0 + 0.3 + k * stag, 0.5, E.out5), 36, 0.94));
        if (o.logo) { const q = p(t, S.t0 + 0.5, 0.7, E.out5); o.logo.style.opacity = String(q); o.logo.style.transform = `translateY(${(1 - q) * 40}px)`; }
      });
    };
  }

  // ============================================================================
  // 3 · GRADIENT — preto, texto em prata metálico com brilho, galeria de sites ao fundo, confete prata
  // ============================================================================
  function gradient() {
    bg.style.background = 'radial-gradient(900px 700px at 50% 38%,rgba(201,204,209,.12),transparent 70%),#0A0B0D';
    const cols = css(el('abs', stage), 'left:-130px;top:-300px;width:1340px;height:2600px;transform:rotate(-9deg)');
    const colEls = [0, 1, 2].map((ci) => {
      const col = css(el('abs', cols), `left:${ci * 420 + 20}px;top:0;width:390px`);
      for (let k = 0; k < 6; k++) {
        const holder = css(el('', col), 'position:relative;width:390px;height:400px;margin-bottom:34px');
        const m = siteMock(holder, ci * 2 + k, (ci + k) % 3 === 0 ? 'light' : 'dark');
        m.root.style.transform = 'scale(.8125)';
        m.k = ci * 7 + k;
        holder.mock = m;
      }
      return col;
    });
    const mocks = colEls.flatMap((col) => Array.from(col.children).map((h) => h.mock));
    const items = SC.map((S) => {
      const c = el('sc', stage);
      const pill = css(el('', c, `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#fff;margin-right:14px"></span>${S.kind === 'hook' ? esc(S.label) : `${esc(LABEL2)} · ${pad(S.i + 1)} / ${pad(N)}`}`), 'position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:560px;padding:14px 30px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(10,11,13,.7);font-family:JetBrains Mono;font-size:21px;letter-spacing:.2em;text-transform:uppercase;color:#d7d7e6');
      css(el('abs', c), 'left:0;right:0;top:640px;height:600px;background:radial-gradient(closest-side,rgba(10,11,13,.82),transparent)');
      const fs = fsFor(S.len, S.kind === 'hook' ? 1.15 : 1.05);
      const box = css(el('abs', c), `left:60px;right:60px;top:930px;transform:translateY(-50%);text-align:center;line-height:1.04;letter-spacing:-.04em;font-size:${fs}px;text-shadow:0 6px 40px rgba(10,11,13,.9)`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' grad'; css(n, `font-weight:800;font-size:${Math.round(fs * 1.1)}px`); } else css(n, 'font-weight:400;color:#C9CCD1'); });
      let logo = null; let glow = null;
      if (S.kind === 'cta') {
        glow = css(el('abs', c), 'left:140px;top:150px;width:800px;height:640px;background:radial-gradient(closest-side,rgba(228,230,233,.35),rgba(154,158,165,.12) 55%,transparent);filter:blur(10px)');
        logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:350px;top:340px;width:380px');
      }
      return { S, c, pill, words, logo, glow };
    });
    return (t) => {
      setChrome('#9A9EA5', false);
      drawStars(t);
      const i = sceneAt(t); const S0 = SC[i];
      const prev = SC[Math.max(0, i - 1)];
      const f = (S) => (S.kind === 'line' && S.i % 3 === 1 ? 0.62 : 0.3);
      const op = i === 0 ? f(S0) : lerp(f(prev), f(S0), p(t, S0.t0, 0.6, E.io));
      cols.style.opacity = String(op);
      cols.style.filter = `blur(${lerp(4, 0.5, (op - 0.3) / 0.5)}px)`;
      colEls.forEach((col, k) => { col.style.transform = `translateY(${(k % 2 ? 1 : -1) * t * 46 - (k % 2 ? 330 : 0)}px)`; });
      mocks.forEach((m) => animMock(m, t, (m.k % 5) * 0.4));
      document.querySelectorAll('.grad').forEach((n) => { n.style.backgroundPosition = `${(t * 45) % 200}% 0`; });
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
          burst(t, S.t0 + 0.1, 540, 480, 90, ['#FFFFFF', '#E4E6E9', '#C9CCD1', '#9A9EA5'], 77, 2.6, 900, 950);
        }
      });
    };
  }

  // ============================================================================
  // 4 · SELECTION — estética de ferramenta de design: caixa de seleção, etiquetas, site ao lado
  // ============================================================================
  function selection() {
    const TAGS = ['headline', 'copy', 'hero', 'callout', 'label', 'cta'];
    const isDark = (S) => S.kind !== 'line' || S.i % 2 === 0;
    const cur = css(el('', top, '<svg width="46" height="46" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg><div class="stag" style="left:20px;top:34px;--acc:#1b1b1d;--accink:#fff">esm</div>'), 'position:absolute;left:0;top:0;opacity:0;z-index:50');
    const items = SC.map((S) => {
      const dark = isDark(S);
      const acc = dark ? '#E4E6E9' : '#0A0B0D'; const accink = dark ? '#0A0B0D' : '#FFFFFF';
      const ink = dark ? '#fff' : '#0A0B0D';
      const c = css(el('sc', stage), `z-index:${S.i + 1};--acc:${acc};--accink:${accink};background:${dark ? '#0A0B0D' : '#E6E8EB'}`);
      css(el('abs', c), `inset:0;background-image:radial-gradient(${dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.13)'} 1.6px,transparent 1.7px);background-size:40px 40px`);
      let mock = null;
      if (S.kind !== 'cta') { mock = siteMock(c, S.i, dark ? 'light' : 'dark'); css(mock.root, 'left:276px;top:1170px;transform:scale(1.1)'); }
      css(el('', c, `${esc(LABEL1)} / ${esc(LABEL2.toLowerCase())}`), `position:absolute;left:70px;bottom:110px;padding:8px 16px;background:${dark ? '#fff' : '#0A0B0D'};color:${dark ? '#0A0B0D' : '#fff'};font-family:JetBrains Mono;font-size:20px;letter-spacing:.04em`);
      let box; let words = []; let bar = null; let typed = null;
      if (S.kind === 'cta') {
        box = css(el('abs', c), `left:90px;right:90px;top:640px;text-align:center;line-height:1.04;letter-spacing:-.045em;font-weight:800;font-size:${fsFor(S.len, 1.1)}px;color:${ink}`);
        words = wordSpans(box, S, (n, w) => { if (!w.strong) css(n, 'color:#9A9EA5;font-weight:500'); });
        bar = css(el('abs', c), 'left:110px;top:1010px;width:860px;height:112px;border-radius:56px;background:#1c1c1f;border:1px solid #2c2e34');
        typed = css(el('abs', bar), 'left:44px;top:30px;font-family:JetBrains Mono;font-size:34px;color:#fff;white-space:nowrap');
        css(el('abs', bar, '↑'), 'right:16px;top:16px;width:80px;height:80px;border-radius:50%;background:#fff;color:#111;font-size:40px;text-align:center;line-height:78px;font-weight:800');
      } else {
        box = css(el('abs', c), `left:110px;right:110px;top:660px;text-align:center;line-height:1.05;letter-spacing:-.045em;font-size:${fsFor(S.len, 1.08)}px;color:${ink}`);
        words = wordSpans(box, S, (n, w) => { if (w.strong) css(n, `font-weight:800;padding:0 .08em;background-image:linear-gradient(${dark ? 'rgba(255,255,255,.22)' : 'rgba(10,11,13,.16)'},${dark ? 'rgba(255,255,255,.22)' : 'rgba(10,11,13,.16)'});background-repeat:no-repeat;background-position:0 100%;background-size:0% 100%`); else css(n, `font-weight:500;color:${dark ? '#B7BBC2' : '#3a3d44'}`); });
      }
      const target = bar || box;
      const rc = target.getBoundingClientRect();
      const W = rc.width + (bar ? 40 : 56); const H = rc.height + (bar ? 36 : 48);
      const X = rc.left - (bar ? 20 : 28); const Y = rc.top - (bar ? 18 : 24);
      const sel = css(el('sel', c), `left:${X}px;top:${Y}px;width:${W}px;height:${H}px`);
      const hs = [[0, 0], [W, 0], [0, H], [W, H], [W / 2, 0], [W / 2, H], [0, H / 2], [W, H / 2]].map(([x, y]) => css(el('hnd', sel), `left:${x}px;top:${y}px`));
      const tag = css(el('stag', c, TAGS[S.i % TAGS.length]), `left:${X - 2}px;top:${Y - 36}px`);
      const size = css(el('stag', c, `${Math.round(W)} × ${Math.round(H)}`), `left:${X + W - 120}px;top:${Y + H + 14}px;--acc:#1b1b1d;--accink:#fff`);
      return { S, dark, c, words, sel, hs, tag, size, X, Y, W, H, typed, mock };
    });
    return (t) => {
      const cs = SC[sceneAt(t)];
      setChrome(isDark(cs) ? '#9A9EA5' : '#4A4D55', !isDark(cs));
      FOOT.style.color = isDark(cs) ? '#6b6f76' : '#4A4D55';
      let curOn = 0;
      items.forEach((o) => {
        const { S, c } = o;
        const on = t >= S.t0 - 0.01 && t <= S.t1 + 0.06;
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
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
        if (o.mock) {
          const m = p(t, S.t0 + 0.3, 0.7, E.out5);
          o.mock.root.style.opacity = String(m);
          o.mock.root.style.transform = `translateY(${(1 - m) * 120}px) scale(1.1)`;
          animMock(o.mock, t, S.t0 + 0.7);
        }
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
  // 5 · PERSPECTIVE — plano 3D de sites, câmera que desliza e profundidade de campo
  // ============================================================================
  function perspective() {
    bg.style.background = 'radial-gradient(900px 600px at 50% 30%,rgba(201,204,209,.10),transparent 70%),linear-gradient(180deg,#0A0B0D 0%,#14161A 55%,#1B1D21 100%)';
    const persp = el('persp', stage); css(persp, 'inset:auto;left:0;top:640px;width:1080px;height:1280px;overflow:hidden;-webkit-mask-image:linear-gradient(transparent 0,#000 160px);mask-image:linear-gradient(transparent 0,#000 160px)');
    const plane = el('plane', persp);
    const rows = Array.from({ length: N + 4 }, (_, r) => {
      const layout = r % 2 ? [{ x: 0, s: 1 }, { x: 540, s: 1 }] : [{ x: 20, s: 0.66 }, { x: 350, s: 0.66 }, { x: 680, s: 0.66 }];
      return layout.map((l, k) => {
        const m = siteMock(plane, r * 3 + k, (r + k) % 3 === 1 ? 'light' : 'dark');
        css(m.root, `left:${l.x}px;top:${r * 560}px`);
        m.s = l.s; m.r = r;
        m.root.style.transform = `scale(${l.s})`;
        return m;
      });
    }).flat();
    const tiles = [['linear-gradient(135deg,#F1F2F4,#9A9EA5)', '#0A0B0D'], ['#1B1D21', '#fff'], ['linear-gradient(135deg,#C9CCD1,#6f737b)', '#0A0B0D']].map(([bgc, ink]) => css(el('itile', top, `<img src="${D.brand.logo}" style="width:110px;display:block;${ink === '#0A0B0D' ? 'filter:brightness(.15)' : ''}">`), `background:${bgc};opacity:0;z-index:5;border:1px solid rgba(255,255,255,.18)`));
    const items = SC.map((S) => {
      const c = el('sc', stage); c.style.zIndex = '3'; c.style.overflow = 'visible';
      const pill = css(el('', c, `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#fff;margin-right:12px"></span>${S.kind === 'hook' ? esc(S.label) : `ESM WEB · ${pad(S.i + 1)}`}`), 'position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:236px;padding:10px 24px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);font-family:JetBrains Mono;font-size:20px;letter-spacing:.16em;text-transform:uppercase;color:#C9CCD1');
      const fs = fsFor(S.len, 0.86);
      const box = css(el('abs', c), `left:60px;right:60px;top:330px;text-align:center;line-height:1.04;letter-spacing:-.04em;font-size:${fs}px;color:#fff;text-shadow:0 0 28px #0A0B0D,0 0 12px #0A0B0D`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' serif'; css(n, `font-size:${Math.round(fs * 1.2)}px;letter-spacing:-.02em;color:#C9CCD1`); } else css(n, 'font-weight:800'); });
      let hero = null;
      if (S.kind === 'cta') {
        hero = css(el('abs', c), 'left:130px;top:760px;width:820px;height:700px;border-radius:40px;overflow:hidden;background:linear-gradient(170deg,#3A3D44 0%,#1B1D21 55%,#0A0B0D 100%);border:1px solid rgba(255,255,255,.14);box-shadow:0 60px 120px rgba(0,0,0,.6)');
        css(el('abs', hero, '<i style="position:absolute;left:26px;top:24px;width:12px;height:12px;border-radius:50%;background:#4A4D55"></i><i style="position:absolute;left:50px;top:24px;width:12px;height:12px;border-radius:50%;background:#4A4D55"></i><i style="position:absolute;left:74px;top:24px;width:12px;height:12px;border-radius:50%;background:#4A4D55"></i>'), 'inset:0 0 auto 0;height:60px;background:rgba(255,255,255,.05)');
        css(el('abs', hero, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:250px;top:220px;width:320px');
        css(el('abs', hero, esc(D.brand.label)), 'left:0;right:0;top:520px;text-align:center;font-family:JetBrains Mono;font-size:24px;letter-spacing:.2em;color:#9A9EA5');
      }
      return { S, c, pill, words, hero };
    });
    return (t) => {
      setChrome('#9A9EA5', false);
      FOOT.style.color = '#6b6f76';
      const cu = curIndex(t);
      const i = sceneAt(t);
      const isCta = SC[i].kind === 'cta';
      const flat = isCta ? p(t, SC[i].t0, 0.8, E.io) : 0;
      plane.style.transform = `rotateX(${67 - 4 * Math.sin(cu * 0.9)}deg) translateY(${-cu * 520 + 10}px) translateZ(${-flat * 600}px) scale(.92)`;
      persp.style.opacity = String(1 - flat * 0.65);
      rows.forEach((m) => {
        m.root.style.filter = `blur(${clamp(Math.abs(m.r - cu - 1.1) * 2.3, 0, 8)}px)`;
        animMock(m, t, (m.r % 4) * 0.3);
      });
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
