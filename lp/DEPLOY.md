# Deploy da LP

## Fluxo normal

1. Edite em **`lp/_lab/`**. Sempre. É a fonte.
2. `cd lp && node build-lp.mjs`
3. `git add lp/ && git commit && git push`

O build copia `_lab/` pra raiz de `lp/`, troca os 99 caminhos `/_lab/` por `/` e
minifica a saída. `node build-lp.mjs --raw` publica sem minificar (só pra
depurar algo que aparece apenas em produção).

**Não edite os arquivos gerados em `lp/`** — `index.html`, `styles.css`,
`script.js`, `vidro-liquido.js`, `consentimento.js`, `origem.js`, `lancamento.js`, `atendimento/`,
`blog/`, `assets/`. O próximo build sobrescreve.

Editar direto aqui é o certo: `vercel.json`, `robots.txt`, `sitemap.xml`,
`favicon.ico`, `privacidade.html`, `termos.html`, `em-breve/`, `build-lp.mjs`.

---

## 🌐 Domínio canônico: `www.legalizai.com.br`

A Vercel serve o site em `www` e manda `legalizai.com.br` pra lá com 308.
Então **toda URL absoluta do site é com www**: `<link rel="canonical">`,
`og:url`, `og:image`, `twitter:image`, o JSON-LD, as `<loc>` do `sitemap.xml`
e a linha `Sitemap:` do `robots.txt`.

Até 07/10/2026 isso tudo apontava pro domínio sem www — pra URLs que
redirecionam. O Google ignorou o canonical, indexou o www por conta própria e
deixou `/atendimento` e `/blog` fora do índice ("Detectada, mas não indexada").

Página nova: ela ganha `<link rel="canonical" href="https://www.legalizai.com.br/<rota>">`
e entra no `sitemap.xml` com www.

## Redirects

- `/coming-soon/*` → `/em-breve/*` (308). Slug antigo da página de espera; o
  Google ainda tinha a URL e acusava 404.
- `/atendimento` → `/` (307, temporário), desde 08/10/2026. A página é o
  simulador de abertura de empresa, e a política do Google Ads de serviços do
  governo lê abertura como identificador de empresa (CNPJ). Ela saiu também do
  `sitemap.xml` e volta no lançamento, como página de abertura. **Só a rota
  exata redireciona**: `/atendimento/atendimento.css` e `/atendimento/icones/`
  continuam servidos porque a home usa os dois.

---

## ⚠️ `vercel.json` não aceita comentário

Já quebrou um deploy (08/09/2026): chaves `$comment` foram adicionadas ao
arquivo e a Vercel rejeitou o build inteiro — o schema dela é estrito e não
admite chave desconhecida, nem no topo nem dentro de cada entrada de `headers`.
JSON não tem comentário. Qualquer explicação sobre o deploy mora **neste
arquivo**, não lá.

## Cache configurado

| rota | política | por quê |
|---|---|---|
| `/assets/*` | 1 ano, `immutable` | nome estável, muda junto com o deploy |
| `*.html` | sempre revalida | correção de copy tem que aparecer na hora |
| `styles.css`, `script.js`, `vidro-liquido.js` | 7 dias, revalida | já carregam `?v=N` no HTML |

## Origem da visita (UTM e clique de anúncio)

O anúncio cai na home, mas o cadastro acontece no `/em-breve`. Pra origem não
se perder no caminho:

- `origem.js` (fonte em `_lab/`) roda em home, `/atendimento`, `/blog` e
  `/em-breve`. Na primeira página da sessão, ou num clique novo vindo de fora,
  ele grava no sessionStorage `legalizai_origem` (gclid, gbraid, wbraid,
  fbclid, página de entrada, referrer) e `legalizai_utm`.
- `em-breve/script.js` manda esses campos no cadastro. O schema do backend
  descarta campo não declarado, então o backend precisa declarar `gclid`,
  `gbraid`, `wbraid`, `landingPage` e `referrer` pra passar a gravar.
- Toda página tem `gtag('set','url_passthrough',true)` no consentimento
  padrão, e o redirect pro obrigado leva os parâmetros de clique do Google
  (`gclid`, `gbraid`, `wbraid`, `dclid`, `gclsrc`, `_gl`). Página nova: copiar
  o bloco de consentimento de uma página existente, com essa linha.

## Contagem do lançamento do app

Home (hero, logo abaixo do título; o subtítulo saiu em 09/10) e `/em-breve`
(embaixo do título no celular; no desktop, dentro da tela do celular do mockup,
no lugar do aviãozinho) contam até o lançamento. A data mora **só** em `_lab/lancamento.js`, na constante
`LANCAMENTO`: hoje `2026-11-10T00:00:00-03:00` (sem horário fechado, conta até
a virada do dia). Mudou a data ou fechou o horário: troca essa linha, sobe o
`?v=` do `lancamento.js` na home, no `/em-breve` e no `_lab/em-breve`, e roda o
build. O `/em-breve` usa o `/lancamento.js` gerado pelo build, igual ao
`origem.js`.

No zero, os números viram "Chegou o dia!" e ficam assim até o site ir pro modo
app (`node _lab/modo-copy.mjs loja app`), que esconde o bloco da home pela
classe `.so-espera`. O `/em-breve` não tem modo: sai do ar no lançamento.
