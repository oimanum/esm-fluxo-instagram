// Slides no estilo dos carrosséis de referência (manchete grossa, rótulos mono, preto e papel, cartões, rodapé com @),
// sempre na identidade da ESM Web: preto, prata e branco, Poppins, logo.
import { join } from 'node:path';
import { parseEmphasis, plain } from '../text.js';
import { ProducerError } from './tts.js';
import { fontCss, logoUri, esc, withBrowser, shot } from './html.js';

const CSS = (w, h) => `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden;font-family:'Poppins',sans-serif}
.sl{position:absolute;inset:0;overflow:hidden}
.dk{background:#0A0B0D;color:#fff}
.dk::before{content:'';position:absolute;inset:0;background:radial-gradient(900px 700px at 88% -4%,rgba(201,204,209,.16),transparent 70%),radial-gradient(700px 600px at 0% 104%,rgba(201,204,209,.08),transparent 70%)}
.pp{background:#E8EAED;color:#0A0B0D}
.pp::before{content:'';position:absolute;inset:0;background:radial-gradient(900px 700px at 90% -6%,rgba(255,255,255,.9),transparent 70%);background-image:linear-gradient(rgba(10,11,13,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(10,11,13,.055) 1px,transparent 1px),radial-gradient(900px 700px at 90% -6%,rgba(255,255,255,.9),transparent 70%);background-size:54px 54px,54px 54px,auto}
.mark{position:absolute;pointer-events:none}
.top{position:absolute;left:64px;right:64px;top:58px;display:flex;justify-content:space-between;align-items:center}
.top img{width:104px;display:block}
.pp .top img{filter:brightness(.18)}
.cnt{font:500 20px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#9A9EA5}
.pp .cnt{color:#5B5F67}
.col{position:absolute;left:72px;right:72px;display:flex;flex-direction:column}
.in{width:100%}
.kick{font:500 21px 'JetBrains Mono',monospace;letter-spacing:.24em;text-transform:uppercase;color:#C9CCD1;margin-bottom:30px}
.pp .kick{color:#4A4D55}
.h{font-weight:800;letter-spacing:-.035em;line-height:1.03}
.h .s{color:#fff}.h .l{color:#8B8F97}
.pp .h .s{color:#0A0B0D}.pp .h .l{color:#6F737B}
.h .bx{display:inline-block;background:#fff;color:#0A0B0D;padding:0 .16em;border-radius:.14em;line-height:1.08;margin:.04em 0}
.pp .h .bx{background:#0A0B0D;color:#fff}
.sub{font-weight:400;line-height:1.4;color:#C9CCD1}
.sub .s{color:#fff;font-weight:700}.sub .l{color:#AEB2B9}
.pp .sub{color:#3A3D44}.pp .sub .s{color:#0A0B0D}.pp .sub .l{color:#4A4D55}
.ft{position:absolute;left:64px;right:64px;bottom:66px;display:flex;justify-content:space-between;align-items:center}
.hd{display:flex;align-items:center;gap:16px;font:500 26px 'Poppins',sans-serif}
.av{width:68px;height:68px;border-radius:50%;background:#1B1D21;border:2px solid #3A3D44;display:flex;align-items:center;justify-content:center}
.av img{width:44px}
.pp .av{background:#0A0B0D}
.pl{padding:14px 26px;border:1.5px solid rgba(255,255,255,.38);border-radius:999px;font:500 19px 'JetBrains Mono',monospace;letter-spacing:.18em;text-transform:uppercase}
.pp .pl{border-color:rgba(10,11,13,.4)}
.dots{position:absolute;left:0;right:0;bottom:26px;display:flex;justify-content:center;gap:10px}
.dots i{width:10px;height:10px;border-radius:5px;background:rgba(255,255,255,.28)}
.dots i.on{width:28px;background:#fff}
.pp .dots i{background:rgba(10,11,13,.25)}.pp .dots i.on{background:#0A0B0D}
.rule{height:3px;background:#C9CCD1;margin:26px 0 38px}
.pp .rule{background:#0A0B0D}
.row{display:flex;align-items:center;gap:30px;margin-bottom:34px}
.tile{flex:none;width:92px;height:92px;border-radius:24px;background:#fff;color:#0A0B0D;display:flex;align-items:center;justify-content:center;font:800 34px 'Poppins',sans-serif;letter-spacing:-.02em}
.rn{font-weight:800;font-size:40px;letter-spacing:-.025em;color:#fff;line-height:1.1}
.rd{font-weight:400;font-size:27px;line-height:1.32;color:#9A9EA5;margin-top:4px}
.cd{border-radius:30px;padding:30px 36px;background:#14161A;border:1.5px solid #26272C;margin-bottom:22px}
.cd .lb{display:flex;align-items:center;gap:14px;font:500 19px 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#C9CCD1;margin-bottom:12px}
.cd .tx{font-weight:600;font-size:36px;line-height:1.25;color:#fff;letter-spacing:-.01em}
.cd.hi{border:2.5px solid #fff;background:#101114}
.ic{width:34px;height:34px;flex:none}
.pp .cd{background:#fff;border-color:#D5D8DD}
.pp .cd .lb{color:#4A4D55}.pp .cd .tx{color:#0A0B0D}
.note{font-weight:400;font-size:27px;line-height:1.4;color:#9A9EA5;margin-top:26px}.note b{color:#fff;font-weight:700}
.dcard{border-radius:36px;background:#0A0B0D;color:#fff;padding:38px 44px;margin-top:34px}
.dcard .lb{font:500 19px 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#9A9EA5;margin-bottom:12px}
.dcard .tx{font-weight:700;font-size:44px;line-height:1.15;letter-spacing:-.02em}
.num{font-weight:800;line-height:.9;letter-spacing:-.05em;color:#0A0B0D}
.big{font-weight:800;letter-spacing:-.06em;line-height:.95;color:#fff;text-align:center}
.chk{flex:none;width:58px;height:58px;border-radius:17px;border:3px solid #0A0B0D;display:flex;align-items:center;justify-content:center}
.chk.on{background:#0A0B0D}
.crow{display:flex;align-items:center;gap:26px;padding:24px 30px;margin-bottom:18px;border-radius:26px;background:#fff;border:1px solid #D5D8DD}
.crow span{font-weight:600;font-size:34px;line-height:1.2;letter-spacing:-.01em;color:#0A0B0D}
.kw{display:inline-block;background:#fff;color:#0A0B0D;border-radius:30px;padding:10px 56px;font:800 118px 'JetBrains Mono',monospace;letter-spacing:.04em;margin:18px 0 34px}
.btn{display:inline-flex;align-items:center;gap:16px;background:#fff;color:#0A0B0D;border-radius:999px;padding:26px 52px;font-weight:700;font-size:32px;letter-spacing:-.01em}
.hint{font:500 20px 'JetBrains Mono',monospace;letter-spacing:.24em;text-transform:uppercase;color:#9A9EA5;text-align:center}
`;

