# Story Decomposition: a lista de espera grava na nossa API e o chat fica desligado

> Semente: `requirements/idea-of-the-enhancement-02-lista-de-espera-na-api-e-chat-desligado.md` · **Aprovação:** a da semente (Natanael, 26/10/2026, segue a cadeia).

## INVEST Analysis

### Abstract Task

- **Responsabilidade:** levar o cadastro de `/em-breve` ao caso de uso do REQ-032 e tirar do ar a última chamada ao backend antigo (o chat).
- **Operações:** montar o corpo do contrato; postar; ler a resposta; desligar o chat.
- **Restrições:** só campos do DTO; UTMs da sessão mantidas; obrigado e erro como hoje; sem PII em URL/console/`dataLayer`; nada no backend.
- **Complexidade:** baixa.

### INVEST Evaluation

- **Independente:** sim; a rota pública já está no ar e o CORS libera `https://www.legalizai.com.br`.
- **Negociável:** o valor de `origin`, o reenvio sem `privacyAcceptedAt`.
- **Valiosa:** os cadastros voltam a ser gravados (hoje todos se perdem).
- **Estimável:** meio dia.
- **Pequena:** 2 stories.
- **Testável:** corpo e resposta em Node; o chat desligado por leitura do arquivo.

### Split Strategy

Por superfície: o formulário (STORY-002-001) e o chat (STORY-002-002) não dependem um do outro.

## [STORY-002-001] A lista de espera grava na rota pública do REQ-032

### Background

`lp/em-breve/script.js:9` posta em `…wygq…/waitlist` (morto). A rota `POST /api/v1/marketing/landing-leads` aceita `firstName`, `lastName?`, `email`, `whatsapp`, `city`, `state?`, `origin`, `utm*?`, `privacyAcceptedAt?` e recusa campo extra.

### Business Value

Cada cadastro volta a contar no CRM e no CPL das campanhas.

### Dependencies and Assumptions

- REQ-032 na dev; CORS com `https://www.legalizai.com.br`.
- A UF é a que o `resolveUf()` já resolve hoje.

### Scope In

- Corpo do contrato, `POST` com tempo limite, `201` → obrigado; falha → mensagem padrão.
- O mesmo em `lp/_lab/em-breve/`.

### Scope Out

- Gravar o tipo de negócio e a origem do clique (o DTO não aceita: pendência do backend).
- Textos, layout e o obrigado.

### Acceptance Criteria

#### AC1: corpo do contrato
Dado "Ana Maria Souza", `ana@x.com`, `(31) 99999-0001`, "Belo Horizonte - MG", MEI, consentimento e `utm_source=meta` na sessão, quando a pessoa envia, então o corpo é `{firstName: "Ana", lastName: "Maria Souza", email, whatsapp: "31999990001", city: "Belo Horizonte", state: "MG", origin: "coming-soon", utmSource: "meta", privacyAcceptedAt: <ISO>}` e nenhum outro campo.

#### AC2: só um nome
Dado "Ana", então o corpo não tem `lastName`; UTM ausente não vai.

#### AC3: sucesso
Dado `201 {}`, então o evento `waitlist_signup` (sem PII) vai ao `dataLayer` e a página abre `/em-breve/obrigado/mei`.

#### AC4: falha
Dado `400`, `429`, `5xx`, sem rede ou tempo esgotado, então aparece a mensagem padrão "Não deu pra enviar" e nenhum dado pessoal vai a URL ou console.

#### AC5: relógio adiantado
Dado `400` na primeira tentativa, então a página reenvia uma vez sem `privacyAcceptedAt`; `201` → obrigado.

## [STORY-002-002] O chat do site fica desligado

### Background

`lp/em-breve/chat.js:12` chama `…wygq…/site-chat/messages`; a inclusão já está comentada em `lp/em-breve/index.html:432`.

### Business Value

Nenhuma conversa vai a um endereço morto; nenhum botão de chat aparece.

### Scope In

- Interruptor único `CHAT_ATIVO = false` e `API` vazio no `chat.js`: com ele desligado, o arquivo não cria botão, estilo nem chamada.
- Inclusão comentada mantida; como reativar, registrado no arquivo.

### Scope Out

- Um backend novo de chat.

### Acceptance Criteria

#### AC1: desligado
Dado o `chat.js` carregado por engano, então ele não toca o DOM nem a rede.

#### AC2: sem endereço morto
Dado o `grep` por `wygqjkfsc7qzc3chhzwztorula0kuzbw` em `lp/`, então não há ocorrência.
