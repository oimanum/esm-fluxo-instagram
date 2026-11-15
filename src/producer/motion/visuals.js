// Biblioteca de animações dos Reels: cada tipo ilustra o que a frase diz (busca, conversa, carregamento…).
// Cada componente nasce numa área de 900x520 e se anima por tempo: update(t, t0, d) com t0/d = início e duração da frase.
window.__makeVisuals = (L) => {
  const { el, css, p, E, esc, clamp, lerp } = L;
  const TH = (theme) => (theme === 'light'
    ? { card: '#FFFFFF', soft: '#F1F2F4', line: '#D9DCE1', ink: '#0A0B0D', mute: '#5B5F67', good: '#1F9D55', bad: '#D64545', btn: '#0A0B0D', btnInk: '#FFFFFF', shadow: '0 30px 70px rgba(0,0,0,.18)', alpha: (a) => `rgba(10,11,13,${a})` }
    : { card: '#14161A', soft: '#1B1D21', line: '#2A2C32', ink: '#FFFFFF', mute: '#9A9EA5', good: '#7BE3A0', bad: '#FF6B5E', btn: '#FFFFFF', btnInk: '#0A0B0D', shadow: '0 30px 80px rgba(0,0,0,.55)', alpha: (a) => `rgba(255,255,255,${a})` });
  const abs = (parent, s, html = '') => css(el('', parent, html), `position:absolute;${s}`);
  const pop = (n, q, dy = 26) => { n.style.opacity = String(clamp(q * 2)); n.style.transform = `translateY(${(1 - q) * dy}px) scale(${0.92 + 0.08 * q})`; };
  const check = (c, s = 3) => `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${s}" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>`;
  const cross = (c, s = 3) => `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${s}" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  // tempo "elástico": os atrasos foram pensados para ~3 s; frases mais curtas comprimem a sequência
  const scale = (d) => Math.min(1, Math.max(0.45, d / 3.4));

  const B = {};

  B.search = (v, T, root) => {
    const bar = abs(root, `left:10px;top:0;width:880px;height:96px;border-radius:48px;background:${T.card};border:1px solid ${T.line};box-shadow:${T.shadow}`);
    abs(bar, 'left:32px;top:28px;width:40px;height:40px', `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${T.mute}" stroke-width="2.4" stroke-linecap="round"><circle cx="10.500" cy="10.500" r="6.500"/><path d="M16 16l5 5"/></svg>`);
    const typed = abs(bar, `left:96px;top:24px;font:600 40px/48px 'Inter Tight';color:${T.ink};white-space:nowrap`);
    const rows = [['Concorrente A', 0], ['Concorrente B', 1], ['Sua empresa', 2]].map(([name, k]) => {
      const gone = k === 2;
      const r = abs(root, `left:10px;top:${136 + k * 128}px;width:880px;height:112px;border-radius:30px;background:${gone ? 'transparent' : T.card};border:${gone ? `3px dashed ${T.mute}` : `1px solid ${T.line}`};box-shadow:${gone ? 'none' : T.shadow}`);
      abs(r, `left:28px;top:28px;width:56px;height:56px;border-radius:50%;background:${gone ? 'transparent' : T.soft};border:${gone ? `2px dashed ${T.mute}` : 'none'}`);
      abs(r, `left:108px;top:20px;font:800 32px/40px 'Inter Tight';color:${gone ? T.mute : T.ink};letter-spacing:-.02em`, esc(name));
      if (gone) abs(r, `left:108px;top:62px;font:500 24px/30px 'Inter Tight';color:${T.bad}`, 'não aparece nos resultados');
      else { abs(r, `left:108px;top:66px;width:${k ? 300 : 360}px;height:12px;border-radius:6px;background:${T.alpha(0.12)}`); abs(r, `right:28px;top:28px;padding:0 28px;height:56px;border-radius:28px;background:${T.btn};color:${T.btnInk};font:800 24px/56px 'Inter Tight'`, 'Ligar'); }
      return { r, gone };
    });
    return (t, t0, d) => {
      const s = scale(d);
      const n = Math.floor(v.query.length * p(t, t0 + 0.15 * s, 1.0 * s, E.lin));
      typed.innerHTML = `${esc(v.query.slice(0, n))}<span style="display:inline-block;width:3px;height:.9em;background:${T.ink};vertical-align:-.1em;margin-left:3px;opacity:${Math.floor(t * 2.6) % 2 ? 0 : 1}"></span>`;
      rows.forEach(({ r, gone }, k) => {
        pop(r, p(t, t0 + (1.35 + k * 0.32) * s, 0.45, E.back));
        if (gone) {
          const q = p(t, t0 + 2.2 * s, 0.25);
          r.style.borderColor = q > 0 ? T.bad : T.mute;
          if (q > 0 && q < 1) r.style.transform += ` translateX(${Math.sin(q * 30) * 10}px)`;
        }
      });
    };
  };

  B.chat = (v, T, root) => {
    const head = abs(root, `left:10px;top:0;width:880px;height:100px;border-radius:30px 30px 0 0;background:${T.soft};border:1px solid ${T.line}`);
    abs(head, `left:28px;top:20px;width:60px;height:60px;border-radius:50%;background:${T.alpha(0.18)}`);
    abs(head, `left:108px;top:16px;font:800 30px/38px 'Inter Tight';color:${T.ink}`, 'Cliente');
    abs(head, `left:108px;top:54px;font:500 21px/26px 'Inter Tight';color:${T.good}`, '● online');
    abs(root, `left:10px;top:100px;width:880px;height:420px;border-radius:0 0 30px 30px;background:${T.card};border:1px solid ${T.line};border-top:none;box-shadow:${T.shadow}`);
    const bubbles = v.msgs.map((m, k) => {
      const me = m.who === 'voce';
      const w = Math.min(640, 90 + m.text.length * 20);
      const b = abs(root, `top:${132 + k * 124}px;${me ? 'right' : 'left'}:44px;width:${w}px;padding:22px 30px;border-radius:30px;${me ? `border-bottom-right-radius:8px;background:${T.btn};color:${T.btnInk}` : `border-bottom-left-radius:8px;background:${T.soft};color:${T.ink}`};font:600 31px/1.25 'Inter Tight'`, esc(m.text));
      return b;
    });
    const dots = abs(root, `left:44px;top:${132 + v.msgs.length * 124}px;padding:20px 28px;border-radius:30px;background:${T.soft};font:800 40px/20px 'Inter Tight';color:${T.mute};letter-spacing:4px`, '•••');
    return (t, t0, d) => {
      const s = scale(d);
      bubbles.forEach((b, k) => pop(b, p(t, t0 + (0.4 + k * 0.85) * s, 0.4, E.back)));
      dots.style.opacity = String(p(t, t0 + (0.4 + v.msgs.length * 0.85) * s, 0.3) * (Math.floor(t * 3) % 2 ? 0.4 : 1));
    };
  };

  B.loading = (v, T, root) => {
    const ph = abs(root, `left:290px;top:0;width:320px;height:520px;border-radius:52px;background:${T.card};border:8px solid ${T.line};box-shadow:${T.shadow};overflow:hidden`);
    abs(ph, `left:112px;top:14px;width:80px;height:20px;border-radius:10px;background:${T.alpha(0.12)}`);
    const prog = abs(ph, `left:0;top:0;height:8px;width:0;background:${T.btn}`);
    abs(ph, `left:28px;top:70px;width:236px;height:130px;border-radius:22px;background:${T.soft}`);
    [[230, 200], [262, 160], [294, 220]].forEach(([y, w]) => abs(ph, `left:28px;top:${y}px;width:${w}px;height:16px;border-radius:8px;background:${T.alpha(0.1)}`));
    const spin = abs(ph, `left:106px;top:218px;width:84px;height:84px;border-radius:50%;border:9px solid ${T.alpha(0.12)};border-top-color:${T.btn}`);
    const lab = abs(ph, `left:0;right:0;top:318px;text-align:center;font:600 28px/34px 'Inter Tight';color:${T.mute}`, esc(v.label));
    const out = abs(root, `left:230px;top:200px;width:440px;height:116px;border-radius:58px;background:${T.bad};color:#1b0502;font:800 38px/116px 'Inter Tight';text-align:center;opacity:0;box-shadow:0 20px 50px rgba(0,0,0,.35)`, `✕ ${esc(v.outcome)}`);
    return (t, t0, d) => {
      const s = scale(d);
      prog.style.width = `${p(t, t0 + 0.3 * s, 1.8 * s, E.out3) * 68}%`;
      const bad = p(t, t0 + 2.4 * s, 0.35, E.back);
      spin.style.transform = `rotate(${(t - t0) * 520}deg)`;
      spin.style.opacity = String(1 - bad); lab.style.opacity = String(1 - bad);
      ph.style.opacity = String(1 - 0.55 * bad);
      ph.style.transform = bad > 0 && bad < 1 ? `translateX(${Math.sin(bad * 40) * 12}px)` : 'none';
      out.style.opacity = String(clamp(bad * 2)); out.style.transform = `scale(${0.6 + 0.4 * bad})`;
    };
  };

  B.versus = (v, T, root) => {
    const side = (x, data, good) => {
      const c = abs(root, `left:${x}px;top:0;width:430px;height:520px;border-radius:34px;background:${T.card};border:1px solid ${good ? T.good : T.line};box-shadow:${T.shadow}`);
      abs(c, `left:0;right:0;top:0;height:100px;border-radius:34px 34px 0 0;background:${good ? T.alpha(0.08) : T.soft};text-align:center;font:800 36px/100px 'Inter Tight';color:${T.ink};letter-spacing:-.02em`, esc(data.title));
      const rows = data.items.map((it, k) => {
        const r = abs(c, `left:30px;right:26px;top:${136 + k * 120}px;height:96px`);
        abs(r, 'left:0;top:18px;width:48px;height:48px', good ? check(T.good, 3.4) : cross(T.bad, 3.4));
        abs(r, `left:68px;top:0;width:300px;font:600 30px/36px 'Inter Tight';color:${T.ink}`, esc(it));
        return r;
      });
      return { c, rows, dir: good ? 1 : -1 };
    };
    const L1 = side(10, v.left, false); const R1 = side(460, v.right, true);
    return (t, t0, d) => {
      const s = scale(d);
      [L1, R1].forEach((S, i) => {
        const q = p(t, t0 + (0.15 + i * 0.25) * s, 0.55, E.out5);
        S.c.style.opacity = String(q); S.c.style.transform = `translateX(${(1 - q) * 140 * S.dir}px)`;
        S.rows.forEach((r, k) => pop(r, p(t, t0 + (0.9 + i * 0.2 + k * 0.4) * s, 0.4, E.back), 18));
      });
    };
  };

  B.checklist = (v, T, root) => {
    const rows = v.items.map((it, k) => {
      const h = 104; const top = k * (h + 22);
      const r = abs(root, `left:10px;top:${top}px;width:880px;height:${h}px;border-radius:28px;background:${T.card};border:1px solid ${T.line};box-shadow:${T.shadow}`);
      const box = abs(r, `left:28px;top:26px;width:52px;height:52px;border-radius:15px;border:3px solid ${T.mute}`);
      const tick = abs(box, 'left:5px;top:5px;width:36px;height:36px;opacity:0', check(T.btnInk, 4));
      abs(r, `left:110px;top:0;right:30px;font:700 34px/${h}px 'Inter Tight';color:${T.ink};white-space:nowrap`, esc(it));
      return { r, box, tick };
    });
    return (t, t0, d) => {
      const s = scale(d);
      rows.forEach(({ r, box, tick }, k) => {
        pop(r, p(t, t0 + (0.15 + k * 0.2) * s, 0.4, E.back), 22);
        const q = p(t, t0 + (1.0 + k * 0.65) * s, 0.28, E.back);
        box.style.background = q > 0.01 ? T.btn : 'transparent'; box.style.borderColor = q > 0.01 ? T.btn : T.mute;
        tick.style.opacity = String(clamp(q * 1.5)); tick.style.transform = `scale(${0.4 + 0.6 * q})`;
      });
    };
  };

  B.funnel = (v, T, root) => {
    const n = v.steps.length; const h = Math.floor(440 / n) - 16;
    const bars = v.steps.map((st, k) => {
      const w = 860 - k * Math.floor(460 / n);
      const b = abs(root, `left:${(900 - w) / 2}px;top:${k * (h + 22)}px;width:${w}px;height:${h}px;border-radius:26px;background:${k === n - 1 ? T.btn : T.card};border:1px solid ${k === n - 1 ? T.btn : T.line};box-shadow:${T.shadow};color:${k === n - 1 ? T.btnInk : T.ink};text-align:center;font:800 ${Math.min(40, h * 0.4)}px/${h}px 'Inter Tight';letter-spacing:-.02em`, esc(st));
      return b;
    });
    return (t, t0, d) => {
      const s = scale(d);
      bars.forEach((b, k) => { const q = p(t, t0 + (0.2 + k * 0.5) * s, 0.5, E.out5); b.style.opacity = String(q); b.style.transform = `scaleX(${0.6 + 0.4 * q}) translateY(${(1 - q) * -30}px)`; });
    };
  };

  B.steps = (v, T, root) => {
    const n = v.steps.length; const xs = Array.from({ length: n }, (_, k) => 130 + (640 * k) / (n - 1));
    abs(root, `left:130px;top:150px;width:640px;height:8px;border-radius:4px;background:${T.alpha(0.15)}`);
    const fill = abs(root, `left:130px;top:150px;width:0;height:8px;border-radius:4px;background:${T.btn}`);
    const nodes = v.steps.map((st, k) => {
      const c = abs(root, `left:${xs[k] - 62}px;top:96px;width:124px;height:124px;border-radius:50%;background:${T.card};border:4px solid ${T.btn};box-shadow:${T.shadow};text-align:center;font:800 54px/116px 'Inter Tight';color:${T.ink}`, String(k + 1));
      const l = abs(root, `left:${xs[k] - 150}px;top:262px;width:300px;text-align:center;font:800 38px/46px 'Inter Tight';color:${T.ink};letter-spacing:-.02em`, esc(st));
      return { c, l };
    });
    return (t, t0, d) => {
      const s = scale(d);
      fill.style.width = `${p(t, t0 + 0.3 * s, 2.0 * s, E.io) * 640}px`;
      nodes.forEach(({ c, l }, k) => {
        const q = p(t, t0 + (0.2 + k * 0.8) * s, 0.45, E.back);
        c.style.opacity = String(clamp(q * 2)); c.style.transform = `scale(${0.5 + 0.5 * q})`;
        pop(l, p(t, t0 + (0.4 + k * 0.8) * s, 0.4, E.out5), 20);
      });
    };
  };

  B.notification = (v, T, root) => {
    const cards = v.items.map((it, k) => {
      const c = abs(root, `left:20px;top:${20 + k * 152}px;width:860px;height:128px;border-radius:34px;background:${T.card};border:1px solid ${T.line};box-shadow:${T.shadow}`);
      abs(c, `left:26px;top:26px;width:76px;height:76px;border-radius:22px;background:${T.btn};color:${T.btnInk};font:800 38px/76px 'Inter Tight';text-align:center`, '●');
      abs(c, `left:126px;top:22px;width:620px;font:800 34px/42px 'Inter Tight';color:${T.ink};letter-spacing:-.02em;white-space:nowrap`, esc(it));
      abs(c, `left:126px;top:72px;font:500 24px/30px 'Inter Tight';color:${T.mute}`, 'agora');
      return c;
    });
    return (t, t0, d) => {
      const s = scale(d);
      cards.forEach((c, k) => { const q = p(t, t0 + (0.2 + k * 0.6) * s, 0.5, E.back); c.style.opacity = String(clamp(q * 2)); c.style.transform = `translateY(${(1 - q) * -90}px) scale(${0.92 + 0.08 * q})`; });
    };
  };

  B.quote = (v, T, root) => {
    const b = abs(root, `left:40px;top:10px;width:820px;min-height:250px;padding:44px 52px;border-radius:44px;border-bottom-left-radius:10px;background:${T.card};border:1px solid ${T.line};box-shadow:${T.shadow};font:800 52px/1.14 'Inter Tight';color:${T.ink};letter-spacing:-.03em`);
    const txt = abs(b, 'position:relative');
    const av = abs(root, `left:60px;top:350px;width:120px;height:120px;border-radius:50%;background:${T.soft};border:1px solid ${T.line};overflow:hidden`);
    abs(av, `left:40px;top:22px;width:40px;height:40px;border-radius:50%;background:${T.alpha(0.3)}`);
    abs(av, `left:18px;top:70px;width:84px;height:80px;border-radius:42px;background:${T.alpha(0.22)}`);
    abs(root, `left:204px;top:372px;font:800 36px/44px 'Inter Tight';color:${T.ink}`, esc(v.who));
    abs(root, `left:204px;top:418px;font:500 24px/30px 'JetBrains Mono';color:${T.mute}`, 'pensando…');
    return (t, t0, d) => {
      const s = scale(d);
      const q = p(t, t0 + 0.2 * s, 0.4, E.back);
      b.style.opacity = String(clamp(q * 2)); b.style.transform = `scale(${0.9 + 0.1 * q})`;
      const n = Math.floor(v.text.length * p(t, t0 + 0.7 * s, 1.4 * s, E.lin));
      txt.innerHTML = `${esc(v.text.slice(0, n))}<span style="visibility:hidden">${esc(v.text.slice(n))}</span>`;
    };
  };

  B.map = (v, T, root) => {
    const m = abs(root, `left:10px;top:0;width:880px;height:520px;border-radius:34px;overflow:hidden;background:${T.soft};border:1px solid ${T.line};box-shadow:${T.shadow}`);
    abs(m, 'inset:0', `<svg width="880" height="520" viewBox="0 0 880 520"><g stroke="${T.alpha(0.1)}" stroke-width="22" fill="none"><path d="M-20 150H900M-20 360H900M210 -20V540M560 -20V540"/></g><g stroke="${T.alpha(0.07)}" stroke-width="10" fill="none"><path d="M-20 255H900M380 -20V540M740 -20V540M-20 70H900"/></g><g fill="${T.alpha(0.05)}"><rect x="40" y="180" width="140" height="150" rx="14"/><rect x="600" y="180" width="110" height="150" rx="14"/><rect x="250" y="390" width="120" height="100" rx="14"/></g></svg>`);
    const ring = abs(m, `left:390px;top:190px;width:100px;height:100px;border-radius:50%;border:4px solid ${T.btn};opacity:0`);
    const pin = abs(m, 'left:392px;top:90px;width:96px;height:120px', `<svg width="96" height="120" viewBox="0 0 24 30"><path d="M12 29S2 18 2 11a10 10 0 0 1 20 0c0 7-10 18-10 18z" fill="${T.bad}"/><circle cx="12" cy="11" r="4" fill="#fff"/></svg>`);
    const sheet = abs(root, `left:60px;top:330px;width:780px;height:190px;border-radius:30px 30px 34px 34px;background:${T.card};border:1px solid ${T.line};box-shadow:${T.shadow}`);
    abs(sheet, `left:36px;top:22px;font:800 40px/48px 'Inter Tight';color:${T.ink};letter-spacing:-.02em`, esc(v.name));
    abs(sheet, `left:36px;top:78px;font:600 26px/32px 'Inter Tight';color:${T.good}`, `● ${esc(v.label)}`);
    ['Ligar', 'Como chegar'].forEach((b, k) => abs(sheet, `left:${36 + k * 220}px;top:120px;padding:0 30px;height:54px;border-radius:27px;background:${k ? 'transparent' : T.btn};color:${k ? T.ink : T.btnInk};border:${k ? `2px solid ${T.line}` : 'none'};font:800 24px/${k ? 50 : 54}px 'Inter Tight'`, b));
    return (t, t0, d) => {
      const s = scale(d);
      const q = p(t, t0 + 0.2 * s, 0.7, E.back);
      pin.style.opacity = String(clamp(q * 3)); pin.style.transform = `translateY(${(1 - q) * -260}px)`;
      const r = clamp((t - t0 - 0.9 * s) / 1.1);
      ring.style.opacity = String(r > 0 && r < 1 ? 0.7 * (1 - r) : 0); ring.style.transform = `scale(${1 + r * 2.4})`;
      const sh = p(t, t0 + 1.2 * s, 0.55, E.out5);
      sheet.style.opacity = String(sh); sheet.style.transform = `translateY(${(1 - sh) * 120}px)`;
    };
  };

  B.clock = (v, T, root) => {
    const face = abs(root, `left:40px;top:50px;width:420px;height:420px;border-radius:50%;background:${T.card};border:10px solid ${T.btn};box-shadow:${T.shadow}`);
    for (let k = 0; k < 12; k++) abs(face, `left:196px;top:10px;width:8px;height:${k % 3 ? 20 : 34}px;border-radius:4px;background:${T.mute};transform-origin:4px 190px;transform:rotate(${k * 30}deg)`);
    const hh = abs(face, `left:196px;top:100px;width:10px;height:100px;border-radius:5px;background:${T.ink};transform-origin:5px 100px`);
    const mh = abs(face, `left:197px;top:56px;width:8px;height:144px;border-radius:4px;background:${T.ink};transform-origin:4px 144px`);
    abs(face, `left:184px;top:184px;width:34px;height:34px;border-radius:50%;background:${T.btn}`);
    const lab = abs(root, `left:510px;top:150px;width:380px;font:800 62px/1.06 'Inter Tight';color:${T.ink};letter-spacing:-.03em`, esc(v.label));
    const bar = abs(root, `left:510px;top:360px;width:0;height:10px;border-radius:5px;background:${T.btn}`);
    return (t, t0, d) => {
      const s = scale(d);
      const u = t - t0;
      mh.style.transform = `rotate(${u * 190}deg)`; hh.style.transform = `rotate(${u * 16 + 60}deg)`;
      const q = p(t, t0 + 0.3 * s, 0.5, E.out5);
      face.style.opacity = String(q); face.style.transform = `scale(${0.85 + 0.15 * q})`;
      pop(lab, p(t, t0 + 0.7 * s, 0.5, E.out5), 30);
      bar.style.width = `${p(t, t0 + 1.2 * s, 1.0 * s, E.out5) * 330}px`;
    };
  };

  B.stat = (v, T, root) => {
    const m = /^([\d.,]+)(.*)$/.exec(v.value) || [null, '0', ''];
    const target = parseFloat(m[1].replace(',', '.')) || 0; const suffix = m[2]; const dec = /[.,]\d/.test(m[1]) ? 1 : 0;
    const num = abs(root, `left:0;right:0;top:20px;text-align:center;font:800 290px/1 'Inter Tight';color:${T.ink};letter-spacing:-.05em`);
    const lab = abs(root, `left:60px;right:60px;top:340px;text-align:center;font:600 44px/1.2 'Inter Tight';color:${T.mute}`, esc(v.label));
    abs(root, `left:150px;top:470px;width:600px;height:10px;border-radius:5px;background:${T.alpha(0.12)}`);
    const bar = abs(root, `left:150px;top:470px;width:0;height:10px;border-radius:5px;background:${T.btn}`);
    return (t, t0, d) => {
      const s = scale(d);
      const q = p(t, t0 + 0.2 * s, 1.3 * s, E.out5);
      num.textContent = `${(target * q).toFixed(dec)}${suffix}`;
      num.style.transform = `scale(${0.9 + 0.1 * q})`;
      pop(lab, p(t, t0 + 0.9 * s, 0.5, E.out5), 24);
      bar.style.width = `${(suffix.includes('%') ? target / 100 : 1) * q * 600}px`;
    };
  };

  B.site = (v, T, root) => {
    const m = L.siteMock(root, v.niche || 0);
    css(m.root, 'left:186px;top:0;transform:scale(1.1)');
    return (t, t0) => { L.animMock(m, t, t0 + 0.6); };
  };

  B.none = (v, T, root) => {
    const rings = [0, 1, 2].map((k) => abs(root, `left:${450 - 90 - k * 70}px;top:${260 - 90 - k * 70}px;width:${180 + k * 140}px;height:${180 + k * 140}px;border-radius:50%;border:2px solid ${T.alpha(0.14 - k * 0.03)}`));
    return (t, t0) => rings.forEach((r, k) => { const q = ((t - t0) * 0.5 + k * 0.33) % 1; r.style.transform = `scale(${0.7 + q * 0.6})`; r.style.opacity = String(1 - q); });
  };

  return {
    // Monta a animação dentro de `parent`. Devolve { root, update(t, t0, d) }.
    build(vis, parent, theme = 'dark') {
      const T = TH(theme);
      const root = css(el('', parent), 'position:absolute;left:0;top:0;width:900px;height:520px');
      const update = (B[vis.type] || B.none)(vis, T, root);
      return { root, update };
    },
  };
};
