# legalizai-site

Site institucional da Legalizai — estático (HTML/CSS/JS puro, sem build), deploy único na Vercel (`legalizei-lp`, domínio `www.legalizai.com.br`). Root do deploy: `lp/`.

Rotas:

- `/coming-soon` — página de captura de lista de espera (`lp/coming-soon/`).
- `/home` — landing page institucional (`lp/index.html`).
- `/termos`, `/privacidade`.

**Enquanto durar o pré-lançamento**, `/` redireciona (307) pra `/coming-soon` — regra em `lp/vercel.json`. Pra lançar: remover o bloco `redirects` e a LP volta a atender em `/`.

Extraído do vault `legalizei` (`ux-ui/lp` + `ux-ui/coming-soon`) em 2026-08-03. Fonte de design/decisões continua no vault; este repo é só o código publicável.

`serve.json` na raiz é config de preview local (`npx serve`).

## `lp/em-breve/` — Tailwind (compilado local, commitado)

Único ponto do site que usa Tailwind (v4). `lp/em-breve/styles.css` é
**gerado** a partir de `lp/em-breve/src.css` — não editar `styles.css`
direto, a próxima build sobrescreve. Pra rebuildar depois de editar
`src.css` ou `index.html`:

```
npm install
npm run build:css
```

O build roda só localmente; o resultado é commitado normal e a Vercel
continua servindo estático, sem build próprio — o resto do site
continua HTML/CSS/JS puro, sem Tailwind. Ver
`.claude/skills/design-responsivo/SKILL.md` pra regras de
responsividade e checklist de teste dessa página.
