# Instagram automático ESM Web — Especificação

Data: 2026-11-06 · Custo alvo: R$ 0/mês

## 1. Objetivo
Gerar e publicar conteúdo no Instagram da ESM Web (sites e landing pages para clínicas, advogados, estética, energia solar) para atrair seguidores e **clientes**. O usuário só aprova uma vez por dia; aprovado, o sistema posta sozinho.

## 2. Premissas e decisões já tomadas
- Conta Instagram Profissional, ainda **sem** Página do Facebook (guia de ligação incluso, ver 9).
- Vídeos 100% automáticos, sem o usuário aparecer: motion graphics, texto animado, locução de IA em pt-BR, legenda embutida.
- Roda na nuvem grátis (GitHub Actions), com o PC desligado.
- Aprovação por bot do Telegram (botões Aprovar / Trocar tema / Pular).
- LLM: Gemini API no plano grátis (a assinatura Gemini do usuário não dá cota de API).
- Sem resposta de aprovação até o horário-limite: **não posta nada**.
- Fora de escopo: compra de seguidores, bots de curtida/follow, comentários automáticos, DMs automáticos. Viralização não é garantida; o sistema aumenta a chance por teste e ajuste semanal.

## 3. Arquitetura (módulos isolados)
Repositório único, Node.js + um workflow do GitHub Actions por etapa.

| Módulo | Função | Depende de |
|---|---|---|
| `research` | Coleta tendências e pontua temas | Google Trends, RSS de notícias, Reddit, YouTube, Business Discovery (Meta) |
| `strategy` | Escolhe tema, formato e horário do dia usando `analytics` | research, analytics, LLM |
| `writer` | Gancho, roteiro, legenda, hashtags, CTA | LLM, guia de voz da marca |
| `producer` | Renderiza Reel (HyperFrames + ffmpeg + edge-tts) ou carrossel (PNGs) | writer, identidade visual |
| `approval` | Envia prévia ao Telegram e recebe o clique | Telegram Bot API |
| `publisher` | Publica via Instagram Graph API, renova token | approval, hospedagem de mídia |
| `analytics` | Lê Insights após 24h e 7d, grava histórico | Graph API |
| `state` | `data/*.json` versionado: fila, histórico, métricas, temas já usados | — |

## 4. Fluxo diário
1. **06:00** `research` + `strategy` + `writer` + `producer` geram 1 conteúdo (ou 2 se o dia for de carrossel + story).
2. **07:00** `approval` envia a prévia (vídeo/imagens + legenda + horário sugerido) ao Telegram.
3. Usuário toca **Aprovar**, **Trocar tema** (regenera com o 2º melhor tema) ou **Pular**.
4. `publisher` agenda para o horário ótimo do dia; se aprovado após o horário, posta em até 15 min.
5. **Limite 11:00**: sem aprovação, o item é descartado e registrado como "sem resposta".
6. `analytics` coleta métricas depois.

## 5. Pesquisa de tendências
- Instagram não tem API de trending. Sinais usados: Google Trends BR, Google News RSS, Reddit, YouTube (busca/mais vistos), e posts de maior engajamento de 3 a 5 concorrentes via Business Discovery.
- Pontuação do tema = (força da tendência) × (aderência ao nicho) × (potencial de gerar cliente), nota 0–10 pelo LLM com rubrica fixa. Mínimo 6 para publicar.
- Aderência: dor do dono de negócio local (agendamento, anúncios, site lento, Google Meu Negócio, WhatsApp, IA no atendimento, concorrência).
- Não repete tema usado nos últimos 30 dias.

## 6. Frequência
- Linha de base (semana 1–4): 4 Reels + 2 carrosséis por semana, 1 post/dia no máximo, folga 1 dia.
- Toda semana `analytics` compara formato, tema e horário por alcance, salvamentos, compartilhamentos e cliques no perfil; `strategy` desloca a mistura e os horários para o que performou melhor (mudança máxima de ±1 post/semana por formato, para não oscilar).
- Métrica-chave de "cliente": cliques no link, visitas ao perfil e DMs recebidas; alcance e seguidores são secundários.

## 7. Produção de conteúdo
- Gancho obrigatório nos 3 primeiros segundos; Reel de 20–35 s; legenda embutida; CTA único (ex.: "chame no WhatsApp").
- Texto pt-BR direto, sem vícios de IA (regras da skill copy-sem-cara-de-ia embutidas no prompt).
- Checagem automática antes da aprovação: duração, legibilidade, ausência de promessa enganosa (ex.: ganhos garantidos), sem alegações médicas/jurídicas, tema não repetido.
- Identidade visual lida de um arquivo `brand.json` (cores, fontes, logo) preenchido a partir da pasta Identidade Visual do usuário.

## 8. Publicação e hospedagem de mídia
- Graph API: criar container → aguardar processamento → `media_publish`.
- Mídia hospedada em GitHub Releases do próprio repositório (URL pública exigida pela Meta).
- Token longo (60 dias) renovado automaticamente a cada 30 dias; segredos só em GitHub Secrets.
- Repositório público (Actions ilimitado) com segredos fora do código; alternativa privada cabe em 2.000 min/mês.

## 9. Configuração única (guiada)
1. Criar/ter Página do Facebook e ligar ao Instagram Profissional.
2. Criar app em Meta for Developers (modo desenvolvimento, sem revisão) e gerar token com `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `instagram_manage_insights`.
3. Criar bot no Telegram (@BotFather) e pegar o chat id.
4. Gerar chave grátis no Google AI Studio.
5. Cadastrar tudo em GitHub Secrets. O assistente nunca digita senhas; o usuário gera e cola as chaves.

## 10. Tratamento de erros
- Falha em qualquer etapa: mensagem no Telegram com o motivo; nada é postado.
- Limite de API do Gemini: fallback para segundo tema/prompts menores; se persistir, avisa e pula o dia.
- Falha de publicação: até 3 tentativas com intervalo; depois avisa.
- Token expirando em <7 dias: alerta.
- Meta limita 100 publicações/24h; o uso previsto é <2.

## 11. Testes
- Unitários: pontuação de tema, anti-repetição, regras da checagem.
- Dry-run: pipeline completo gera prévia no Telegram sem publicar (`--dry`).
- Teste real único de publicação com um post de teste aprovado pelo usuário antes de ligar o agendamento.

## 12. Critérios de sucesso
- Usuário gasta ≤ 1 minuto/dia só aprovando.
- Custo mensal R$ 0.
- Publicação nunca ocorre sem aprovação explícita.
- Em 8 semanas, relatório semanal mostra tendência de alta em visitas ao perfil e cliques; meta de seguidores só definida após 4 semanas de dados reais.

## 13. Pendências do usuário
- @ do perfil e 3–5 perfis de referência/concorrentes.
- Passos de configuração da seção 9.
- Aprovar esta especificação.
