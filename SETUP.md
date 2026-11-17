# Configuração única (≈ 30 minutos)

Você gera e cola as chaves. Nenhuma senha de Instagram, Google ou GitHub é digitada por ninguém além de você.
Os nomes dos botões nos painéis da Meta mudam com frequência. Se algum passo não bater com a tela, tire um print e peça ajuda.

## 1. Repositório no GitHub
1. Crie um repositório **público** (Actions é ilimitado em público) chamado `esm-fluxo-instagram` e envie este projeto.
2. Segredos ficam em *Settings → Secrets and variables → Actions*. Nada sensível vai no código.

## 2. Instagram (API com login do Instagram, não exige Página do Facebook)
1. A conta precisa ser **Profissional** (Business ou Creator).
2. Em developers.facebook.com, crie um app do tipo **Empresa** e adicione o produto **Instagram**, na opção "API com login do Instagram".
3. Adicione sua conta do Instagram ao app (função de testador do Instagram) e aceite o convite no app do Instagram, em *Configurações → Apps e sites*.
4. No painel do produto, gere o **token de acesso** da sua conta e copie o **ID da conta do Instagram**.
5. Secrets: `IG_TOKEN` (o token) e `IG_USER_ID` (o ID).
6. Modo desenvolvimento basta para postar na própria conta; não precisa de revisão de app.

