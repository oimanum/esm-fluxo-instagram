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

## 5. Renovação automática do token
1. No GitHub: *Settings → Developer settings → Fine-grained tokens*. Crie um token só para este repositório com a permissão **Secrets: Read and write**.
2. Secret `GH_ADMIN_TOKEN`. O workflow `refresh-token` usa esse token para gravar o novo `IG_TOKEN` a cada ~15 dias.

## 6. Seu perfil e referências
1. Edite `src/config.js` → `competitors` com 3 a 5 @ de perfis de referência (contas Profissionais públicas).
2. Edite `brand/brand.json` → `handle` com o seu @.

## 7. Testes, nesta ordem
1. Localmente, só a prévia: defina `GEMINI_KEY`, `TG_TOKEN`, `TG_CHAT_ID` no terminal e rode `node src/cli.js generate`. A prévia chega ao Telegram. Toque **Pular**.
2. No GitHub: *Actions → generate → Run workflow*. Confirme que a prévia chega.
3. **Primeiro post real:** na prévia, toque **Aprovar**. O workflow `approval-poll` roda a cada 10 minutos (ou rode na mão) e publica. Confira no perfil. Se a Meta não aceitar a URL do GitHub Releases como mídia, o Telegram avisa o erro e nada é postado; me mande a mensagem.
4. Só depois do passo 3 funcionar, deixe os agendamentos rodando. Eles já vêm ativos no repositório.

## Rotina diária
- 06:00 o sistema gera a prévia. Você aprova, troca o tema ou pula, até as 11:00. Sem resposta, nada é postado.
- Domingo à noite chega o relatório semanal e o plano da semana é ajustado.