const ARROW = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const CHECK = (c = '#fff') => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>`;
const CROSS = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#9A9EA5" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9.500"/><path d="M8.500 8.500l7 7M15.500 8.500l-7 7"/></svg>';
const OK = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.500"/><path d="M8 12.500l3 3 5-6"/></svg>';
const STAR = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.9z"/></svg>';
const SAVE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.500L6 21z"/></svg>';

// Texto com ** : destaque em branco (ou preto no papel) e o resto em tom suave. `box` coloca o destaque curto em caixa.
function tx(text, { box = false } = {}) {
  const parts = parseEmphasis(text);
  const hasMark = parts.some((p) => !p.strong);
  return parts.map((p) => {
    const t = esc(p.text);
    if (!hasMark) return `<span class="s">${t}</span>`;
    if (p.strong && box && plain(p.text).trim().split(/\s+/).length <= 3) return `<span class="bx">${t.trim()}</span> `;
    return `<span class="${p.strong ? 's' : 'l'}">${t}</span>`;
  }).join('');
}
const size = (n, table) => { for (const [max, px] of table) if (n <= max) return px; return table[table.length - 1][1]; };
const initials = (name) => plain(name).replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';

// Cada tipo devolve { theme, body, area } — area = 'bottom' (capa), 'center' ou 'top'.
const KINDS = {
  cover: (s, c) => ({
    theme: 'dk', area: c.story ? 'center' : 'bottom',
    mark: true,
    body: `${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
<div class="h" style="font-size:${size(plain(s.title).length, c.story ? [[34, 128], [60, 112], [90, 96], [999, 84]] : [[34, 122], [60, 106], [90, 92], [999, 80]])}px">${tx(s.title, { box: true })}</div>
${s.sub ? `<div class="sub" style="font-size:${c.story ? 40 : 34}px;margin-top:34px">${tx(s.sub)}</div>` : ''}`,
  }),
  statement: (s, c) => ({
    theme: 'dk', area: 'center',
    body: `${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}
<div class="h" style="font-size:${size(plain(s.title).length, [[40, 104], [70, 90], [100, 78], [999, 66]])}px">${tx(s.title)}</div>
${s.body ? `<div class="sub" style="font-size:34px;margin-top:38px">${tx(s.body)}</div>` : ''}`,
  }),
  numbered: (s) => ({
    theme: 'pp', area: 'center',
    body: `${s.n ? `<div class="num" style="font-size:150px">${s.n}.</div>` : ''}
<div class="h" style="font-size:${size(plain(s.title).length, [[40, 88], [70, 76], [999, 64]])}px;margin-top:${s.n ? 14 : 0}px">${tx(s.title)}</div>
${s.body ? `<div class="sub" style="font-size:32px;margin-top:30px">${tx(s.body)}</div>` : ''}
${s.card ? `<div class="dcard"><div class="lb">${esc(s.card.label || 'O QUE MUDA')}</div><div class="tx">${tx(s.card.text).replace(/class="[sl]"/g, '')}</div></div>` : ''}`,
  }),
  list: (s) => ({
    theme: 'dk', area: 'center',
    body: `<div style="display:flex;justify-content:space-between;align-items:flex-end"><div class="h" style="font-size:78px"><span class="s">${esc(s.title)}</span></div>${s.tag ? `<div class="cnt" style="padding-bottom:12px">${esc(s.tag)}</div>` : ''}</div><div class="rule"></div>
${s.items.map((i) => `<div class="row"><div class="tile">${esc(initials(i.name))}</div><div><div class="rn">${esc(i.name)}</div>${i.desc ? `<div class="rd">${esc(i.desc)}</div>` : ''}</div></div>`).join('')}`,
  }),
  versus: (s) => ({
    theme: 'dk', area: 'center',
    body: `<div class="h" style="font-size:78px"><span class="s">${esc(s.title)}</span></div><div class="rule"></div>
<div class="cd"><div class="lb">${CROSS}${esc(s.bad.label)}</div><div class="tx">“${esc(s.bad.text)}”</div></div>
<div class="cd"><div class="lb">${OK}${esc(s.good.label)}</div><div class="tx">“${esc(s.good.text)}”</div></div>
${s.tip ? `<div class="cd hi"><div class="lb" style="color:#fff">${STAR}${esc(s.tip.label)}</div><div class="tx">“${esc(s.tip.text)}”</div></div>` : ''}
${s.why ? `<div class="note"><b>Por que funciona:</b> ${esc(s.why)}</div>` : ''}`,
  }),
  big: (s) => ({
    theme: 'dk', area: 'center',
    body: `<div class="big" style="font-size:${size(s.value.length, [[4, 330], [7, 250], [999, 190]])}px">${esc(s.value)}</div><div class="sub" style="font-size:42px;margin-top:40px;text-align:center;font-weight:500">${tx(s.label)}</div>`,
  }),
  checklist: (s) => ({
    theme: 'pp', area: 'center',
    body: `${s.kicker ? `<div class="kick">${esc(s.kicker)}</div>` : ''}<div class="h" style="font-size:${size(plain(s.title).length, [[40, 84], [70, 72], [999, 62]])}px;margin-bottom:38px">${tx(s.title)}</div>
${s.items.map((i) => `<div class="crow"><div class="chk">${CHECK('#0A0B0D')}</div><span>${esc(plain(i))}</span></div>`).join('')}
${s.footer ? `<div class="sub" style="font-size:34px;margin-top:30px">${tx(s.footer)}</div>` : ''}`,
  }),
  bridge: (s) => ({
    theme: 'pp', area: 'center',
    body: `<div class="kick">Como a ESM Web resolve</div>
<div class="h" style="font-size:${size(plain(s.title).length, [[40, 90], [70, 78], [999, 66]])}px">${tx(s.title)}</div>
${s.text ? `<div class="sub" style="font-size:34px;margin-top:34px">${tx(s.text)}</div>` : ''}
<div class="dcard"><div class="lb">Feito sob medida</div><div class="tx">Site, página ou sistema criado para o seu negócio</div></div>`,
  }),
  cta: (s, c) => {
    const key = parseEmphasis(s.title).find((p) => p.strong && plain(p.text).trim().length <= 14 && parseEmphasis(s.title).some((q) => !q.strong));
    return {
      theme: 'dk', area: 'center', save: true, hideNext: true,
      body: key
        ? `<div style="text-align:center"><div class="h" style="font-size:112px"><span class="s">Comente</span></div><div class="kw">${esc(plain(key.text).trim().toUpperCase())}</div>
<div class="sub" style="font-size:32px;text-align:center;max-width:820px;margin:0 auto 44px">${esc(plain(s.title).replace(new RegExp(plain(key.text).trim(), 'i'), '').replace(/^\s*comente?\s*/i, '').replace(/\s+/g, ' ').trim() || 'e receba o caminho no Direct')}</div>
<div class="btn">${esc(`Comente ${plain(key.text).trim().toUpperCase()} pra receber`)}${ARROW}</div></div>`
        : `<div style="text-align:center"><div class="h" style="font-size:${size(plain(s.title).length, [[34, 104], [70, 88], [999, 72]])}px">${tx(s.title)}</div>
<div class="btn" style="margin-top:50px">${esc(c.brand.site)}${ARROW}</div></div>`,
    };
  },
};

// Monta um slide completo (HTML). ctx: { brand, i, n, w, h, story, last }
export async function slideDoc(slide, ctx) {
  const { brand, w, h } = ctx;
  const K = KINDS[slide.kind];
  if (!K) throw new ProducerError(`Tipo de slide desconhecido: ${slide.kind}`);
  const r = K(slide, ctx);
  const logo = await logoUri(brand.logoPath);
  const pad = ctx.story ? { top: 290, bottom: 400 } : { top: 170, bottom: 200 };
  const colStyle = `top:${pad.top}px;bottom:${pad.bottom}px;justify-content:${r.area === 'bottom' ? 'flex-end' : 'center'}`;
  const dots = ctx.story ? '' : `<div class="dots">${Array.from({ length: ctx.n }, (_, k) => `<i class="${k === ctx.i ? 'on' : ''}"></i>`).join('')}</div>`;
  const pill = ctx.story ? '' : r.save || ctx.last ? `<div class="pl" style="display:flex;align-items:center;gap:12px">${SAVE}Salvar</div>` : r.hideNext ? '' : ctx.single ? '<div class="pl">Salva para depois</div>' : `<div class="pl" style="display:flex;align-items:center;gap:12px">Arrasta ${ARROW}</div>`;
  const top = ctx.story ? '' : `<div class="top"><img src="${logo}"><div class="cnt">${ctx.single ? esc(brand.handle) : `${String(ctx.i + 1).padStart(2, '0')} / ${String(ctx.n).padStart(2, '0')}`}</div></div>`;
  const ft = ctx.story ? '' : `<div class="ft"><div class="hd"><div class="av"><img src="${logo}"></div>${esc(brand.handle)}</div>${pill}</div>`;
  const hint = ctx.story && ctx.hint ? `<div class="hint" style="position:absolute;left:0;right:0;bottom:${ctx.h === 1920 ? 330 : 120}px">${esc(ctx.hint)}</div>` : '';
  const storyTop = ctx.story ? `<img src="${logo}" style="position:absolute;left:0;right:0;top:230px;margin:0 auto;width:130px;${r.theme === 'pp' ? 'filter:brightness(.18)' : ''}">` : '';
  const mark = r.mark ? `<img class="mark" src="${logo}" style="right:-150px;top:${ctx.story ? 380 : 150}px;width:${ctx.story ? 1000 : 820}px;opacity:.06">` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${await fontCss()}${CSS(w, h)}</style></head><body><div class="sl ${r.theme}">${mark}${top}${storyTop}<div class="col" style="${colStyle}"><div class="in">${r.body}</div></div>${ft}${dots}${hint}</div></body></html>`;
}

