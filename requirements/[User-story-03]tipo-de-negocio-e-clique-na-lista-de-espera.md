# Story Decomposition: a lista de espera volta a mandar o tipo de negócio e o clique do anúncio

> Semente: `requirements/idea-of-the-enhancement-03-tipo-de-negocio-e-clique-na-lista-de-espera.md` · **Aprovação:** a da semente (Natanael, 26/10/2026, segue a cadeia).

## INVEST Analysis

- **Independente:** depende do REQ-058 no ar; o reenvio (D3) evita perda de cadastro enquanto não está.
- **Valiosa:** a equipe vê o que o lead quer; o cadastro liga ao anúncio.
- **Pequena:** 1 story. **Testável:** `montarCorpo` e `enviar` em Node com `fetch` falso.

## [STORY-003-001] O cadastro leva o tipo de negócio e a origem do clique

### Background

`lp/em-breve/lista-espera.js` monta só os campos do REQ-032. O REQ-058 (backend `aa2c210`) aceita `businessType` (`NEW_COMPANY · MIGRATE_MEI · MIGRATE_ME`), `gclid`, `gbraid`, `wbraid`, `fbclid` (até 500, `A-Z a-z 0-9 . _ ~ -`), `landingPage` (caminho, até 300, sem `?`/`#`) e `referrer` (`http(s)` com origem e caminho, até 500, sem `?`/`#`).

### Scope In

- `data-business-type` nas três opções; `montarCorpo` com `tipoNegocio` e `origem`; limpeza da D2; reenvio da D3. O mesmo em `lp/_lab/em-breve/`.

### Scope Out

- Texto das políticas; o `/origem.js` (continua gravando o mesmo); o obrigado.

### Acceptance Criteria

#### AC1: corpo completo
Dado "Migrar meu MEI para cá" e a origem `{gclid: "Cj0_a-1", fbclid: "IwAR.x~y", landingPage: "/em-breve", referrer: "https://www.google.com/search?q=abrir+empresa"}`, quando envia, então o corpo leva `businessType: "MIGRATE_MEI"`, `gclid`, `fbclid`, `landingPage: "/em-breve"`, `referrer: "https://www.google.com/search"` e nenhum campo fora do DTO.

#### AC2: limpeza
Dado `landingPage: "/em-breve?email=a@b.com#x"`, `gclid: "abc def"`, `referrer: "javascript:alert(1)"` e tipo `"mei"`, então vai `landingPage: "/em-breve"` e não vão `gclid`, `referrer` nem `businessType`.

#### AC3: reenvio
Dado `400` e depois `201`, então a 2ª tentativa vai sem os campos do REQ-058 e com o aceite; dado `400, 400, 201`, a 3ª vai sem os dois.
