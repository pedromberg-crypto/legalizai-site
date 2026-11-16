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

## 📲 Links das lojas do app (16/11/2026)

- App Store: <https://apps.apple.com/br/app/id6830729265> (no ar desde 13/11/2026)
- Google Play: <https://play.google.com/store/apps/details?id=br.com.legalizai.app>

Os **botões do site levam direto à loja** (quem passa o mouse vê
apps.apple.com / play.google.com, como pede a contestação do Google Ads
abaixo). Os mesmos links ficam nos atalhos do `vercel.json`, pra QR code, bio
e anúncio. Trocou um link: troca no HTML (home, rodapés, `modo-copy.mjs`,
`llms.txt`) e no `vercel.json`; o `testes/lojas.test.mjs` falha se não baterem.

| Rota | Vai pra |
|---|---|
| `/app-store` | App Store (link no `vercel.json`) |
| `/google-play` | Google Play (link no `vercel.json`) |
| `/baixar`, `/app`, `/download` | iPhone/iPad → `/app-store`; Android → `/google-play`; computador → `/#rodape` (os dois badges) |
| `/ios`, `/iphone` · `/android` | `/app-store` · `/google-play` |
| `app.`, `baixar.`, `download.legalizai.com.br` (qualquer caminho) | `https://www.legalizai.com.br/baixar` |

- Todos são **307 (temporários)**: dá pra trocar o link sem cache preso no
  navegador de ninguém.
- `/baixar` é o endereço pra QR code, bio do Instagram, anúncio e e-mail. A
  escolha pelo aparelho lê o `User-Agent`; o iPad com iPadOS se apresenta como
  Mac e cai no rodapé, onde estão os dois badges.
- **Subdomínios:** a regra já está no `vercel.json`, mas só funciona depois de
  (1) adicionar o domínio no projeto `legalizei-lp` da Vercel (Settings ›
  Domains) e (2) criar o CNAME no DNS apontando pra Vercel. Hoje (16/11) nenhum
  dos três existe no DNS. O domínio sem www já redireciona pro www, então
  `legalizai.com.br/baixar` funciona sozinho.
- Links diretos: badges do hero e do rodapé da home, coluna "O app" do rodapé
  de todas as páginas (home, blog, Fator R, cookies, privacidade, termos, 404,
  excluir-conta) e o `llms.txt`.
- Trava: enquanto o `vercel.json` tiver `LINK-…-PENDENTE`, o `build-lp.mjs` não
  roda. Os testes de rota estão em `testes/lojas.test.mjs`.

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
`LANCAMENTO`: hoje `2026-11-11T20:00:00-03:00` (20h de Brasília; era 10/11
no mesmo horário, adiado em 10/11 à noite). Mudou a data ou fechou o horário: troca essa linha, sobe o
`?v=` do `lancamento.js` na home, no `/em-breve` e no `_lab/em-breve`, e roda o
build. O `/em-breve` usa o `/lancamento.js` gerado pelo build, igual ao
`origem.js`.

No zero, os números viram "Chegou o dia!" no dia 10 e, do dia 11 em diante,
"O app chegou! Já está na App Store e no Google Play.". O bloco fica na home
mesmo no modo app (deixou de ser `.so-espera` em 13/10, pedido do Pedro). O
`/em-breve` não tem modo e **continua no ar depois do lançamento**: a captação
pelo formulário não para (decisão do Pedro, 13/10/2026).

## Oferta de lançamento

Regra desde 13/10/2026: MEI a R$ 29 e ME a R$ 99 nos 3 primeiros meses valem
pra quem **se cadastrar na lista de espera (form do `/em-breve`) até
31/12/2026**. O 31/12 é prazo do cadastro, não do preço. Ela está escrita em
5 lugares, e mudou a regra, muda nos 5:

1. etiqueta do hero ("Lista aberta até 31/12", no modo app) — `_lab/index.html`
   e o par dela no `_lab/modo-copy.mjs`;
2. os 2 cartões de plano (`.plano-oferta`) — `_lab/index.html`;
3. FAQ "Quanto custa?" e o espelho dele no JSON-LD — `_lab/index.html`;
4. linha de validade do card de preço — `em-breve/index.html` e `_lab/em-breve/index.html`;
5. mensagem de compartilhar do obrigado — `em-breve/obrigado/script.js` e a cópia no `_lab/`.