// Encolhe o conteúdo até caber entre o topo e o rodapé; se nem assim couber, falha em vez de entregar slide cortado.
async function fit(pg) {
  const ok = await pg.evaluate(() => {
    const col = document.querySelector('.col'); const inn = document.querySelector('.in');
    let z = 1; inn.style.zoom = z;
    while (inn.getBoundingClientRect().height > col.clientHeight && z > 0.55) { z -= 0.05; inn.style.zoom = z; }
    return inn.getBoundingClientRect().height <= col.clientHeight + 2;
  });
  if (!ok) throw new ProducerError('Um slide não cabe na imagem: texto longo demais');
}

// Renderiza uma lista de slides (JPEG). opts: { w, h, story, prefix }
export async function renderSlides(slides, brand, outDir, { w = 1080, h = 1350, story = false, prefix = 'slide', single = false } = {}) {
  const paths = [];
  await withBrowser(async (browser) => {
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const path = join(outDir, `${prefix}-${String(i + 1).padStart(2, '0')}.jpg`);
      const html = await slideDoc(s, { brand, i, n: slides.length, w, h, story, single, last: i === slides.length - 1 && !story, hint: s.hint });
      await shot(browser, html, { w, h, path, type: 'jpeg', prepare: fit });
      paths.push(path);
    }
  });
  return paths;
}
