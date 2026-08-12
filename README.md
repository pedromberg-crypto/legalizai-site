# legalizai-site

Site institucional da Legalizai — estático (HTML/CSS/JS puro, sem build), deploy único na Vercel (`legalizei-lp`, domínio `www.legalizai.com.br`). Root do deploy: `lp/`.

Rotas:

- `/coming-soon` — página de captura de lista de espera (`lp/coming-soon/`).
- `/home` — landing page institucional (`lp/index.html`).
- `/termos`, `/privacidade`.

**Enquanto durar o pré-lançamento**, `/` redireciona (307) pra `/coming-soon` — regra em `lp/vercel.json`. Pra lançar: remover o bloco `redirects` e a LP volta a atender em `/`.

Extraído do vault `legalizei` (`ux-ui/lp` + `ux-ui/coming-soon`) em 2026-08-03. Fonte de design/decisões continua no vault; este repo é só o código publicável.

`serve.json` na raiz é config de preview local (`npx serve`).