O `/em-breve` fica no ar depois do lançamento (11/11), então o cadastro que dá
direito à oferta segue aberto até 31/12. Duas viradas de texto, na MESMA
página (sem clonar: o `/em-breve` é `noindex` e fica fora do sitemap, então
clone não ganha nada em busca, e anúncios, sitelink, links compartilhados e a
conversão do GTM apontam pra esta URL):

- **11/11 (lançamento):** vinha da branch `virada/10-11-lancamento`, mergeada
  no `main` em 16/11. Sai o "está chegando / te avisar no lançamento" do
  `/em-breve` (title, description, linha de apoio, título do form, texto do
  consentimento, tagline do mockup) e do obrigado; a home vai pro modo app
  (badges com "Baixar na" e o link de cada loja), mas todo botão de oferta
  continua levando pro formulário, agora "Garantir minha condição"; a contagem
  passa a dizer "O app chegou! Já está na App Store e no Google Play." do dia
  seguinte ao lançamento em diante.
- **01/01/2027 (fim da oferta):** branch `virada/01-01-preco-cheio` (feita em
  cima da de 10/11). Preço cheio (MEI R$ 49, ME R$ 139) nos 5 lugares acima,
  mais a meta description da home, a linha de fidelidade do cartão MEI ("Em
  troca: 3 meses a R$ 29"), o FAQ "E se eu não gostar?" e o card do obrigado
  (`PLANO_COPY` em `em-breve/obrigado/script.js`). O JSON-LD `Service` já tem
  só o preço cheio e não muda. ⚠️ Ela foi feita antes dos ajustes do Google Ads
  e da data de 11/11: tem conflito com o `main`, resolver com cuidado.

## Ajustes da auditoria do Google Ads (14/10/2026)

- **Hero sem `.reveal`:** nada acima da dobra espera JS pra aparecer (o H1 é o
  LCP). Não devolver `reveal` a eyebrow, H1, contagem, botões, provas nem ao
  mockup do hero.
- **Blog:** só posts reais. O post do Fator R mora em `/blog/fator-r`
  (`_lab/blog/fator-r.html`); `/blog/post` e `/blog/post.html` fazem 301 pra lá
  no `vercel.json`. Nada de card, autor ou contagem de exemplo no ar.
- **`/em-breve`:** saiu do `robots.txt` e usa `noindex, follow` + canonical.
- **Arquivos novos na raiz:** `404.html` (a Vercel serve sozinha) e `llms.txt`
  (fatos conferidos no site; mudou preço ou regra, muda lá também).
- **Minificador de CSS:** o build procura o `lightningcss`. O `npm install`
  falha dentro do Google Drive (EBADF); instale numa pasta fora do Drive e rode
  `NODE_PATH=<pasta>/node_modules node build-lp.mjs`. Sem ele, o CSS vai cru e
  fica ~2× maior.

---

## Google Ads, suspensão por phishing (13/11/2026)

A conta do Google Ads foi suspensa por "práticas comerciais inaceitáveis: phishing".
Três correções no site, para a contestação:

1. **`legalizei-lp.vercel.app` redireciona (308) para o www**, mantendo o caminho
   (`redirects` com `has: host` no `vercel.json`). É o domínio `.vercel.app` de
   produção do próprio projeto: servia o site inteiro, inclusive o formulário,
   com outra grafia. Não remover essa regra. Previews ficam atrás do login da Vercel.
2. **Formulários postam no nosso domínio.** `lista-espera.js` e `excluir-conta.js`
   chamam `/api/v1/...` (URL relativa) e a Vercel repassa para a Lambda
   (`rewrites` no `vercel.json`). Nenhum `on.aws` no HTML ou JS público. Ao trocar a
   API (dev → produção), muda só o `destination` do rewrite.
3. **Sem links "Baixar na App Store / no Google Play" enquanto o app não estiver
   nas lojas.** Os dois links `.so-app` do rodapé saíram do `_lab/index.html`.
   No lançamento, voltam já com as URLs reais das lojas (nunca `#rodape`).
   16/11/2026: voltaram, com o link direto de cada loja (ver "Links das lojas").
