# SPDD Analysis: a página /excluir-conta chama a API de exclusão (STORY-001-001)

> Requisito: `requirements/[User-story-01]excluir-conta-pela-api.md` · Semente: `requirements/idea-of-the-enhancement-01-excluir-conta-pela-api.md` · Confiança: **[m]** medido · **[d]** documentado · **[i]** inferido.

## Requisito original

"a página `/excluir-conta` passa a chamar a API de exclusão de conta (REQ-056)". Preservar as 4 opções: só "Excluir minha conta" chama a API (`kind: "ACCOUNT"`); as outras 3 seguem pelo pedido por e-mail, porque a API ainda devolve 422 para elas (dizer isso na página sem prometer o que não existe). Boas práticas: resposta sempre neutra ao pedir o código; prazo exibido vem de `graceDays`; tratar 429 com espera; sem PII em URL/query/console; o fallback por e-mail continua quando a API falha/sem rede; `EXCLUSAO_API` configurável num ponto só; respeitar o consentimento/GTM; não quebrar o build/deploy.

## Diagnóstico verificado

- **[m]** `lp/excluir-conta.html:213` — `var EXCLUSAO_API = ''`; vazio faz o submit ir direto a `email-manual` (`:306`).
- **[m]** `:203-212` — o contrato imaginado (`/pedido`, `/confirmar`, `tipo`, `dados`, `temEmpresa`) não é o publicado. Com `ValidationPipe({ forbidNonWhitelisted: true })` (`app-backend/src/configure-app.ts:62-66`), mandar `tipo`/`dados` daria `400`.
- **[m]** `:225-229` — o recebido de "conta" promete "o link para baixar seus documentos chega no seu e-mail" com `temEmpresa`; o contrato diz que o link ainda não existe (DP-5612) e manda não mostrá-lo.
- **[m]** `:142` — o "desfazer" usa `PRAZOS.desistirDias` fixo; o contrato manda usar `graceDays` da resposta.
- **[m]** `:318-321` — qualquer erro da confirmação vira "Código incorreto ou vencido."; não há reenvio nem tratamento de `429`.
- **[m]** `lp/excluir-conta.html` não está em `COPIAR` de `lp/build-lp.mjs:55-56`: é editado direto e vai ao ar como está (comentários inclusive). O build só apaga o que copia (`:233`), então um `lp/excluir-conta.js` novo não é sobrescrito. **[m]** `lp/vercel.json` não precisa mudar (`.html` já sem cache; `.js` fica no padrão da Vercel).
- **[m]** O consentimento e o GTM ficam no `<head>` (`:7-22`) e a página não empurra nada ao `dataLayer`; nada a mudar.

### API (REQ-056)

- **[m]** `app-backend/src/modules/account-deletion/presentation/account-deletion.controller.ts` — `POST account-deletion/code` (`202`, throttle por IP e por e-mail) e `POST account-deletion` (`200`, `channel: 'WEB'`).
- **[m]** `dto/account-deletion.dto.ts` — `{email (IsEmail, ≤320, trim), kind?}` e `{email, code (6 dígitos), kind?}`; resposta `{status, requestedAt, purgeAt, graceDays, hasCompany}`; kinds `ACCOUNT | SOME_DATA | THIRD_PARTY | WAITLIST`, só `ACCOUNT` atendido.
- **[d]** `contrato-integracao.md` §EXC — `202` com corpo idêntico em todo caso; erros `400 VALIDATION_ERROR`, `422 VERIFICATION_CODE_INVALID|EXPIRED|DELETION_KIND_NOT_SUPPORTED`, `403 ACCOUNT_DELETION_PENDING` (rotas com sessão), `429 RATE_LIMIT_EXCEEDED` + `Retry-After`. Envelope de erro `{ "code": … }`.
- **[d]** A rota pública é idempotente: confirmar de novo devolve o mesmo pedido.

### CORS — bloqueante

