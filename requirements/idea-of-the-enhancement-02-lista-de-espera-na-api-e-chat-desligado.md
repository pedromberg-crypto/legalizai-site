# Conteúdo da melhoria

**Status:** APROVADO — Natanael, 2026-10-26, segue a cadeia. Mensagem literal: "pode seguir com a semente 02 e desative o chet. Esconda ele." Contexto: o backend antigo `wygqjkfsc7qzc3chhzwztorula0kuzbw.lambda-url.sa-east-1.on.aws` "não existe mais" (responde 403); a lista de espera e o chat do site apontam para ele, então cadastros estão se perdendo. Decisões abertas: o caminho conservador, registrado abaixo.

**Fontes da verdade:**
- API: `../app-backend/src/modules/marketing/presentation/landing-leads.controller.ts`, `dto/marketing.request.dto.ts` (`RegisterLandingLeadRequestDto`) e `../app-backend/docs/contrato-integracao-crm.md` §11 "Rota pública da landing page" (REQ-032, backend `90eaf96`).
- O formulário existente: `lp/em-breve/index.html` e `lp/em-breve/script.js` (cópia de laboratório em `lp/_lab/em-breve/`).

## Problema

O formulário de `/em-breve` posta em `…wygq…/waitlist`, que não existe mais: todo cadastro termina em "Não deu pra enviar" e se perde. O `chat.js` (widget do Léo) aponta para `…wygq…/site-chat/messages`; a inclusão já está comentada no HTML, mas o arquivo continua servido com o endereço morto.

## O que muda

- A lista de espera posta em `POST https://cu2viedkfvwuiuauvvi4guzdnm0ktprm.lambda-url.sa-east-1.on.aws/api/v1/marketing/landing-leads`, com o corpo do contrato do REQ-032.
- O chat fica desligado por um interruptor único no `chat.js` (sem endereço) e com a inclusão comentada no HTML; o arquivo fica, com o passo a passo para reativar.
- O mesmo em `lp/_lab/em-breve/` (não publicado, mas é a cópia de trabalho).

## Decisões (recomendação, a conservadora)

- **D1:** o endereço da API fica num ponto só (`lp/em-breve/lista-espera.js`), a mesma Lambda dev do app e da semente 01.
- **D2:** campo que o DTO não aceita não vai (o `ValidationPipe` recusa campo extra com `400`): `tipoNegocio`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `landingPage`, `referrer`. O plano escolhido continua decidindo o obrigado.
- **D3:** `origin` (obrigatório no DTO, o formulário não coleta) = `coming-soon`, o mesmo valor que o site mandava ao backend antigo.
- **D4:** `privacyAcceptedAt` = o instante do envio (o aceite é obrigatório no formulário). Se a API recusar com `400` (relógio do visitante adiantado mais de 5 min), reenvia uma vez sem ele, para não perder o cadastro.
- **D5:** erro (`400`, `429`, `5xx`, rede, tempo esgotado) mostra a mensagem padrão de hoje; o ramo `409` sai, porque a API não tem mais `409`.
- **D6:** o backend não é alterado.

## Aceite

- Cadastro válido → `POST` com o corpo do contrato → `201` → `/em-breve/obrigado/<plano>`, com o evento `waitlist_signup` sem PII.
- Falha → "Não deu pra enviar", sem PII em URL, console ou `dataLayer`.
- Nenhuma chamada ao chat; nenhuma ocorrência do endereço antigo em código ativo.
