# Deploy da LP

## Fluxo normal

1. Edite em **`lp/_lab/`**. Sempre. É a fonte.
2. `cd lp && node build-lp.mjs`
3. `git add lp/ && git commit && git push`

O build copia `_lab/` pra raiz de `lp/`, troca os 99 caminhos `/_lab/` por `/` e
minifica a saída. `node build-lp.mjs --raw` publica sem minificar (só pra
depurar algo que aparece apenas em produção).

**Não edite os arquivos gerados em `lp/`** — `index.html`, `styles.css`,
`script.js`, `vidro-liquido.js`, `atendimento/`, `blog/`, `assets/`. O próximo
build sobrescreve.

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
