// Teste de mídia: prova que o Instagram aceita as imagens e o vídeo vindos do GitHub e que o token tem permissão
// de publicar, SEM publicar nada. Cria os "containers" de mídia (a etapa que baixa e processa o arquivo) e para
// antes do media_publish; containers não publicados expiram sozinhos em 24 h e não aparecem no perfil.
import { waitFinished } from './publisher.js';

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// files: { image, story, video } = caminhos locais. stage/release/cleanup: hospedagem temporária das mídias.
export async function testMedia({ ig, files, stage, release, cleanup, sleep = defaultSleep, maxPolls = 40 }) {
  const u = ig.userId || 'me';
  const results = [];
  let staged;
  try {
    staged = await stage([files.image, files.story, files.video]);
    const [imageUrl, storyUrl, videoUrl] = await release(staged);
    const cases = [
      ['Post de imagem (JPEG)', { image_url: imageUrl }],
      ['Story (JPEG)', { media_type: 'STORIES', image_url: storyUrl }],
      ['Reel (vídeo MP4)', { media_type: 'REELS', video_url: videoUrl }],
    ];
    for (const [name, params] of cases) {
      try {
        const { id } = await ig.post(`/${u}/media`, params);
        await waitFinished(ig, id, sleep, maxPolls);
        results.push({ name, ok: true, detail: 'o Instagram baixou e processou o arquivo' });
      } catch (e) {
        results.push({ name, ok: false, detail: e.message });
      }
    }
  } catch (e) {
    results.push({ name: 'Hospedagem temporária no GitHub', ok: false, detail: e.message });
  } finally {
    if (staged && cleanup) { try { await cleanup(staged); } catch { /* o release de teste pode ficar; é inofensivo */ } }
  }
  return results;
}

export function formatMedia(results) {
  const ok = results.length > 0 && results.every((r) => r.ok);
  const lines = results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.detail}`);
  return `Teste de mídia (nada foi publicado)\n\n${lines.join('\n')}\n\n${ok ? 'O Instagram aceita o que o sistema envia. Pode rodar o primeiro post de verdade na hora que preferir.' : 'Há itens com ❌: me mande esta mensagem para eu corrigir antes do primeiro post.'}`;
}
