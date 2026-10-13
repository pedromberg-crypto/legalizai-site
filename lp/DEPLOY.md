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
  exata redireciona**: `/atendimento/icones/` continua servido porque a home
  usa os ícones.
- 09/10/2026: o mesmo simulador rodava **dentro da home**, como "validador"
  (`atendimento.js` renderizando em `#sim-screen`), com frases como "a
  abertura sai da sua mão e vem pra nossa". A seção saiu da home, junto com o
  `atendimento.css`/`.js`, e `atendimento/index.html` e `atendimento.js` saíram
  do deploy pelo `.vercelignore`. No lançamento: apagar essas duas linhas do
  `.vercelignore` e devolver a seção (o markup está no git).

## O que não vai pro ar (`.vercelignore`)

`_lab/`, este `DEPLOY.md`, `build-lp.mjs`, `em-breve/src.css` e os dois arquivos
do simulador. Até 09/10/2026 o `DEPLOY.md` e o `build-lp.mjs` respondiam 200 no
domínio. O `/em-breve` não passa pelo minificador, então **comentário escrito
lá vai pro ar como está**: nada de nota sobre política do Google Ads, abertura
de empresa ou CNPJ em comentário do `/em-breve` (fica no git, neste arquivo).

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

No zero, os números viram "Chegou o dia!" no dia 10 e, do dia 11 em diante,
"O app chegou! Já está na App Store e no Google Play.". O bloco ficou na home
mesmo no modo app (deixou de ser `.so-espera` em 13/10, pedido do Pedro) e
**saiu da home em 01/01/2027** (pedido do Pedro): hoje só o `/em-breve` carrega
o `lancamento.js`. O `/em-breve` não tem modo e **continua no ar depois do
lançamento**: a captação pelo formulário não para (decisão do Pedro, 13/10/2026).

## Oferta de lançamento (encerrada em 31/12/2026)

Desde 01/01/2027 o site mostra só o preço cheio: MEI R$ 49 e ME R$ 139. A
oferta ficou dita em UM lugar, no FAQ "Quanto custa?" (+ JSON-LD): quem se
cadastrou até 31/12/2026 segue com os 3 primeiros meses a R$ 29 / R$ 99. O
`modo-copy.mjs` foi aposentado. O histórico abaixo fica pra consulta.

Regra de 13/10/2026: MEI a R$ 29 e ME a R$ 99 nos 3 primeiros meses valiam
pra quem **se cadastrasse na lista de espera (form do `/em-breve`) até
31/12/2026**. O 31/12 era prazo do cadastro, não do preço. Ela esteve escrita
em 5 lugares:

1. etiqueta do hero ("Lista aberta até 31/12", no modo app) — `_lab/index.html`
   e o par dela no `_lab/modo-copy.mjs`;
2. os 2 cartões de plano (`.plano-oferta`) — `_lab/index.html`;
3. FAQ "Quanto custa?" e o espelho dele no JSON-LD — `_lab/index.html`;
4. linha de validade do card de preço — `em-breve/index.html` e `_lab/em-breve/index.html`;
5. mensagem de compartilhar do obrigado — `em-breve/obrigado/script.js` e a cópia no `_lab/`.

O `/em-breve` fica no ar depois do lançamento (10/11), então o cadastro que dá
direito à oferta segue aberto até 31/12. Duas viradas de texto, na MESMA
página (sem clonar: o `/em-breve` é `Disallow` no robots.txt e fica fora do
sitemap, então clone não ganha nada em busca, e anúncios, sitelink, links
compartilhados e a conversão do GTM apontam pra esta URL):

- **10/11 (lançamento):** branch `virada/10-11-lancamento`. Sai o "está
  chegando / te avisar no lançamento" do `/em-breve` (title, description, h1,
  título do form, texto do consentimento, tagline do mockup) e do obrigado; a
  home vai pro modo app (badges com "Baixar na" e o link de cada loja), mas
  todo botão de oferta continua levando pro formulário, agora "Garantir minha
  condição"; a contagem do `/em-breve` passa a dizer "O app chegou! Já está na
  App Store e no Google Play." do dia 11 em diante.
- **01/01/2027 (fim da oferta):** branch `virada/01-01-preco-cheio` (feita em
  cima da de 10/11). Preço cheio (MEI R$ 49, ME R$ 139) nos 5 lugares acima,
  mais a meta description da home, a linha de fidelidade do cartão MEI ("Em
  troca: 3 meses a R$ 29"), o FAQ "E se eu não gostar?" e o card do obrigado
  (`PLANO_COPY` em `em-breve/obrigado/script.js`). O JSON-LD `Service` já tem
  só o preço cheio e não muda.

### Passo a passo do dia 10/11

Só com o app **publicado nas duas lojas** (a frase da contagem afirma isso):

1. `git merge virada/10-11-lancamento` no `main`.
2. Em `_lab/index.html`, trocar `#LINK-APP-STORE-PENDENTE` e
   `#LINK-GOOGLE-PLAY-PENDENTE` (3 vezes cada: 2 badges e o link do rodapé)
   pelos links das lojas. Enquanto eles estiverem lá, o `build-lp.mjs` se
   recusa a rodar.
3. `cd lp && node build-lp.mjs`. Sem o `lightningcss` instalado o CSS sai
   cru: se nenhum `.css` do `_lab` mudou, `git checkout -- lp/styles.css
   lp/atendimento/atendimento.css lp/blog/blog.css` devolve o minificado.
4. Commit e push. O `/em-breve`, o obrigado e as páginas legais já vêm
   prontos na branch (não passam pelo build).

### Passo a passo do dia 01/01/2027

1. `git rebase main` na `virada/01-01-preco-cheio`: o `main` terá os links
   das lojas colados no dia 10/11, e a branch mexe nas linhas vizinhas do
   rodapé (pode pedir pra resolver conflito na coluna "O app": fica o link de
   verdade das lojas e o texto novo da branch).
2. `git merge virada/01-01-preco-cheio` no `main`, `cd lp && node build-lp.mjs`
   (mesmo cuidado com o CSS cru do passo 3 acima), commit e push.
3. Fora do site: anúncios e sitelinks que falem em R$ 29 / R$ 99 ou "até
   31/12" (Google Ads e Meta) saem no mesmo dia.
