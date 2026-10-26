# Conteúdo da melhoria

**Status:** APROVADO — Natanael, 2026-10-26, segue a cadeia. Mensagens literais: "Gere todas as cadeias de sementes SPDD para implementarmos essa feature de exclusão de conta app + api + banco de dados. Siga boas práticas de recomendações. Evite realizar testes desnecessários por conta do longo tempo de espera. Faça apenas testes enxutos e essenciais." e, sobre o site, "opção 1 pois o site é um repositorio que eu preciso dar manutenção e o spdd é essencial." Decisões abertas: o caminho conservador, registrado abaixo.

**Fontes da verdade:**
- API: `../app-backend/docs/contrato-integracao.md` §"`EXC1`–`EXC4` — Excluir minha conta (REQ-056)" e `../app-backend/src/modules/account-deletion/presentation/` (backend `c17aed4`).
- Telas e textos: `../prototipo/app/src/components/conta/excluir-conta.tsx` (`EXC3` e `EXC4`) e `../prototipo/app/src/lib/politica-privacidade.ts`.
- A página existente: `lp/excluir-conta.html` (4 opções, `EXCLUSAO_API` vazio, fallback por e-mail).

## Problema

A página pública `/excluir-conta` só aceita o pedido por e-mail: `EXCLUSAO_API` está vazio e o contrato previsto no comentário (`/pedido`, `/confirmar`, `tipo`) não é o que o backend publicou. O REQ-056 já está no ar na dev com as rotas públicas.

## O que muda

- "Excluir minha conta" chama a API do REQ-056: `POST account-deletion/code` `{email, kind: "ACCOUNT"}` e `POST account-deletion` `{email, code, kind: "ACCOUNT"}`.
- As outras 3 opções continuam pelo e-mail, e a página diz isso, porque a API responde `422 DELETION_KIND_NOT_SUPPORTED` para elas.
- O recebido usa `graceDays` da resposta; o código pode ser reenviado depois de 60 s; `429` mostra a espera.
- Sem rede, CORS bloqueado ou erro inesperado: o pedido por e-mail, como hoje.

## Decisões (recomendação, a conservadora)

- **D1:** a base da API é a mesma do app (`ambiente_api.dart`, a Lambda da dev) e fica num ponto só (`EXCLUSAO_API`).
- **D2:** a resposta do pedido do código é sempre a mesma tela, neutra; nenhum texto diz se o e-mail tem conta.
- **D3:** o `EXC4` sem "o link dos seus documentos" (DP-5612 do backend não existe); `hasCompany` não muda o texto.
- **D4:** `403`, `5xx`, `422 DELETION_KIND_NOT_SUPPORTED`, rede e CORS caem no pedido por e-mail.
- **D5:** o backend não é alterado. Se o CORS não aceitar a origem do site, isso vira pendência bloqueante e o fallback segura.

## Aceite

- Com a API respondendo, "Excluir minha conta" + e-mail → tela do código, neutra; código certo → "Pedido recebido" com o prazo de `graceDays`.
- Código errado → "Código incorreto."; vencido → pedir outro; `429` → espera em segundos.
- As outras 3 opções → pedido por e-mail, dizendo que por enquanto é assim.
- Sem rede ou com CORS bloqueado → pedido por e-mail.
