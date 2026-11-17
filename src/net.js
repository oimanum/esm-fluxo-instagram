// fetch que tenta de novo quando a rede cai ("fetch failed"), com a causa e o endereço na mensagem de erro.
// Só repete falha de rede (a requisição nem chegou/voltou); respostas HTTP, boas ou ruins, voltam como estão.
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function resilientFetch(base = (...a) => fetch(...a), { tries = 4, sleep = defaultSleep, waits = [1500, 4000, 9000] } = {}) {
  return async (url, init) => {
    let last;
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        return await base(url, init);
      } catch (e) {
        last = e;
        if (attempt < tries - 1) await sleep(waits[attempt] ?? waits.at(-1));
      }
    }
    let host = String(url);
    try { host = new URL(url).host; } catch { /* mantém o texto */ }
    const why = last?.cause?.code || last?.cause?.message || last?.message || 'erro desconhecido';
    throw new Error(`Falha de rede ao acessar ${host} (${why}) depois de ${tries} tentativas`);
  };
}

export const netFetch = resilientFetch();
