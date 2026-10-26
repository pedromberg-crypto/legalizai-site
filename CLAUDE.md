# legalizai-site

Site institucional estático (HTML/CSS/JS puro). A Vercel serve `lp/` como raiz (`www.legalizai.com.br`). Detalhes de deploy: `lp/DEPLOY.md`; visão geral: `README.md`.

## Estrutura

- `lp/_lab/` — **fonte** da home, blog e scripts compartilhados. `cd lp && node build-lp.mjs` copia para `lp/` e minifica. Não edite a saída gerada (lista no `DEPLOY.md`).
- `lp/*.html` fora da lista do build (`privacidade`, `termos`, `excluir-conta`, `cookies`, `404`) e `lp/excluir-conta.js` — editados direto, servidos como estão (comentário vai ao ar).
- `lp/em-breve/` — Tailwind compilado (`npm run build:css`).
- `requirements/` e `spdd/` — artefatos SPDD (fora do deploy: a raiz do deploy é `lp/`). Perfil: `.claude/spdd-perfil.md`.
- `testes/` — testes Node (`node:test`) da lógica que não depende do navegador.

## Verificar

1. `cd lp && node build-lp.mjs` (termina sem erro).
2. `npm test`.
3. Sem Playwright/E2E por padrão; nunca chame a API real em teste (as rotas de exclusão mandam e-mail).

## Regras

- `lp/vercel.json` não aceita comentário (ver `DEPLOY.md`).
- Consentimento de cookies e GTM ficam no topo de cada página; não mude a ordem.
- Sem dado pessoal em URL, query string ou `console`.
- Textos e telas vêm do protótipo (`../prototipo/app/`); `../legalizei/` não é fonte.
- Commit na `main`; push é do Pedro.
