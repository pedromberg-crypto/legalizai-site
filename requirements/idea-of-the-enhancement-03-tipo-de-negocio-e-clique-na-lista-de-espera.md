# Conteúdo da melhoria

**Status:** APROVADO — Natanael, 2026-10-26, segue a cadeia. Mensagem literal: "sim, altere a API para guardar essas informações" — o tipo de negócio do formulário da lista de espera e os ids/contexto de clique dos anúncios, que deixaram de ser gravados na semente 02. Decisões abertas: o caminho conservador, registrado abaixo.

**Fontes da verdade:**
- API: `../app-backend/src/modules/marketing/presentation/dto/marketing.request.dto.ts` (`RegisterLandingLeadRequestDto`) e `../app-backend/docs/contrato-integracao-crm.md` §11 "Rota pública da landing page", bloco **REQ-058** (backend `aa2c210`).
- O formulário: `lp/em-breve/index.html` (as três opções de `soon-tipo`), `lp/em-breve/script.js`, `lp/em-breve/lista-espera.js` e `lp/origem.js` (o que fica em `sessionStorage.legalizai_origem`); cópias em `lp/_lab/`.

## Problema

A semente 02 tirou do envio o tipo de negócio e a origem do clique (`gclid`, `gbraid`, `wbraid`, `fbclid`, `landingPage`, `referrer`) porque o DTO do REQ-032 recusava campo extra. Sem eles a equipe não sabe o que o lead quer, e o cadastro não se liga ao anúncio.

## O que muda

- `lista-espera.js` volta a mandar `businessType` e os seis campos de clique, nos nomes e formatos do REQ-058.
- Cada opção do formulário ganha `data-business-type` com o código da API.
- `script.js` lê a origem gravada pelo `/origem.js` e o tipo escolhido, e os passa ao `montarCorpo`.

## Decisões (recomendação, a conservadora)

- **D1:** o código do tipo vem de `data-business-type` na opção (`NEW_COMPANY`, `MIGRATE_MEI`, `MIGRATE_ME`), não do rótulo nem do `data-plan` (que junta duas opções). Valor fora do enum não vai.
- **D2:** o site limpa antes de mandar: `landingPage` e `referrer` sem query nem fragmento (`referrer` só `http(s)`); id de clique fora de `A-Z a-z 0-9 . _ ~ -` ou acima de 500 não vai. A API recusa o que não estiver assim (`400`), e nada com query (onde mora PII) sai do navegador.
- **D3:** `400` reenvia primeiro **sem os campos do REQ-058** (mantém o aceite) e, se ainda for `400`, sem `privacyAcceptedAt` (o D4 da semente 02). No máximo 3 tentativas; nenhum cadastro se perde se o backend estiver numa versão anterior.
- **D4:** o push do backend (REQ-058) vai **antes** do push do site; o D3 cobre a janela de deploy.
- **D5:** o texto das políticas não muda nesta semente.

## Aceite

- Cadastro com "Migrar meu MEI para cá" e `gclid` na sessão → corpo com `businessType: "MIGRATE_MEI"`, `gclid`, `landingPage`, `referrer` sem query → `201` → obrigado.
- Origem com query ou id inválido → o campo não vai; o resto vai.
- `400` → reenvio sem os campos novos; `400` de novo → sem o aceite.
