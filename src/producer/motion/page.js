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

  // ----- mockup de site (ilustração): página inicial completa de um negócio fictício, com botão de contato que pulsa -----
  // O site é desenhado em 960x940 e reduzido à metade (480x470), como um print de tela de um site de verdade.
  const IC = {
    heart: '<path d="M12 21s-7-4.6-9.3-9A5.2 5.2 0 0 1 12 6.5 5.2 5.2 0 0 1 21.3 12C19 16.4 12 21 12 21z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 20c0-3.4 2.7-5.5 6-5.5s6 2.1 6 5.5M15.5 14.8c3 0 5.5 1.7 5.5 5"/>',
    building: '<path d="M5 21V4l7-2 7 2v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>',
    drop: '<path d="M12 2.5s6 6.6 6 11.5a6 6 0 0 1-12 0c0-4.900 6-11.500 6-11.500z"/>',
    leaf: '<path d="M5 19C5 9.500 11 4.500 20 4.500 20 13 15 19 5 19zM5 19l8-8"/>',
    home: '<path d="M3 11l9-8 9 8M5 9.500V21h14V9.500M10 21v-6h4v6"/>',
    sun: '<circle cx="12" cy="12" r="4.200"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  };
  const icon = (n, color) => `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
  const SITES = [
    { // clínica
      name: 'Clínica Vitta', mark: 'V', dom: 'clinicavitta.com.br', nav: ['Tratamentos', 'Equipe', 'Convênios', 'Contato'], navCta: 'Agendar',
      kick: 'Odontologia e saúde', h1: 'Seu sorriso merece <span style="color:#0E9F8E">cuidado de verdade</span>', p: 'Atendimento humano, tecnologia moderna e horários que cabem na sua rotina.',
      cta: 'Agendar consulta', sec: 'Ver tratamentos', trust: ['Agenda online', 'Equipe especializada', 'Fácil de chegar'], badge: 'Agenda online aberta',
      cards: [['heart', 'Limpeza e prevenção', 'Cuidado de rotina para a saúde bucal'], ['star', 'Clareamento', 'Mais brilho com segurança'], ['shield', 'Ortodontia', 'Alinhamento para todas as idades']],
      P: { bg: '#F4FBFA', ink: '#0B2B33', mute: '#4E6B70', prim: '#0E9F8E', primInk: '#FFFFFF', tint: '#DDF3EF', line: '#D2E8E4', head: "'Inter Tight'", hw: 800, hs: 54, card: '#FFFFFF' },
      art: '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9F4EF"/><stop offset="1" stop-color="#7FD1C7"/></linearGradient></defs><rect width="340" height="520" fill="url(#a)"/><circle cx="260" cy="90" r="120" fill="#fff" opacity=".35"/><circle cx="50" cy="450" r="140" fill="#fff" opacity=".25"/><path d="M30 520C30 400 105 358 170 358S310 400 310 520z" fill="#fff"/><path d="M170 360l-38 160h76z" fill="#E4F6F3"/><rect x="150" y="312" width="40" height="60" rx="18" fill="#E8B796"/><ellipse cx="170" cy="246" rx="62" ry="76" fill="#F1C7A8"/><path d="M104 250C98 150 160 138 192 148c50 12 54 74 44 114-10-52-36-72-66-72s-58 20-66 60z" fill="#3B2A24"/><circle cx="148" cy="248" r="5" fill="#3B2A24"/><circle cx="192" cy="248" r="5" fill="#3B2A24"/><path d="M146 284q24 22 48 0" stroke="#B5655A" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M118 388c-8 56 30 76 52 44" stroke="#0B2B33" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="170" cy="432" r="13" fill="#0E9F8E"/>',
    },
    { // advocacia
      name: 'Mendes & Rocha', mark: 'M', dom: 'mendesrocha.adv.br', nav: ['Atuação', 'Equipe', 'Artigos', 'Contato'], navCta: 'Contato',
      kick: 'Advocacia empresarial e de família', h1: 'Defendemos seus direitos com <span style="color:#C8A45C">estratégia e clareza</span>', p: 'Atendimento direto com o advogado responsável, do primeiro contato à decisão final.',
      cta: 'Falar com advogado', sec: 'Áreas de atuação', trust: ['Atendimento sigiloso', 'Resposta no WhatsApp', 'Análise do caso'], badge: 'Atendimento sigiloso',
      cards: [['users', 'Direito de família', 'Divórcio, guarda e inventário'], ['shield', 'Direito trabalhista', 'Defesa de empresas e trabalhadores'], ['building', 'Direito empresarial', 'Contratos e consultoria jurídica']],
      P: { bg: '#0E1730', ink: '#FFFFFF', mute: '#AEB8D4', prim: '#C8A45C', primInk: '#0E1730', tint: 'rgba(200,164,92,.16)', line: 'rgba(255,255,255,.14)', head: "'Instrument Serif'", hw: 400, hs: 62, card: 'rgba(255,255,255,.06)' },
      art: '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22345F"/><stop offset="1" stop-color="#0A1126"/></linearGradient></defs><rect width="340" height="520" fill="url(#a)"/><rect x="26" y="70" width="34" height="380" fill="#fff" opacity=".06"/><rect x="280" y="70" width="34" height="380" fill="#fff" opacity=".06"/><circle cx="170" cy="150" r="11" fill="#C8A45C"/><path d="M170 160v250" stroke="#C8A45C" stroke-width="7"/><rect x="112" y="408" width="116" height="16" rx="6" fill="#C8A45C"/><path d="M78 180l92-24 92 24" stroke="#C8A45C" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M78 180L46 296M78 180l32 116M262 180l-32 116M262 180l32 116" stroke="#C8A45C" stroke-width="3" fill="none"/><path d="M36 296q42 46 84 0z" fill="#C8A45C"/><path d="M220 296q42 46 84 0z" fill="#C8A45C"/>',
    },
    { // estética
      name: 'Studio Bella Pele', mark: 'B', dom: 'studiobellapele.com.br', nav: ['Procedimentos', 'Sobre', 'Espaço', 'Contato'], navCta: 'Agendar',
      kick: 'Estética avançada', h1: 'Realce a sua <span style="color:#B5655A">beleza natural</span>', p: 'Protocolos personalizados para cada pele, em um ambiente acolhedor e tranquilo.',
      cta: 'Agendar avaliação', sec: 'Procedimentos', trust: ['Avaliação da pele', 'Protocolo sob medida', 'Ambiente reservado'], badge: 'Horários esta semana',
      cards: [['sun', 'Limpeza de pele', 'Renovação e viço para o rosto'], ['drop', 'Hidratação facial', 'Pele macia e luminosa'], ['leaf', 'Harmonização', 'Resultado natural e sutil']],
      P: { bg: '#FBF3F0', ink: '#3A2626', mute: '#7A5F5B', prim: '#B5655A', primInk: '#FFFFFF', tint: '#F4DDD7', line: '#EBD3CD', head: "'Instrument Serif'", hw: 400, hs: 66, card: '#FFFFFF' },
      art: '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6DAD3"/><stop offset="1" stop-color="#E5AFA5"/></linearGradient></defs><rect width="340" height="520" fill="url(#a)"/><path d="M60 500V230a110 110 0 0 1 220 0v270z" fill="#FBF3F0"/><ellipse cx="170" cy="278" rx="58" ry="76" fill="none" stroke="#B5655A" stroke-width="4"/><path d="M146 262q10-8 20 0M178 262q10-8 20 0" stroke="#B5655A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M152 312q18 14 36 0q-18 6-36 0z" fill="#B5655A"/><path d="M170 238v30" stroke="#B5655A" stroke-width="3" opacity=".5"/><path d="M28 430c40-30 52-90 30-140 40 20 52 90-30 140zM312 420c-40-30-52-90-30-140-40 20-52 90 30 140z" fill="#B5655A" opacity=".55"/>',
    },
    { // solar
      name: 'Solara Energia', mark: 'S', dom: 'solaraenergia.com.br', nav: ['Como funciona', 'Projetos', 'Financiamento', 'Contato'], navCta: 'Orçamento',
      kick: 'Energia solar para casa e empresa', h1: 'Reduza sua conta de luz com <span style="color:#E8920C">energia solar</span>', p: 'Projeto sob medida, instalação completa e acompanhamento de ponta a ponta.',
      cta: 'Pedir orçamento', sec: 'Como funciona', trust: ['Projeto personalizado', 'Instalação completa', 'Suporte pós-venda'], badge: 'Orçamento por WhatsApp',
      cards: [['home', 'Residencial', 'Sistema para a sua casa'], ['building', 'Comercial', 'Redução de custos na empresa'], ['leaf', 'Rural', 'Energia para o campo']],
      P: { bg: '#FFFDF5', ink: '#10352A', mute: '#4F6B60', prim: '#F5A524', primInk: '#10352A', tint: '#FDEFCB', line: '#F0E3BE', head: "'Inter Tight'", hw: 800, hs: 54, card: '#FFFFFF' },
      art: '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9D8FF"/><stop offset="1" stop-color="#FFF3D1"/></linearGradient><clipPath id="r"><path d="M20 340L72 238H268L320 340z"/></clipPath></defs><rect width="340" height="520" fill="url(#a)"/><circle cx="246" cy="96" r="46" fill="#F5A524"/><path d="M246 30v18M246 144v18M180 96h18M294 96h18M200 50l12 12M280 130l12 12M292 50l-12 12M212 130l-12 12" stroke="#F5A524" stroke-width="5" stroke-linecap="round"/><rect x="50" y="338" width="240" height="170" fill="#fff"/><path d="M20 340L72 238H268L320 340z" fill="#2B3A55"/><g clip-path="url(#r)"><g stroke="#8FB8FF" stroke-width="3" fill="#1F3A6B"><rect x="60" y="246" width="60" height="44"/><rect x="124" y="246" width="60" height="44"/><rect x="188" y="246" width="60" height="44"/><rect x="40" y="294" width="64" height="44"/><rect x="108" y="294" width="64" height="44"/><rect x="176" y="294" width="64" height="44"/><rect x="244" y="294" width="64" height="44"/></g></g><rect x="136" y="410" width="68" height="98" rx="6" fill="#10352A"/><rect x="66" y="372" width="48" height="48" rx="4" fill="#BFE0FF"/><rect x="226" y="372" width="48" height="48" rx="4" fill="#BFE0FF"/>',
    },
  ];
  function siteMock(parent, k) {
    const v = SITES[k % SITES.length]; const P = v.P;
    const root = css(el('', parent), 'position:absolute;width:480px;height:470px;border-radius:24px;overflow:hidden;background:#fff;box-shadow:0 36px 90px rgba(0,0,0,.45);transform-origin:0 0');
    const dark = P.bg.startsWith('#0') || P.bg.startsWith('#1');
    const lock = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7a7e86" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:8px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
    const nav = v.nav.map((n) => `<span style="margin-left:26px;font-size:19px;font-weight:500;white-space:nowrap;color:${P.mute}">${n}</span>`).join('');
    const trust = v.trust.map((n) => `<span style="display:inline-flex;align-items:center;margin-right:18px;font-size:17px;font-weight:600;color:${P.ink}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${P.prim}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:7px"><path d="M4 12l5 5 11-11"/></svg>${n}</span>`).join('');
    const cards = v.cards.map((c, i) => `<div style="position:absolute;left:${64 + i * 288}px;top:786px;width:270px;height:170px;border-radius:28px;background:${P.card};border:1px solid ${P.line}"><div style="position:absolute;left:24px;top:24px;width:58px;height:58px;border-radius:50%;background:${P.tint};display:flex;align-items:center;justify-content:center">${icon(c[0], P.prim)}</div><div style="position:absolute;left:24px;top:98px;font-size:23px;font-weight:800;letter-spacing:-.02em;color:${P.ink}">${c[1]}</div><div style="position:absolute;left:24px;top:132px;font-size:16px;color:${P.mute}">${c[2]}</div></div>`).join('');
    const inner = el('', root, `
<div style="position:absolute;left:0;top:0;width:960px;height:940px;background:${P.bg};font-family:'Inter Tight',sans-serif;overflow:hidden">
 <div style="position:absolute;left:0;top:0;width:960px;height:70px;background:#ECEDEF;border-bottom:1px solid #D9DBDF">
  <i style="position:absolute;left:28px;top:24px;width:14px;height:14px;border-radius:50%;background:#FF5F57"></i><i style="position:absolute;left:54px;top:24px;width:14px;height:14px;border-radius:50%;background:#FEBC2E"></i><i style="position:absolute;left:80px;top:24px;width:14px;height:14px;border-radius:50%;background:#28C840"></i>
  <div style="position:absolute;left:170px;right:120px;top:13px;height:44px;border-radius:22px;background:#fff;text-align:center;font-size:21px;line-height:44px;color:#5b5f67;font-weight:500">${lock}${v.dom}</div>
 </div>
 <div style="position:absolute;left:64px;right:64px;top:92px;height:56px;display:flex;align-items:center;justify-content:space-between">
  <div style="display:flex;align-items:center"><div style="width:46px;height:46px;border-radius:13px;background:${P.prim};color:${P.primInk};font-weight:800;font-size:26px;line-height:46px;text-align:center">${v.mark}</div><div style="margin-left:12px;white-space:nowrap;font-size:25px;font-weight:800;letter-spacing:-.03em;color:${P.ink};font-family:${P.head === "'Instrument Serif'" ? "'Instrument Serif'" : "'Inter Tight'"};${P.head === "'Instrument Serif'" ? 'font-weight:400;font-size:30px' : ''}">${v.name}</div></div>
  <div style="display:flex;align-items:center">${nav}<span style="margin-left:26px;padding:13px 22px;white-space:nowrap;border-radius:999px;background:${P.prim};color:${P.primInk};font-size:18px;font-weight:800">${v.navCta}</span></div>
 </div>
 <div style="position:absolute;left:64px;top:196px;padding:9px 18px;border-radius:999px;background:${P.tint};color:${P.prim === '#F5A524' ? '#9a5f00' : P.prim};font-size:16px;font-weight:700;letter-spacing:.05em;text-transform:uppercase">${v.kick}</div>
 <div style="position:absolute;left:64px;top:252px;width:490px;font-family:${P.head};font-weight:${P.hw};font-size:${P.hs}px;line-height:1.04;letter-spacing:-.03em;color:${P.ink}">${v.h1}</div>
 <div style="position:absolute;left:64px;top:452px;width:460px;font-size:22px;line-height:1.38;color:${P.mute}">${v.p}</div>
 <div class="rg" style="position:absolute;left:64px;top:572px;width:300px;height:84px;border-radius:42px;border:4px solid ${P.prim}"></div>
 <div style="position:absolute;left:64px;top:572px;width:300px;height:84px;border-radius:42px;background:${P.prim};color:${P.primInk};font-size:26px;font-weight:800;line-height:84px;text-align:center;letter-spacing:-.01em">${v.cta}</div>
 <div style="position:absolute;left:384px;top:572px;width:176px;height:84px;border-radius:42px;border:2px solid ${P.line};color:${P.ink};white-space:nowrap;font-size:20px;font-weight:700;line-height:80px;text-align:center">${v.sec}</div>
 <div style="position:absolute;left:64px;top:692px;width:520px;white-space:nowrap">${trust}</div>
 <div style="position:absolute;left:584px;top:196px;width:312px;height:500px;border-radius:40px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,${dark ? 0.5 : 0.18})"><svg viewBox="0 0 340 520" width="312" height="500" preserveAspectRatio="xMidYMid slice">${v.art}</svg></div>
 <div style="position:absolute;left:600px;top:216px;padding:10px 18px;border-radius:16px;background:#fff;color:#10261f;font-size:17px;font-weight:800;box-shadow:0 12px 30px rgba(0,0,0,.2)"><b style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#25D366;margin-right:9px"></b>${v.badge}</div>
 <div class="ts" style="position:absolute;left:590px;top:590px;width:330px;padding:16px 22px;border-radius:24px;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,.3);opacity:0;display:flex;align-items:center"><div style="width:48px;height:48px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;flex:none"><svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.600 15L2 22l5.100-1.300A10 10 0 1 0 12 2z"/></svg></div><div style="margin-left:16px"><div style="font-size:23px;font-weight:800;color:#10261f;letter-spacing:-.02em">Novo contato</div><div style="font-size:16px;color:#6b6f76;font-weight:500">via WhatsApp · agora</div></div></div>
 ${cards}
 <div style="position:absolute;left:858px;top:840px;width:76px;height:76px;border-radius:50%;background:#25D366;box-shadow:0 12px 28px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><svg width="42" height="42" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.600 15L2 22l5.100-1.300A10 10 0 1 0 12 2zm5.200 14.200c-.2.600-1.300 1.200-1.800 1.200-.5.100-1 .2-3.300-.7-2.800-1.100-4.600-4-4.700-4.200-.1-.2-1.100-1.500-1.100-2.800 0-1.300.7-2 .9-2.300.3-.3.600-.3.800-.3h.600c.2 0 .4 0 .6.500.2.600.8 2 .8 2.100.1.100.1.300 0 .500-.1.200-.1.300-.3.500l-.4.500c-.1.200-.3.300-.1.600.2.300.8 1.300 1.700 2.100 1.100 1 2.100 1.300 2.400 1.400.3.100.5.100.6-.1.200-.2.700-.8.900-1.100.2-.3.400-.2.700-.1l2 .9c.3.200.5.200.5.400.100.200.100.700-.100 1.300z"/></svg></div>
</div>`);
    inner.style.cssText = 'position:absolute;left:0;top:0;width:960px;height:940px;transform:scale(.5);transform-origin:0 0';
    return { root, ring: inner.querySelector('.rg'), toast: inner.querySelector('.ts') };
  }
  // pulso no botão e aviso "novo contato" que entra com mola (t0 = início da animação)
  function animMock(m, t, t0) {
    const q = (((t - t0) % 1.7) + 1.7) % 1.7 / 1.7;
    m.ring.style.transform = `scale(${1 + q * 0.28},${1 + q * 0.5})`;
    m.ring.style.opacity = String(t < t0 ? 0 : (1 - q) * 0.75);
    const k = p(t, t0 + 0.8, 0.45, E.back);
    m.toast.style.opacity = String(clamp(k * 2));
    m.toast.style.transform = `translateY(${(1 - k) * 22}px) scale(${0.7 + 0.3 * k})`;
  }
  const FOOT = css(el('', chrome, SC.some((S) => S.vis?.type === 'site') ? 'ILUSTRAÇÃO · EMPRESAS FICTÍCIAS' : 'ILUSTRAÇÃO'), 'position:absolute;left:0;right:0;bottom:56px;text-align:center;font-family:JetBrains Mono;font-size:17px;letter-spacing:.18em;color:#6b6f76;opacity:0');

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
    FOOT.style.opacity = D.style === 'ember' || !SC.some((S) => S.vis && S.vis.type !== 'none') ? '0' : '0.85';
  };
  const gateScene = (t, S, tail = 0.3) => t >= S.t0 - 0.01 && t <= S.t1 + tail;
  const exitOf = (t, S, d = 0.18) => (S.i === N - 1 ? 0 : p(t, S.t1 - d, d, E.io));

  // ----- animação da frase (busca, conversa, carregamento…) montada dentro da cena -----
  const V = window.__makeVisuals({ el, css, p, E, esc, clamp, lerp, siteMock, animMock });
  const hasVis = (S) => !!(S.vis && S.vis.type !== 'none');
  function mountVisual(S, parent, theme, x, y, k = 1, persist = false) {
    const v = V.build(S.vis, parent, theme);
    css(v.root, `left:${x}px;top:${y}px;transform-origin:0 0`);
    return {
      S,
      update(t) {
        const q = S.vcont ? 1 : p(t, S.t0, 0.5, E.out5);
        const last = !persist && S.t1 >= S.g1 - 1e-6 && S.i !== N - 1;
        const ex = last ? p(t, S.t1 - 0.2, 0.2, E.io) : 0;
        v.root.style.opacity = String(q * (1 - ex));
        v.root.style.transform = `translateY(${(1 - q) * 60}px) scale(${k})`;
        v.update(t, S.g0, S.g1 - S.g0);
      },
    };
  }

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
      const hv = hasVis(S);
      const wordMask = (b, strongCss, lightCss, margin = '.2em') => S.words.map((w) => { const m = css(el('m', b), `margin-right:${margin};padding-bottom:.1em`); return css(el('', m, esc(w.w), 'span'), `display:block;${w.strong ? strongCss : lightCss}`); });
      if (v === 1) {
        o.rows = [520, 1190, 1360].map((y, k) => css(el('abs', c, Array(7).fill(esc(S.big)).join('&nbsp;&nbsp;✦&nbsp;&nbsp;')), `left:0;top:${y}px;white-space:nowrap;font-weight:800;font-size:190px;line-height:1;color:transparent;-webkit-text-stroke:2px rgba(255,255,255,${k ? 0.07 : 0.1})`));
        o.kick = css(el('kick', c, S.kind === 'hook' ? esc(S.label) : `[ ${pad(S.i + 1)} ]`), 'left:0;right:0;text-align:center;top:560px;color:#C9CCD1');
        o.giant = css(el('abs', c, esc(S.big)), `left:0;right:0;top:760px;text-align:center;font-weight:800;line-height:1;letter-spacing:-.05em;font-size:${Math.min(300, Math.floor(950 / (S.big.length * 0.6)))}px;text-shadow:0 0 90px rgba(201,204,209,.4)`);
        const sub = css(el('abs', c), `left:90px;right:90px;top:1040px;text-align:center;font-size:${S.len > 70 ? 42 : 48}px;line-height:1.18;letter-spacing:-.02em;font-weight:500;color:#9A9EA5`);
        o.sub = wordSpans(sub, S, (n, w) => { if (w.strong) css(n, 'color:#fff;font-weight:800'); });
      } else if (v === 2) {
        o.panel = css(el('abs', c), 'inset:0;background:linear-gradient(150deg,#F1F2F4 0%,#C9CCD1 55%,#9A9EA5 100%)');
        o.tag = css(el('kick', o.panel, `CASE ${pad(S.i + 1)} — ${esc(LABEL1)}`), `left:80px;top:${hv ? 330 : 560}px;color:#0A0B0D`);
        o.badge = css(el('abs', o.panel, `<div style="font-weight:800;font-size:${hv ? 64 : 96}px;letter-spacing:-.04em">${pad(S.i + 1)}</div>`), `right:90px;top:${hv ? 290 : 480}px;width:${hv ? 160 : 230}px;height:${hv ? 160 : 230}px;border-radius:50%;border:4px dashed #0A0B0D;color:#0A0B0D;display:flex;align-items:center;justify-content:center`);
        const b = css(el('abs', o.panel), `left:80px;right:80px;top:${hv ? 500 : 780}px;font-size:${fsFor(S.len, hv ? 0.9 : 1.02)}px;line-height:1.04;letter-spacing:-.045em;font-weight:800;color:#0A0B0D`);
        o.words = wordMask(b, 'color:#0A0B0D', 'color:#4A4D55;font-weight:600');
        if (hv) o.vis = mountVisual(S, o.panel, 'dark', 90, 1120);
      } else if (v === 0) {
        o.num = css(el('kick', c, `[ ${pad(S.i + 1)} ]`), `left:80px;top:${hv ? 380 : 690}px;color:#C9CCD1`);
        o.ln = css(el('line', c), `left:80px;top:${hv ? 432 : 742}px;width:220px`);
        const b = css(el('abs', c), `left:80px;right:80px;top:${hv ? 480 : 790}px;font-size:${fsFor(S.len, hv ? 0.95 : 1.08)}px;line-height:1.03;letter-spacing:-.045em;font-weight:800`);
        o.words = wordMask(b, 'color:#fff', 'color:#8B8F97;font-weight:500');
        if (hv) o.vis = mountVisual(S, c, 'dark', 90, 1120);
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
        if (o.vis) o.vis.update(t);
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
  // 2 · EDITORIAL — cenas escuras e prata alternadas, troca em círculo, serifa itálica
  // ============================================================================
  function editorial() {
    const isDark = (S) => S.kind !== 'line' || S.i % 2 === 0;
    const items = SC.map((S) => {
      const dark = isDark(S); const hv = hasVis(S);
      const ink = dark ? '#fff' : '#0A0B0D'; const soft = dark ? '#C9CCD1' : '#4A4D55';
      const ring = css(el('abs', stage), `inset:0;background:#C9CCD1;z-index:${S.i * 2}`);
      const c = css(el('sc', stage), `z-index:${S.i * 2 + 1};background:${dark ? 'radial-gradient(900px 800px at 70% 20%,#2b2d33 0%,#0A0B0D 62%)' : 'radial-gradient(900px 700px at 20% 15%,#F4F5F7 0%,#D9DCE1 80%)'}`);
      const r = rng(S.i * 97 + 13);
      // formas de vidro ao fundo (sem conteúdo), só para dar profundidade
      const glass = [0, 1, 2].map((n) => {
        const g = css(el('abs', c), `width:${300 + r() * 160}px;height:${190 + r() * 120}px;border-radius:34px;${dark ? 'background:linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.12)' : 'background:#fff;box-shadow:0 30px 70px rgba(40,50,70,.14)'}`);
        return { g, x: n === 0 ? -140 : n === 1 ? 800 : 700, y: n === 0 ? 160 + r() * 100 : n === 1 ? 240 + r() * 120 : 1500 + r() * 60, rot: (r() - 0.5) * 24, bl: 4 + r() * 6, ph: r() * 6, fl: 0.6 + r() };
      });
      const kick = css(el('kick', c, S.kind === 'hook' ? esc(S.label) : `${pad(S.i + 1)} — ${esc(LABEL2)}`), `left:0;right:0;text-align:center;top:${hv ? 330 : 520}px;color:${soft}`);
      const fs = fsFor(S.len, S.kind === 'hook' ? 1.15 : hv ? 0.95 : 1.05);
      const box = css(el('abs', c), `left:60px;right:60px;top:${hv ? 640 : 880}px;transform:translateY(-50%);text-align:center;line-height:1.02;letter-spacing:-.04em;font-size:${fs}px;color:${ink}`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' serif'; css(n, `color:${soft};font-size:${Math.round(fs * 1.22)}px;letter-spacing:-.02em`); } else css(n, 'font-weight:800'); });
      let logo = null;
      if (S.kind === 'cta') logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:370px;top:340px;width:340px');
      const vis = hv ? mountVisual(S, c, dark ? 'dark' : 'light', 90, 1020) : null;
      return { S, dark, ring, c, glass, kick, words, logo, vis };
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
        o.glass.forEach((k, n) => {
          const q = p(t, S.t0 + 0.2 + n * 0.1, 0.8, E.out5);
          k.g.style.opacity = String(q * (o.dark ? 0.8 : 0.9)); k.g.style.filter = `blur(${k.bl}px)`;
          k.g.style.transform = `translate(${k.x + Math.sin(lt * 0.5 * k.fl + n) * 16}px,${k.y + Math.cos(lt * 0.4 * k.fl + n) * 20 + (1 - q) * 160}px) rotate(${k.rot + Math.sin(lt * 0.3 + n) * 2}deg)`;
        });
        if (o.vis) o.vis.update(t);
        o.kick.style.opacity = String(p(t, S.t0 + 0.3, 0.3));
        const stag = Math.min(0.1, (S.d * 0.45) / o.words.length);
        o.words.forEach((n, k) => blurIn(n, p(t, S.t0 + 0.3 + k * stag, 0.5, E.out5), 36, 0.94));
        if (o.logo) { const q = p(t, S.t0 + 0.5, 0.7, E.out5); o.logo.style.opacity = String(q); o.logo.style.transform = `translateY(${(1 - q) * 40}px)`; }
      });
    };
  }

  // ============================================================================
  // 3 · GRADIENT — preto, texto em prata metálico com brilho, painéis de vidro ao fundo, confete prata
  // ============================================================================
  function gradient() {
    bg.style.background = 'radial-gradient(900px 700px at 50% 38%,rgba(201,204,209,.12),transparent 70%),#0A0B0D';
    const cols = css(el('abs', stage), 'left:-130px;top:-300px;width:1340px;height:2600px;transform:rotate(-9deg)');
    const r0 = rng(21);
    const colEls = [0, 1, 2].map((ci) => {
      const col = css(el('abs', cols), `left:${ci * 420 + 20}px;top:0;width:390px`);
      for (let k = 0; k < 6; k++) {
        const h = 330 + Math.floor(r0() * 150);
        const tl = css(el('', col), `position:relative;margin-bottom:34px;width:390px;height:${h}px;border-radius:30px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(${Math.floor(r0() * 360)}deg,rgba(255,255,255,.14),rgba(255,255,255,.03) 60%,rgba(154,158,165,.18))`);
        css(el('', tl), 'position:absolute;left:28px;top:28px;width:44%;height:12px;border-radius:6px;background:rgba(255,255,255,.35)');
        css(el('', tl), 'position:absolute;left:28px;top:54px;width:28%;height:10px;border-radius:5px;background:rgba(255,255,255,.2)');
        css(el('', tl), `position:absolute;left:28px;bottom:30px;width:${30 + Math.floor(r0() * 40)}%;height:44px;border-radius:22px;background:rgba(255,255,255,.16)`);
      }
      return col;
    });
    const items = SC.map((S) => {
      const hv = hasVis(S);
      const c = el('sc', stage);
      const pill = css(el('', c, `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#fff;margin-right:14px"></span>${S.kind === 'hook' ? esc(S.label) : `${esc(LABEL2)} · ${pad(S.i + 1)} / ${pad(N)}`}`), `position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:${hv ? 320 : 560}px;padding:14px 30px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(10,11,13,.7);font-family:JetBrains Mono;font-size:21px;letter-spacing:.2em;text-transform:uppercase;color:#d7d7e6`);
      css(el('abs', c), `left:0;right:0;top:${hv ? 400 : 640}px;height:${hv ? 520 : 600}px;background:radial-gradient(closest-side,rgba(10,11,13,.85),transparent)`);
      const fs = fsFor(S.len, S.kind === 'hook' ? 1.15 : hv ? 0.95 : 1.05);
      const box = css(el('abs', c), `left:60px;right:60px;top:${hv ? 640 : 930}px;transform:translateY(-50%);text-align:center;line-height:1.04;letter-spacing:-.04em;font-size:${fs}px;text-shadow:0 6px 40px rgba(10,11,13,.9)`);
      const words = wordSpans(box, S, (n, w) => { if (w.strong) { n.className += ' grad'; css(n, `font-weight:800;font-size:${Math.round(fs * 1.1)}px`); } else css(n, 'font-weight:400;color:#C9CCD1'); });
      let logo = null; let glow = null;
      if (S.kind === 'cta') {
        glow = css(el('abs', c), 'left:140px;top:150px;width:800px;height:640px;background:radial-gradient(closest-side,rgba(228,230,233,.35),rgba(154,158,165,.12) 55%,transparent);filter:blur(10px)');
        logo = css(el('abs', c, `<img src="${D.brand.logo}" style="width:100%;display:block">`), 'left:350px;top:340px;width:380px');
      }
      const vis = hv ? mountVisual(S, c, 'dark', 90, 1020) : null;
      return { S, c, pill, words, logo, glow, vis, hv };
    });
    return (t) => {
      setChrome('#9A9EA5', false);
      drawStars(t);
      const i = sceneAt(t); const S0 = SC[i];
      const prev = SC[Math.max(0, i - 1)];
      const f = (S) => (hasVis(S) ? 0.18 : 0.5);
      const op = i === 0 ? f(S0) : lerp(f(prev), f(S0), p(t, S0.t0, 0.6, E.io));
      cols.style.opacity = String(op);
      cols.style.filter = `blur(${lerp(5, 2, (op - 0.18) / 0.32)}px)`;
      colEls.forEach((col, k) => { col.style.transform = `translateY(${(k % 2 ? 1 : -1) * t * 46 - (k % 2 ? 330 : 0)}px)`; });
      document.querySelectorAll('.grad').forEach((n) => { n.style.backgroundPosition = `${(t * 45) % 200}% 0`; });
      items.forEach((o) => {
        const { S, c } = o;
        const on = gateScene(t, S);
        c.style.display = on ? 'block' : 'none';
        if (!on) return;
        const ex = exitOf(t, S);
        c.style.opacity = String(1 - ex); c.style.filter = ex ? `blur(${ex * 12}px)` : 'none';
        o.pill.style.opacity = String(p(t, S.t0 + 0.05, 0.3));
        if (o.vis) o.vis.update(t);
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
  // 4 · SELECTION — estética de ferramenta de design: caixa de seleção e etiquetas ao redor do texto
  // ============================================================================
  function selection() {
    const TAGS = ['headline', 'copy', 'hero', 'callout', 'label', 'cta'];
    const isDark = (S) => S.kind !== 'line' || S.i % 2 === 0;
    const cur = css(el('', top, '<svg width="46" height="46" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg><div class="stag" style="left:20px;top:34px;--acc:#1b1b1d;--accink:#fff">esm</div>'), 'position:absolute;left:0;top:0;opacity:0;z-index:50');
    const items = SC.map((S) => {
      const dark = isDark(S); const hv = hasVis(S);
      const acc = dark ? '#E4E6E9' : '#0A0B0D'; const accink = dark ? '#0A0B0D' : '#FFFFFF';
      const ink = dark ? '#fff' : '#0A0B0D';
      const c = css(el('sc', stage), `z-index:${S.i + 1};--acc:${acc};--accink:${accink};background:${dark ? '#0A0B0D' : '#E6E8EB'}`);
      css(el('abs', c), `inset:0;background-image:radial-gradient(${dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.13)'} 1.6px,transparent 1.7px);background-size:40px 40px`);
      const vis = hv ? mountVisual(S, c, dark ? 'dark' : 'light', 90, 1050) : null;
      css(el('', c, `${esc(LABEL1)} / ${esc(LABEL2.toLowerCase())}`), `position:absolute;left:70px;bottom:110px;padding:8px 16px;background:${dark ? '#fff' : '#0A0B0D'};color:${dark ? '#0A0B0D' : '#fff'};font-family:JetBrains Mono;font-size:20px;letter-spacing:.04em`);
      let box; let words = []; let bar = null; let typed = null;
      if (S.kind === 'cta') {
        box = css(el('abs', c), `left:90px;right:90px;top:640px;text-align:center;line-height:1.04;letter-spacing:-.045em;font-weight:800;font-size:${fsFor(S.len, 1.1)}px;color:${ink}`);
        words = wordSpans(box, S, (n, w) => { if (!w.strong) css(n, 'color:#9A9EA5;font-weight:500'); });
        bar = css(el('abs', c), 'left:110px;top:1010px;width:860px;height:112px;border-radius:56px;background:#1c1c1f;border:1px solid #2c2e34');
        typed = css(el('abs', bar), 'left:44px;top:30px;font-family:JetBrains Mono;font-size:34px;color:#fff;white-space:nowrap');
        css(el('abs', bar, '↑'), 'right:16px;top:16px;width:80px;height:80px;border-radius:50%;background:#fff;color:#111;font-size:40px;text-align:center;line-height:78px;font-weight:800');
      } else {
        box = css(el('abs', c), `left:110px;right:110px;top:${hv ? 400 : 700}px;text-align:center;line-height:1.05;letter-spacing:-.045em;font-size:${fsFor(S.len, hv ? 0.98 : 1.08)}px;color:${ink}`);
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
      return { S, dark, c, words, sel, hs, tag, size, X, Y, W, H, typed, vis };
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
        if (o.vis) o.vis.update(t);
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
  // 5 · PERSPECTIVE — plano 3D onde a câmera passa por cada animação do Reel, com profundidade de campo
  // ============================================================================
  function perspective() {
    bg.style.background = 'radial-gradient(900px 600px at 50% 30%,rgba(201,204,209,.10),transparent 70%),linear-gradient(180deg,#0A0B0D 0%,#14161A 55%,#1B1D21 100%)';
    const persp = el('persp', stage); css(persp, 'inset:auto;left:0;top:640px;width:1080px;height:1280px;overflow:hidden;-webkit-mask-image:linear-gradient(transparent 0,#000 160px);mask-image:linear-gradient(transparent 0,#000 160px)');
    const plane = el('plane', persp);
    // uma linha do plano por frase: a animação daquela frase; sem animação, um painel de vidro
    const gids = []; const rowOf = SC.map((S) => {
      if (S.gid === null || !hasVis(S)) { gids.push(null); return gids.length - 1; }
      const at = gids.indexOf(S.gid);
      if (at >= 0) return at;
      gids.push(S.gid); return gids.length - 1;
    });
    const rows = gids.map((g, r) => {
      const S = g === null ? null : SC.find((x) => x.gid === g);
      const slot = css(el('', plane), `position:absolute;left:60px;top:${r * 600}px;width:900px;height:520px;transform-origin:0 0;transform:scale(1)`);
      if (S) return { r, vis: mountVisual(S, slot, 'light', 0, 0, 1, true), slot };
      css(el('', slot), 'position:absolute;inset:40px 120px;border-radius:44px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(150deg,rgba(255,255,255,.10),rgba(255,255,255,.02))');
      return { r, vis: null, slot };
    });
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
      const i = sceneAt(t);
      const S0 = SC[i];
      const prevRow = i === 0 ? rowOf[0] : rowOf[i - 1];
      const cu = lerp(prevRow, rowOf[i], i === 0 ? 1 : p(t, S0.t0, 0.7, E.out5));
      const isCta = S0.kind === 'cta';
      const flat = isCta ? p(t, S0.t0, 0.8, E.io) : 0;
      plane.style.transform = `rotateX(${67 - 4 * Math.sin(cu * 0.9)}deg) translateY(${-cu * 600 + 430}px) translateZ(${-flat * 600}px) scale(.8)`;
      persp.style.opacity = String(1 - flat * 0.65);
      rows.forEach((row) => {
        row.slot.style.filter = `blur(${clamp(Math.abs(row.r - cu) * 2.2, 0, 7)}px)`;
        if (row.vis) row.vis.update(t);
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
