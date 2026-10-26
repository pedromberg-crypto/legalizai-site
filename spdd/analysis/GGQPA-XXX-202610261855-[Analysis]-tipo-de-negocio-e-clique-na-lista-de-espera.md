# SPDD Analysis: tipo de negócio e clique do anúncio na lista de espera (STORY-003-001)

> Requisito: `requirements/[User-story-03]tipo-de-negocio-e-clique-na-lista-de-espera.md` · Semente: `requirements/idea-of-the-enhancement-03-tipo-de-negocio-e-clique-na-lista-de-espera.md` · Confiança: **[m]** medido · **[d]** documentado · **[i]** inferido.

## Diagnóstico verificado

- **[m]** `lp/em-breve/lista-espera.js` `montarCorpo` manda só os 13 campos do REQ-032; o comentário cita a pendência do backend.
- **[m]** `lp/origem.js` grava em `sessionStorage.legalizai_origem` `{landingPage: location.pathname, referrer: <referrer externo inteiro, ≤500>, gclid?, gbraid?, wbraid?, fbclid?}` (cada id ≤500). O `referrer` pode ter query; o `pathname` não.
- **[m]** Antes da semente 02 (`git show 9a1c930^:lp/em-breve/script.js`) o `script.js` lia essa chave (`lerOrigem`) e mandava `tipoNegocio: tipo.value` (o rótulo) e os seis campos, cortados em 500.
- **[m]** `lp/em-breve/index.html:174-176` — três `li` com `data-value` (rótulo) e `data-plan` (`me`, `mei`, `me`).
- **[d]** REQ-058 (`../app-backend/docs/contrato-integracao-crm.md` §11): formatos da tabela da semente; fora do formato = `400`; `""` = ausente.
- **[m]** `lp/em-breve/` não é saída do `build-lp.mjs` (edição direta); `lp/_lab/em-breve/` difere só nos caminhos.

## Mapeamento

| Origem | DTO | Regra |
|---|---|---|
| opção escolhida, `data-business-type` | `businessType?` | só `NEW_COMPANY · MIGRATE_MEI · MIGRATE_ME` |
| `legalizai_origem.gclid/gbraid/wbraid/fbclid` | idem | `^[A-Za-z0-9._~-]{1,500}$`, senão não vai |
| `legalizai_origem.landingPage` | `landingPage?` | corta em `?`/`#`; começa com `/`; ≤300; sem espaço |
| `legalizai_origem.referrer` | `referrer?` | corta em `?`/`#`; `^https?://host[/caminho]$`; ≤500 |

## Riscos

- **Site antes do backend:** os campos novos dariam `400`; o reenvio (D3) salva o cadastro sem eles. Mesmo assim o push do backend vai antes.
- **Limite 10/h por IP:** o reenvio custa até 2 tentativas extras só em `400`.
- **Política:** os textos já diziam que o tipo e a origem são guardados; com o REQ-058 voltam a corresponder, exceto pela forma (sem query) — listar para quem cuida da política.