- **[m]** `configure-app.ts:123-134` — `enableCors` com allowlist de `CORS_ALLOWED_ORIGINS`; vazio = nenhuma origem; cabeçalhos `Content-Type`, `Authorization` e o do funil.
- **[m]** Lambda `legalizai-backend-dev` (lido em 26/10, 15:10, só essa variável): `CORS_ALLOWED_ORIGINS=https://crm.legalizai.com.br`; Function URL sem CORS próprio. **A origem `https://www.legalizai.com.br` não está liberada.** O `POST` JSON exige preflight; sem `Access-Control-Allow-Origin`, o navegador barra o preflight, o `POST` não sai (nenhum e-mail enviado) e o `fetch` rejeita → cai no e-mail. Pendência de infra, fora deste repo.

### Protótipo

- **[m]** `prototipo/app/src/components/conta/excluir-conta.tsx:229-296` (`EXC3`) — "Não chegou? Confere o spam ou pede um novo em {s}s." / "Reenviar código" depois de 60 s; erro "Código incorreto."; botão "Excluir minha conta".
- **[m]** `:300-321` (`EXC4`) — "Sua conta foi desativada agora. A exclusão termina em {N} dias."; "Enviamos a confirmação para {e-mail mascarado}" (+ link, que não existe); "Mudou de ideia? Entre de novo com seu e-mail e senha em até {N} dias e tudo volta como estava."
- **[m]** O `EXC3` do app diz "Enviamos um código para …" (há sessão). Na página pública o texto atual, "Se houver um cadastro com …", é o neutro e fica.

## Domain Concept Identification

- **Opção do pedido** (existe, `TIPOS` `:221-230`): `conta` → `kind: "ACCOUNT"` pela API; `alguns`, `terceiro`, `lista` → e-mail.
- **Base da API** (existe vazia): passa a ser a do app, `ambiente_api.dart:91-92` **[m]**.
- **Resultado do pedido do código** (novo): código enviado (neutro) · espera (`429`, segundos) · e-mail inválido (`400`) · e-mail manual (qualquer outra coisa).
- **Resultado da confirmação** (novo): recebido (`graceDays`) · código incorreto · código vencido · espera · e-mail manual.
- Regra explícita: só `ACCOUNT` é atendido. Regra implícita **[i]**: `Retry-After` vem em segundos (o throttler do Nest); data HTTP também é aceita por segurança.

## Strategic Approach

- **Lógica pura num arquivo** `lp/excluir-conta.js` (sem DOM): base e rotas, corpo, leitura da resposta em resultado, textos do recebido e da espera, máscara. Testável em Node; a página só liga o DOM. Trade-off: um arquivo a mais servido, contra testar sem navegador (o pedido é teste enxuto e sem Playwright). Alternativa descartada: extrair o `<script>` inline no teste com DOM falso (frágil).
- **Base preenchida agora** (D1) e não vazia: com o CORS fechado, o resultado é o mesmo de hoje (e-mail), e quando a infra liberar a origem a página passa a usar a API sem novo deploy. Alternativa descartada: deixar vazio até o CORS abrir (precisaria de outra publicação e esconderia o defeito).
- **Neutro por construção:** qualquer `2xx` do código leva à mesma tela; `202` não é lido.
- **Timeout** de 15 s no `fetch` (sem rede pendurada) → e-mail.

## Risk & Gap Analysis

- **Bloqueante (infra):** `CORS_ALLOWED_ORIGINS` sem `https://www.legalizai.com.br` (e `https://legalizai.com.br`, se o apex servir). Até lá, a API nunca é alcançada do site.
- **Ambiente:** a base é a Lambda **dev**, a mesma do app hoje. Quando houver produção, troca no `EXCLUSAO_API` (um ponto) junto com o app.
- **Texto da página fixo** "Quem tem empresa aberta recebe no e-mail um link…" (seção "Em quanto tempo termina") promete o DP-5612; é texto de política (proposta até a advogada) e fica fora do recorte: pendência.
- **`403 ACCOUNT_DELETION_PENDING`** não é esperado na rota pública (idempotente); se vier, cai no e-mail (D4).
- **Preflight:** só `Content-Type` é enviado; está na allowlist de cabeçalhos.

| Critério | Atendível? | Lacuna |
|---|---|---|
| AC1 neutro | sim | só depois do CORS, em produção |
| AC2 graceDays | sim | — |
| AC3 código | sim | — |
| AC4 429 | sim | — |
| AC5 reenviar | sim | — |
| AC6 outras opções | sim | — |
| AC7 falha → e-mail | sim | é o comportamento enquanto o CORS estiver fechado |
