// Laço da escuta do Telegram: repete a leitura dos toques até não haver mais nada pendente.
// Separado do cli para ser testado sem rede.
export async function listenLoop({ hasPending, pollOnce, refresh = async () => {}, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), maxMs = 5.7 * 3600 * 1000, maxErrors = 5, onError = () => {} }) {
  const started = now();
  let errors = 0;
  for (;;) {
    await refresh(); // outros workflows gravam o estado no git enquanto escutamos
    if (!(await hasPending())) return { swap: false, rearm: false, reason: 'nada_pendente' };
    try {
      const r = await pollOnce();
      errors = 0;
      if (r?.swaps > 0) return { swap: true, rearm: false, reason: 'troca_de_tema' };
    } catch (e) {
      errors += 1;
      onError(e);
      if (errors >= maxErrors) throw e;
      await sleep(15000);
    }
    if (now() - started > maxMs) return { swap: false, rearm: true, reason: 'limite_de_tempo' };
  }
}
