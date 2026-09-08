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

## Dia do lançamento

Hoje `/` redireciona pra `/em-breve` e a LP responde em `/home`. Pra virar:

1. **`vercel.json`** — apague o bloco `redirects` inteiro.
   O `rewrites` de `/home` pode ficar: vira atalho antigo e não atrapalha.
2. **`robots.txt`** — apague a linha `Disallow: /home`.
   Ela existe porque indexar `/home` agora obrigaria o Google a reaprender a
   raiz depois, e trocar URL canônica de página já indexada custa semanas de
   posição.
3. **Search Console** — peça a indexação de `https://legalizai.com.br/`.
   O `sitemap.xml` já lista a raiz.

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
