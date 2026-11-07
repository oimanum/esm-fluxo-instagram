import { join } from 'node:path';
import { ProducerError } from './tts.js';
import { loadBrand, esc, wrap, ffmpeg, textFile } from './ff.js';

export async function renderCarousel(post, outDir) {
  const brand = await loadBrand();
  const font = esc(brand.fontFile);
  const slides = [post.hook, ...post.script.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 6), post.cta];
  if (slides.length < 5 || slides.length > 8) throw new ProducerError(`Carrossel com ${slides.length} slides (esperado 5–8)`);
  const paths = [];
  for (let i = 0; i < slides.length; i++) {
    const f = await textFile(outDir, `s${i}.txt`, wrap(slides[i], i === 0 ? 16 : 20));
    const size = i === 0 ? 76 : 70;
    const name = `slide-${String(i + 1).padStart(2, '0')}.jpg`;
    const main = `drawtext=fontfile='${font}':textfile=${f}:fontsize=${size}:fontcolor=0x${brand.colors.text}:x=80:y=(h-text_h)/2:line_spacing=16:expansion=none`;
    const num = `drawtext=fontfile='${font}':text='${i + 1}/${slides.length}':fontsize=34:fontcolor=0x${brand.colors.muted}:x=80:y=h-110`;
    await ffmpeg([
      '-f', 'lavfi', '-i', `color=c=0x${brand.colors.bg}:s=1080x1350`, '-i', brand.logoPath,
      '-filter_complex', `[1:v]scale=110:-1[lg];[0:v][lg]overlay=W-w-60:60[bg];[bg]${main},${num}[v]`,
      '-map', '[v]', '-frames:v', '1', '-q:v', '2', name,
    ], outDir);
    paths.push(join(outDir, name));
  }
  return { paths };
}
