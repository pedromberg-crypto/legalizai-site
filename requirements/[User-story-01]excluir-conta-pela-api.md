# Story Decomposition: a página /excluir-conta chama a API de exclusão (REQ-056)

> Semente: `requirements/idea-of-the-enhancement-01-excluir-conta-pela-api.md` · **Aprovação:** a da semente (Natanael, 26/10/2026, segue a cadeia).

## INVEST Analysis

### Abstract Task

- **Responsabilidade:** levar o pedido "Excluir minha conta" da página pública ao caso de uso do REQ-056, sem sessão, com o código do e-mail.
- **Operações:** pedir o código; confirmar com o código; reenviar; cair no pedido por e-mail.
- **Restrições:** resposta neutra (não revelar conta); prazo vindo de `graceDays`; sem dado pessoal em URL ou console; as outras 3 opções seguem por e-mail; nada no backend.
- **Complexidade:** baixa (uma página, duas rotas).

### INVEST Evaluation

- **Independente:** sim; a API já está no ar e o fallback existe.
- **Negociável:** textos de erro e de espera.
- **Valiosa:** exclusão sem app, exigida pelo Google Play, sem esperar resposta manual.
- **Estimável:** 1 dia.
- **Pequena:** 1 story, 3 pontos funcionais (pedir, confirmar, fallback).
- **Testável:** lógica de resposta testável em Node; textos verificáveis na página.

### Split Strategy

Não divide: pedir e confirmar não entregam valor separados, e o fallback já existe.

## [STORY-001-001] Excluir minha conta pela página, com o código do e-mail

### Background

A página tem 4 opções e só manda o pedido por e-mail. O backend publicou `POST /api/v1/account-deletion/code` e `POST /api/v1/account-deletion` (REQ-056), que atendem só `kind: "ACCOUNT"`.

### Business Value

Quem não tem mais o app exclui a conta na hora (desativada ao confirmar), sem esperar até 15 dias pela resposta do e-mail.

### Dependencies and Assumptions

- REQ-056 na dev (backend `c17aed4`); base da API a mesma do app.
- O navegador só chama a API se o CORS dela aceitar a origem `https://www.legalizai.com.br` (infra do backend).
- O prazo de desistência vem de `graceDays` (padrão 30, proposta até a advogada).

### Scope In

- "Excluir minha conta": pedir o código, confirmar, reenviar depois de 60 s, tratar `422` de código, `429` e falhas.
- O recebido com o prazo da resposta e o "Mudou de ideia?".
- As outras 3 opções dizem que, por enquanto, o pedido é por e-mail.

### Scope Out

- API para "alguns dados", "sócio ou pagador" e "lista de espera".
- O link dos documentos por e-mail (DP-5612).
- Mudar o CORS ou qualquer coisa no backend; mudar a política e os prazos de texto.

### Acceptance Criteria

#### AC1: pedido do código neutro
Dado "Excluir minha conta" e o e-mail `ana@x.com`, quando a pessoa toca "Enviar código para o meu e-mail" e a API responde `202`, então aparece "Confirme que é você" com "Se houver um cadastro com an•••@x.com…", a mesma tela com ou sem conta, e o corpo enviado é só `{email, kind: "ACCOUNT"}`.

#### AC2: confirmação com o prazo da resposta
Dado o código `482913` e a resposta `200 {graceDays: 30}`, quando a pessoa toca "Excluir minha conta", então aparece "Pedido recebido" com "Sua conta foi desativada agora. A exclusão termina em 30 dias." e "Mudou de ideia? Entre de novo no app com seu e-mail e senha em até 30 dias e tudo volta como estava."; com `graceDays: 45`, o texto diz 45.

#### AC3: código errado ou vencido
Dado `422 VERIFICATION_CODE_INVALID`, então aparece "Código incorreto." e nada é excluído; dado `422 VERIFICATION_CODE_EXPIRED`, então a página pede um código novo.

#### AC4: espera por excesso de tentativas
Dado `429` com `Retry-After: 120`, então a página diz para tentar de novo em 2 minutos e não cai no e-mail.

#### AC5: reenviar
Dado a tela do código aberta há 60 s, então aparece "Reenviar código", que pede um novo código com o mesmo corpo neutro.

#### AC6: as outras opções seguem por e-mail
Dado "Sair da lista de espera" (ou "Apagar só alguns dados", ou "Sou sócio ou pagador"), quando a pessoa envia, então nenhuma chamada à API é feita e aparece "Mande seu pedido por e-mail", dizendo que por enquanto esse pedido é por e-mail.

#### AC7: falha cai no e-mail
Dado sem rede, CORS bloqueado, `5xx` ou `422 DELETION_KIND_NOT_SUPPORTED`, então aparece "Mande seu pedido por e-mail" e nenhum e-mail aparece em URL ou no console.
