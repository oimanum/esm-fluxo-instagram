# Instagram automático ESM Web — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipeline diário que pesquisa tendências, gera Reel/carrossel, envia prévia ao Telegram e publica no Instagram só após aprovação, a custo R$ 0.

**Architecture:** Repositório Node.js (ESM, Node 20) com módulos pequenos em `src/`, estado em `data/*.json` versionado e um workflow do GitHub Actions por etapa (`generate`, `approval-poll`, `publish`, `analytics`, `refresh-token`). Cada módulo recebe e devolve objetos simples; HTTP e LLM são injetados para permitir testes sem rede.

**Tech Stack:** Node 20, `node:test`, Gemini API (free tier), Telegram Bot API, Instagram Graph API, HyperFrames + ffmpeg, edge-tts, GitHub Actions/Releases.

**Spec:** `docs/superpowers/specs/2026-11-06-instagram-automatico-design.md`

## Global Constraints
- Custo mensal R$ 0; nenhuma dependência paga.
- Nunca publicar sem aprovação explícita; sem resposta até 11:00 (America/Sao_Paulo) o item é descartado como `sem_resposta`.
- Linha de base: 4 Reels + 2 carrosséis por semana, máx. 1 post/dia; ajuste semanal de no máx. ±1 post por formato.
- Tema: nota mínima 6/10; não repetir tema dos últimos 30 dias.
- Reel de 20–35 s, gancho nos 3 primeiros segundos, 1 CTA, legenda embutida, pt-BR.
- Segredos só em GitHub Secrets (`IG_TOKEN`, `IG_USER_ID`, `TG_TOKEN`, `TG_CHAT_ID`, `GEMINI_KEY`); nunca em código ou logs.
- Token longo de 60 dias renovado a cada 30; alerta se faltar <7 dias.
- Publicação: até 3 tentativas; falha em qualquer etapa avisa no Telegram e não posta.
- Fora de escopo: compra de seguidores, bots de curtida/follow, comentários e DMs automáticos.

## Review Focus
- Resposta de aprovação chegando duplicada ou depois do limite 11:00: não deve publicar duas vezes nem após o prazo.
- Gemini devolvendo JSON inválido ou vazio: deve tentar de novo e depois avisar, sem quebrar o dia.
- Token expirado ou revogado: deve alertar no Telegram, não falhar em silêncio.
- Tema com alegação enganosa (ganho garantido, promessa médica/jurídica): deve ser barrado na checagem.
- Dia sem tendência com nota ≥ 6: deve pular o dia e avisar, não postar tema fraco.

---

### Task 1: Esqueleto, config e estado
**Files:** Create `package.json`, `src/config.js`, `src/state.js`, `data/{history,queue,metrics}.json`, `tests/state.test.js`
**Interfaces:**
- Produces: `loadState(name: 'history'|'queue'|'metrics'): Promise<object[]>`, `saveState(name, rows): Promise<void>`, `config: {tz:'America/Sao_Paulo', minScore:6, noRepeatDays:30, approvalDeadline:'11:00', baseline:{reel:4, carousel:2}}`, `requireEnv(keys: string[]): Record<string,string>` (lança erro listando as chaves ausentes, sem imprimir valores).
- [ ] Teste `saveState then loadState roundtrips` e `requireEnv throws naming missing keys but not values`.
- [ ] Rodar `node --test tests/state.test.js` → FAIL; implementar; → PASS.
- [ ] Commit.

### Task 2: Cliente LLM com JSON validado
**Files:** Create `src/llm.js`, `tests/llm.test.js`
**Interfaces:**
- Produces: `askJson({prompt, schema, fetchImpl, retries=2}): Promise<object>` chama Gemini (modelo flash grátis), valida contra `schema` (função `(obj)=>boolean`), repete até `retries` vezes, depois lança `LlmError`.
- [ ] Testes: `returns parsed object when valid`, `retries on invalid JSON then succeeds`, `throws LlmError after retries exhausted`, `429 rate limit throws LlmError with code 'rate_limit'`.
- [ ] Rodar FAIL → implementar → PASS → commit.

