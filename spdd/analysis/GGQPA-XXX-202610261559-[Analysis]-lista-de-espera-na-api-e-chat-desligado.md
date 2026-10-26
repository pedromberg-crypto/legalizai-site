# SPDD Analysis: a lista de espera grava na nossa API e o chat fica desligado (STORY-002-001, STORY-002-002)

> Requisito: `requirements/[User-story-02]lista-de-espera-na-api-e-chat-desligado.md` · Semente: `requirements/idea-of-the-enhancement-02-lista-de-espera-na-api-e-chat-desligado.md` · Confiança: **[m]** medido · **[d]** documentado · **[i]** inferido.

## Requisito original

"pode seguir com a semente 02 e desative o chet. Esconda ele." — o formulário de `/em-breve` passa a postar na rota pública do REQ-032; o chat fica desligado sem apagar o arquivo; o `_lab` recebe o mesmo; nenhuma referência viva ao backend antigo.

## Diagnóstico verificado

- **[m]** `lp/em-breve/script.js:9` — `WAITLIST_ENDPOINT = '…wygq…/waitlist'`; o backend antigo responde `403` (relato da sessão), então todo envio cai no `ERRO_PADRAO`.
- **[m]** `script.js` (submit) — o corpo atual é `{nome, sobrenome, email, whatsapp (com máscara), cidade ("Cidade - UF"), tipoNegocio, origem: 'coming-soon', utm* ('' quando ausente), estado?, gclid?, gbraid?, wbraid?, fbclid?, landingPage?, referrer?}`; trata `409` (WhatsApp duplicado) com a mensagem do corpo.
- **[m]** `lp/em-breve/` **não** está em `COPIAR` de `lp/build-lp.mjs:53-54`: é editado direto e vai ao ar como está. `lp/_lab/em-breve/` é cópia de trabalho e não é publicada (`lp/.vercelignore`: `_lab`); difere só nos caminhos `/_lab/`.
- **[m]** `lp/em-breve/index.html:429-432` — `script.js?v=9` com `defer`; o `chat.js` já está comentado ("ocultado a pedido do Pedro"). O `chat.js` continua servido em `/em-breve/chat.js` com o endereço morto (`:12`) e, carregado, cria botão, estilo e chamadas.
- **[m]** `lp/vercel.json` não tem regra para `/em-breve/*.js` (o cache por versão é a query `?v=`); nada a mudar nele.

### API (REQ-032)

- **[m]** `app-backend/src/modules/marketing/presentation/landing-leads.controller.ts` — `POST marketing/landing-leads` v1, `201 {}`, throttle `RateLimit.LandingLead` (`10` por `60 min`, `rate-limit.ts:181`), sem guard.
- **[m]** `dto/marketing.request.dto.ts:105-194` — `firstName` (trim, ≤80, obrigatório) · `lastName?` (≤80) · `email` (trim+lower, IsEmail, ≤254) · `whatsapp` (só dígitos, `^\d{10,13}$`) · `city` (trim, ≤80, obrigatório) · `state?` (`^[A-Z]{2}$`) · `origin` (≤60, **obrigatório**) · `utmSource|Medium|Campaign|Content|Term?` (≤200) · `privacyAcceptedAt?` (ISO 8601 estrito, até 5 min no futuro).
- **[d]** `contrato-integracao-crm.md` §11 — "Campo extra é recusado"; não existe `409`; `429 RATE_LIMIT_EXCEEDED`; `400 VALIDATION_ERROR`.
- **[d]** CORS: a sessão informa que `https://www.legalizai.com.br` já está liberada.

## Domain Concept Identification

- **Cadastro da lista** (existe no DOM): nome completo, e-mail, WhatsApp, cidade (+UF resolvida), tipo, consentimento.
- **Corpo do contrato** (novo, puro): o mapeamento abaixo.
- **Resultado do envio** (novo): `ok` · `erro`. Regra implícita **[i]**: `400` com `privacyAcceptedAt` pode ser só o relógio do visitante; reenviar uma vez sem ele.

| Formulário | DTO | Regra |
|---|---|---|
| nome completo, 1ª palavra | `firstName` | `splitNome` de hoje |
| resto do nome | `lastName?` | omitido se vazio |
| e-mail | `email` | `trim` (a API põe em minúsculas) |
| WhatsApp | `whatsapp` | só dígitos |
| cidade | `city` | sem o sufixo ` - UF` da lista |
| UF (`resolveUf`) | `state?` | só se for `^[A-Z]{2}$` |
| — | `origin` | `coming-soon` (D3) |
| `legalizai_utm` | `utm*?` | omitidos se vazios, ≤200 |
| consentimento | `privacyAcceptedAt?` | instante do envio (D4) |
| tipo de negócio | — | não vai (D2); decide o obrigado |
| `legalizai_origem` (gclid, gbraid, wbraid, fbclid, landingPage, referrer) | — | não vai (D2) |

## Strategic Approach

- **Lógica pura em `lp/em-breve/lista-espera.js`** (UMD: `window.LzListaEspera` / `module.exports`), como `lp/excluir-conta.js` da semente 01: endpoint, corpo, `postar` com tempo limite, leitura da resposta e o reenvio. O `script.js` só liga o DOM. Alternativa descartada: testar o `script.js` com DOM falso (frágil, ele toca o DOM no carregamento).
- **Chat:** interruptor `CHAT_ATIVO = false` no topo do `chat.js`, que sai do IIFE antes de tocar DOM ou rede, e `API = ''`. A inclusão continua comentada (duas travas). Alternativa descartada: apagar o arquivo (pedido: não apagar).
- **`_lab`:** mesmas mudanças, com os caminhos `/_lab/`.

## Risk & Gap Analysis

- **Dados que deixam de ir:** tipo de negócio e a origem do clique (gclid/fbclid/landingPage/referrer) não são gravados, porque o DTO não os aceita. A política (`privacidade.html`, `excluir-conta.html:164`) e `cookies.html:101` dizem que o cadastro inclui o tipo e a origem: passam a dizer mais do que é gravado (não menos). Pendência do backend (semente lá: aceitar `businessType` e os ids de clique).
- **Limite 10/h por IP:** redes compartilhadas (escritório, 4G com CGNAT) podem bater o limite em campanha; o visitante vê a mensagem padrão. Pendência de observação.
- **Ambiente:** a base é a Lambda **dev** (a mesma do app e da semente 01); troca num ponto só quando houver produção.
- **Duplicata:** a API grava de novo o mesmo e-mail (sem `409`); o aviso de WhatsApp duplicado some — comportamento do contrato.
- **Tamanho:** nome/cidade acima de 80 caracteres dão `400` → mensagem padrão (raríssimo; o HTML não tem `maxlength`).

| Critério | Atendível? | Lacuna |
|---|---|---|
| 002-001 AC1 corpo | sim | — |
| 002-001 AC2 só um nome | sim | — |
| 002-001 AC3 sucesso | sim | — |
| 002-001 AC4 falha | sim | — |
| 002-001 AC5 relógio | sim | custa 1 das 10 tentativas/h |
| 002-002 AC1 desligado | sim | — |
| 002-002 AC2 grep | sim | — |
