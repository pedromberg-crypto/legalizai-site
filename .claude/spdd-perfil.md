# Perfil SPDD — legalizai-site (HTML/JS estático)

As fases SPDD são as do `legalizai-projeto/spdd-compartilhado/skills/spdd-*` (lidas por caminho; este repo não tem cópia). Este arquivo diz **como elas se aplicam aqui** e ganha delas em conflito. A constituição é o `CLAUDE.md`. Criado em 26/10/2026, na primeira cadeia do site.

## Leitura obrigatória antes de qualquer fase

`CLAUDE.md` · `lp/DEPLOY.md` · `README.md`.

## Story (`/spdd-story`)

- Semente: `requirements/idea-of-the-enhancement-<NN>-<slug>.md` (NN com 2 dígitos, começa em 01).
- Decomposição: `requirements/[User-story-<NN>]<slug>.md`, com as stories `[STORY-<MMM>-<SSS>]` (MMM = número da semente com 3 dígitos).
- Template: o do `app-frontend` (`# Story Decomposition: …` → `## INVEST Analysis` → uma `## [STORY-…]` por story com Background · Business Value · Dependencies and Assumptions · Scope In · Scope Out · Acceptance Criteria `#### ACn:` Dado/Quando/Então).
- Índice: linha em `requirements/INDEX.md`.

## Análise (`/spdd-analysis`)

- Arquivo: `spdd/analysis/GGQPA-XXX-<aaaammddhhmm>-[Analysis]-<slug>.md` (`XXX` literal).
- Template: `# SPDD Analysis: <título> (STORY-…)` → `## Requisito original` → `## Diagnóstico verificado` → `## Domain Concept Identification` → `## Strategic Approach` → `## Risk & Gap Analysis` (com a tabela de cobertura dos ACs).
- Fontes de texto e tela: **só** o protótipo (`../prototipo/app/`). A pasta `../legalizei/` é do Pedro e não é fonte.
- Contrato de API: `../app-backend/docs/contrato-integracao.md` (literal) e o código do módulo em `../app-backend/src`.

## REASONS (`/spdd-reasons-canvas`)

- Arquivo: `spdd/prompt/GGQPA-XXX-<aaaammddhhmm>-[Feat|Fix|Refactor|Docs]-<slug>.md`. O id é o que o código cita em comentário.
- Seções `## Requirements` … `## Safeguards`; operations `### OP-n <nome> (<story>)`; matriz de rastreabilidade no fim.
- Toda cadeia termina com uma operation de **Testes** e uma de **Registro** (índices).
- Aprovação: a da semente (`APROVADO — <quem>, <data>, segue a cadeia`), por delegação.
- Índice: linha em `spdd/INDEX.md`.

## Generate (`/spdd-generate`)

- Por operation: `npm test` (Node `node:test`, sem navegador) quando a operation toca lógica.
- No fim: `cd lp && node build-lp.mjs` sem erro + `npm test`. Se o build regenerar arquivos que a cadeia não tocou, eles voltam ao `HEAD` (não são desta cadeia).
- **Não** rodar Playwright/E2E nem servidor em segundo plano persistente. **Não** chamar API real que envia e-mail.

## Commit e push

- Commit na `main`, depois de `git fetch && git pull --ff-only`, com o trailer pedido na sessão.
- **Sem push:** o Pedro revisa e publica.

## Cadeia — paradas próprias

- Mudar `lp/vercel.json`, `.vercelignore` ou o que o build copia.
- Texto jurídico novo (prazos, política) que não está no protótipo.
- Qualquer mudança no backend (vira semente lá).