### Task 3: Pesquisa de tendências
**Files:** Create `src/research/{google-trends,news,reddit,youtube,competitors}.js`, `src/research/index.js`, `tests/research.test.js`
**Interfaces:**
- Produces: `collectSignals({fetchImpl, competitors: string[]}): Promise<Signal[]>` onde `Signal = {source, title, url, strength: number 0–1}`; cada fonte falha isolada (devolve `[]` e registra aviso), nunca derruba a coleta.
- `competitors.js` usa Business Discovery (`business_discovery.username(<@>){media{like_count,comments_count,caption,timestamp}}`) e converte em sinais por engajamento relativo.
- [ ] Testes com respostas gravadas: `each source maps fixtures to Signal`, `one failing source does not fail collectSignals`.
- [ ] FAIL → implementar → PASS → commit.

### Task 4: Estratégia (pontuação, anti-repetição, formato)
**Files:** Create `src/strategy.js`, `tests/strategy.test.js`
**Interfaces:**
- Consumes: `askJson`, `collectSignals`, `loadState`, `config`.
- Produces: `scoreTopics(signals, llm): Promise<{topic, score, angle}[]>` (rubrica: força × aderência ao nicho × potencial de cliente, 0–10); `pickToday({scored, history, now, plan}): {topic, format:'reel'|'carousel', skip?:string}` — descarta nota <6 e tema repetido <30 dias; retorna `skip:'sem_tema'` se nada sobrar; respeita máx. 1 post/dia, folga no dia sem slot e a cota semanal de `plan`.
- [ ] Testes: `drops topics below 6`, `drops topic used within 30 days`, `returns skip sem_tema when none qualify`, `never schedules two posts in one day`, `weekly plan caps reels at 4`.
- [ ] FAIL → implementar → PASS → commit.

### Task 5: Redator e checagem de segurança
**Files:** Create `src/writer.js`, `src/safety.js`, `brand/voice.md`, `tests/writer.test.js`, `tests/safety.test.js`
**Interfaces:**
- Produces: `writePost({topic, format, llm}): Promise<{hook, script, caption, hashtags: string[], cta}>` (prompt embute regras de copy sem vícios de IA e o `brand/voice.md`); `checkPost(post, format): {ok: boolean, problems: string[]}` valida: gancho presente e ≤ 12 palavras, roteiro dentro de 20–35 s (≈ 55–95 palavras faladas), exatamente 1 CTA, e **barra** padrões enganosos (`/garant(e|ido)/` com ganho/resultado, "100% de", "cura", "ganhe a causa", "sem risco") .
- [ ] Testes: `rejects guaranteed-income claim`, `rejects medical cure claim`, `rejects script outside 20–35s`, `rejects two CTAs`, `accepts a clean post`, `writePost retries when hook missing`.
- [ ] FAIL → implementar → PASS → commit.

### Task 6: Produtor de Reel e carrossel
**Files:** Create `src/producer/{reel,carousel,tts}.js`, `brand/brand.json`, `compositions/reel.html`, `tests/producer.test.js`
**Interfaces:**
- Consumes: `post` de `writePost`, `brand/brand.json` (`{colors, fonts, logo}`, preenchido a partir da pasta Identidade Visual do usuário).
- Produces: `renderReel(post, outDir): Promise<{path:string, durationSec:number}>` (edge-tts pt-BR → áudio; HyperFrames renderiza texto animado + legenda embutida; ffmpeg junta; saída 1080×1920 mp4); `renderCarousel(post, outDir): Promise<{paths:string[]}>` (5–8 PNGs 1080×1350).
- [ ] Testes (com ffprobe): `reel is 1080x1920 and 20–35 s`, `carousel has 5–8 pngs at 1080x1350`, `tts failure throws ProducerError`.
- [ ] FAIL → implementar → PASS → commit.