## 3. Telegram (aprovação)
1. No Telegram, fale com **@BotFather**, envie `/newbot` e copie o token → Secret `TG_TOKEN`.
2. Mande qualquer mensagem para o seu bot novo.
3. Abra `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador e copie o número em `chat → id` → Secret `TG_CHAT_ID`.

## 4. Gemini (roteiros)
1. Em aistudio.google.com/apikey, crie uma chave (grátis, sem cartão) → Secret `GEMINI_KEY`.
2. O Google aposenta modelos de tempos em tempos (o gemini-2.0-flash saiu em 01/06/2026). O sistema tenta, em ordem, gemini-3.6-flash, 3.8-flash, 3.5-flash-lite e 3.1-flash-lite. Se todos derem 404, crie a variável (não Secret) `GEMINI_MODEL` em *Settings → Secrets and variables → Actions → Variables* com um modelo gratuito atual.

## 5. Renovação automática do token
1. No GitHub: *Settings → Developer settings → Fine-grained tokens*. Crie um token só para este repositório com a permissão **Secrets: Read and write**.
2. Secret `GH_ADMIN_TOKEN`. O workflow `refresh-token` usa esse token para gravar o novo `IG_TOKEN` a cada ~15 dias.
3. **Escolha a validade máxima (1 ano) e anote a data para renovar.** Se esse token expirar, a renovação do Instagram falha e o Telegram avisa.

## 6. Seu perfil e referências
1. Edite `src/config.js` → `competitors` com 3 a 5 @ de perfis de referência (contas Profissionais públicas).
2. O @ (`@esm_web`) e a etiqueta padrão já estão em `brand/brand.json`. O visual (Poppins, degradê, curva de luz) vem de `src/producer/html.js`.

## 6b. Fatos reais e Destaques
1. Abra `brand/facts.json` e preencha só com o que é verdade e você pode provar: `cases` (resultados de clientes), `stats` (dados com fonte), `process` (etapas do seu processo) e `about` (quem você é). O sistema só cita números e resultados que estiverem ali; sem fatos, os posts falam da dor do cliente.
2. Rode `npm run destaques`. As capas ficam em `destaques/`. As telas de Story (Resultados, Como funciona, Quem sou) saem do que você preencheu. O Instagram não permite criar Destaques por programa: suba as imagens como Story e salve em Destaques pelo app.

## 6c. Funil do Direct (palavra SITE) — vem DESLIGADO
Quem comenta **SITE** num post recebe uma resposta privada no Direct. Para ligar, nesta ordem:
1. Leia a mensagem em `src/config.js` → `funnel.dm` e ajuste o texto e o link (`funnel.link`, hoje o site da bio). Ela é enviada em seu nome, então só ligue quando estiver do seu jeito.
2. No painel da Meta (passo 2), gere o token de novo marcando também `instagram_business_manage_comments` e `instagram_business_manage_messages`, e atualize o Secret `IG_TOKEN`.
3. Troque `enabled: false` por `enabled: true` em `funnel`. Só depois disso os posts passam a terminar com "Comente SITE" (antes, o CTA é "chame no WhatsApp").
4. Regras da Meta: uma resposta privada por comentário, em até 7 dias, só para quem comentou. O sistema confere a cada 10 minutos, então a mensagem chega em 10 a 30 minutos. Não foi testado com uma conta real.
5. Quem responder à mensagem cai no seu Direct: o atendimento dali em diante é seu.

## 7. Testes, nesta ordem
1. Localmente, só a prévia de teste: defina `GEMINI_KEY`, `TG_TOKEN`, `TG_CHAT_ID` no terminal e rode `node src/cli.js generate --dry`. A prévia chega ao Telegram marcada **TESTE**, sem botões, e não pode ser publicada.
2. No GitHub: *Actions → generate → Run workflow* (por padrão roda como teste). Confirme que a prévia TESTE chega.
3. **Primeiro post real:** rode *Actions → generate* de novo desmarcando a opção "Prévia de TESTE". A prévia chega com os botões; toque **Aprovar**. O `approval-poll` roda a cada 10 minutos (ou rode na mão) e publica. Confira no perfil.
   - Se a Meta não aceitar a URL do GitHub Releases como mídia, o Telegram avisa o erro e nada é postado; me mande a mensagem.
   - Se o aviso for de métrica ou de concorrentes (Business Discovery), o resto continua funcionando.
4. Só depois do passo 3 funcionar, deixe os agendamentos rodando. Eles já vêm ativos no repositório.

## Rotina diária
- ~06:00 o sistema gera a prévia. Você aprova, troca o tema ou pula até as 11:00 (há 20 minutos de tolerância por causa de atrasos do GitHub; aprove até 10:45 para ter certeza). Sem resposta, nada é postado.
- Se algum passo falhar, você recebe o motivo no Telegram e nada é publicado.
- Domingo à noite chega o relatório semanal e o plano da semana é ajustado.

## 8. Colocar para rodar (o que falta, nesta ordem)
O que já está pronto: `GEMINI_KEY`, `TG_TOKEN`, `TG_CHAT_ID`, o repositório e os agendamentos. Faltam `IG_TOKEN` e `IG_USER_ID`.

Apps novos da Meta usam o **Unified login** (o "Instagram login" não está mais disponível para apps novos). O token vem de um **usuário do sistema** e **não expira**, então não existe renovação nem `GH_ADMIN_TOKEN`.

1. **App** (feito): "ESM Posts", tipo Business, produto Instagram, modo Development. Em *Instagram → API setup with Unified login* a Meta pede um **portfólio empresarial** ligado ao app (grátis).
2. **Business Settings** (business.facebook.com/settings, no portfólio ESM Web):
   - *Contas → Contas do Instagram → Adicionar*: entre com o login da @esm_web.
   - *Usuários → Usuários do sistema → Adicionar*: nome `esm-bot`, função **Admin**.
   - No usuário do sistema, *Adicionar ativos*: o **app** ESM Posts (controle total) e a **conta do Instagram** @esm_web (controle total).
   - *Gerar novo token*: app ESM Posts, validade **Nunca**, permissões `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_manage_comments`, `instagram_manage_messages`. Copie o token.
3. O **ID da conta do Instagram** aparece em *Contas → Contas do Instagram → @esm_web*.
4. No GitHub (*Settings → Secrets and variables → Actions*): `IG_TOKEN` = o token, `IG_USER_ID` = o ID. Não cole o token em nenhum chat.
5. Rode **Actions → check**. O Telegram mostra ✅ ou ❌ para cada chave, sem publicar nada.
6. **Primeiro post de verdade:** *Actions → generate*, **desmarcando** "Prévia de TESTE". Aprove no Telegram e confira o perfil (post e stories).
7. Pronto: a partir do dia seguinte o sistema gera tudo às ~06:00 e você só aprova até 20:45.

**O repositório precisa ficar PÚBLICO.** O Instagram baixa as imagens e o vídeo de endereços do GitHub; em repositório privado esse endereço pede login e a Meta recusa a mídia ("Only photo or video can be accepted"). Nada sensível fica no código (as chaves ficam só em Secrets).

**Teste sem publicar:** *Actions → test-media* cria o post, o story e o Reel de teste no Instagram só até a etapa de processamento (a que baixa o arquivo) e para antes de publicar; o resultado chega no Telegram. Serve para provar que a Meta aceita tudo a qualquer hora, sem aparecer no perfil.

Enquanto o passo 4 não estiver feito, o sistema gera e envia a prévia normalmente (com um aviso), mas aprovar não publica, e o `approval-poll` sai sem erro.

Se um dia a Meta liberar o Instagram Login para o app, defina a variável `IG_GRAPH_BASE=https://graph.instagram.com/v27.0` e cadastre também o `GH_ADMIN_TOKEN` (renovação a cada 60 dias).

### O que o sistema gera por semana
2 Reels, 4 carrosséis (com checklist), 1 post de imagem única e **stories todos os dias** (3 a 4 quadros, aprovados junto com o post). O Reel muda de estilo a cada dia; para fixar um, crie a variável `MOTION_STYLE` (`ember`, `editorial`, `gradient` ou `selection`). No domingo, a análise da semana pode ajustar a mistura entre Reels e carrosséis.

### Depois do primeiro post
- **Funil do Direct (comentar SITE):** o envio de mensagens pelo Unified login ainda precisa ser confirmado com a sua conta; depois do primeiro post, me peça para ligar e testar.
- Se a Meta recusar a URL do GitHub Releases como mídia, o Telegram avisa o erro: me mande a mensagem.