### Task 7: Aprovação pelo Telegram
**Files:** Create `src/approval.js`, `tests/approval.test.js`
**Interfaces:**
- Produces: `sendPreview(item, tg): Promise<{messageId}>` (mídia + legenda + botões `approve|swap|skip` com callback_data `<itemId>:<ação>`); `pollDecisions({tg, queue, now}): Promise<Decision[]>` que lê `getUpdates` com offset salvo; **idempotente por `itemId`** (segunda resposta para o mesmo item é ignorada); resposta após 11:00 vira `expired` e não aprova; `swap` marca o item para regeneração com o 2º tema.
- [ ] Testes: `duplicate approve is applied once`, `approve after 11:00 is expired`, `swap requests second topic`, `skip marks item skipped`.
- [ ] FAIL → implementar → PASS → commit.

### Task 8: Publicador, hospedagem e token
**Files:** Create `src/publisher.js`, `src/media-host.js`, `src/token.js`, `tests/publisher.test.js`, `tests/token.test.js`
**Interfaces:**
- Produces: `uploadMedia(paths, {repo, gh}): Promise<string[]>` (GitHub Release, devolve URLs públicas); `publish(item, urls, ig): Promise<{igMediaId}>` cria container (REELS ou carrossel), aguarda `status_code=FINISHED`, chama `media_publish`, 3 tentativas com intervalo; **recusa publicar item cujo `status !== 'approved'`**; `refreshToken(ig): Promise<{token, expiresAt}>` e `tokenDaysLeft(expiresAt, now): number`.
- [ ] Testes: `refuses to publish unapproved item`, `retries 3 times then throws`, `waits for FINISHED before media_publish`, `tokenDaysLeft < 7 triggers alert flag`.
- [ ] FAIL → implementar → PASS → commit.

### Task 9: Analytics e ajuste semanal
**Files:** Create `src/analytics.js`, `tests/analytics.test.js`
**Interfaces:**
- Produces: `collectInsights(history, ig, now): Promise<Metric[]>` (24 h e 7 d: alcance, salvamentos, compartilhamentos, visitas ao perfil, cliques no link); `adjustPlan(plan, metrics): plan` move no máx. ±1 post/semana por formato e sugere horário de melhor desempenho; `weeklyReport(metrics): string` para o Telegram.
- [ ] Testes: `adjustPlan never changes a format by more than 1`, `adjustPlan keeps total ≤ 7 per week`, `weeklyReport ranks by profile visits and link clicks`.
- [ ] FAIL → implementar → PASS → commit.

### Task 10: Orquestração, workflows e modo dry-run
**Files:** Create `src/cli.js`, `.github/workflows/{generate,approval-poll,publish,analytics,refresh-token}.yml`, `tests/pipeline.test.js`
**Interfaces:**
- Produces: `node src/cli.js generate|poll|publish|analytics|refresh [--dry]`. `generate` roda research→strategy→writer→safety→producer→preview; qualquer exceção envia aviso ao Telegram e encerra sem postar. `--dry` faz tudo menos `publish`/`uploadMedia`.
- Cron (UTC, equivalente a 06:00 BRT geração; poll a cada 10 min das 07:00 às 11:00; publish disparado pelo poll após `approved`).
- [ ] Testes de pipeline com dependências falsas: `dry run never calls publish`, `any step error sends Telegram alert and posts nothing`, `no qualifying topic skips day with alert`, `unapproved by 11:00 ends as sem_resposta`.
- [ ] FAIL → implementar → PASS → commit.

### Task 11: Configuração guiada e primeiro post real
**Files:** Create `SETUP.md`
- [ ] `SETUP.md` com os passos da seção 9 da spec (Página do Facebook ↔ Instagram, app Meta em modo desenvolvimento, token, bot do Telegram, chave do AI Studio, Secrets). O usuário gera e cola as chaves.
- [ ] Rodar `node src/cli.js generate --dry` com chaves reais e conferir a prévia no Telegram.
- [ ] Um post real de teste aprovado pelo usuário; confirmar no perfil. Só então ativar os crons.

## Autoconferência
- Cobertura da spec: módulos (T3–T9), fluxo diário e limite 11:00 (T7, T10), frequência e ajuste (T4, T9), checagem (T5), erros (T8, T10), testes e dry-run (T10), configuração (T11).
- Pendência fora do código: @ do perfil e 3–5 concorrentes entram em `config` na Task 3/11.
