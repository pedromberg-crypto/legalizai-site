---
name: design-responsivo
description: Regras e checklist obrigatórios pra qualquer trabalho de layout/CSS responsivo no legalizai-site (lp/, coming-soon/). Use sempre que for criar ou ajustar tamanho de fonte, espaçamento, breakpoint, ou "caber na tela" em qualquer página desse repo.
---

# Design responsivo — legalizai-site

Regra de ouro: **troca adjetivo por número**. "Deixa responsivo" não é
uma instrução executável; "cabe sem scroll em 600–900px de altura,
900–1920px de largura" é.

## Breakpoints deste projeto (não inventar outros)

Este é um site estático sem build (CSS puro, sem Tailwind) — os
breakpoints são os que já existem no CSS de cada página, não uma escala
genérica:

- **Mobile**: `< 900px` de largura. Layout empilhado, coluna única.
  **Rolagem normal é esperada e correta aqui** — não tentar caber tudo
  na tela em mobile.
- **Desktop**: `min-width:900px` **e** `min-height:600px` juntos (ver
  `@media` em `lp/em-breve/styles.css`). Layout 2 colunas. **Rolagem
  NÃO é aceitável aqui** — o conteúdo tem que caber sozinho.
- Larguras/alturas fora dessas duas faixas (ex.: width≥900 mas
  height<600) caem no CSS base (mobile), o que já é o comportamento
  correto — não é bug.

## Como caber sem rolagem no desktop (a técnica certa)

**Nunca** usar `transform:scale()` calculado via JS medindo
`offsetHeight` do conteúdo. Foi tentado nesse projeto e causou uma
classe inteira de bugs de overflow toda vez que a copy mudava (fórmula
ficava desatualizada). A técnica certa:

1. Tipografia e espaçamento em `clamp(piso, valor-fluido-em-vh, teto)`
   — encolhe/cresce sozinho com a altura da tela, sem JS.
2. `overflow-y:auto` na coluna que pode precisar de scroll — como REDE
   DE SEGURANÇA, nunca como mecanismo principal. Se ela estiver ativa
   em qualquer altura dentro do breakpoint desktop (600–900px+), é
   sinal de que algum `clamp()` está com o piso alto demais — ajustar o
   `clamp()`, não aceitar o scroll.
3. **Nunca `dvh` em regra que só roda em desktop.** `dvh` existe pra
   compensar barra de ferramentas dinâmica de mobile — não existe
   equivalente em desktop, e `dvh` tem suporte/cálculo inconsistente
   entre navegadores (mordeu esse projeto: Firefox mostrava scroll de
   página inteira que nunca aparecia no Chrome, mesmo código, mesmo
   viewport). Usar `vh` puro em regras `min-width:900px`.
4. `<html>` e `<body>` precisam do `overflow:hidden` **os dois,
   explícito no seletor** (`html, body.soon-body { ... }`), não só no
   body torcendo pra o navegador propagar sozinho — propagação de
   overflow body→viewport é inconsistente entre navegadores.

## Como testar (resize de janela real é furado neste ambiente)

Redimensionar a janela do Chrome via automação (`resize_window`) não é
confiável nesta sessão/ambiente — a largura fica presa no valor atual
da janela real na maioria das tentativas. **Não perder tempo tentando
de novo**: usar a técnica de iframe controlado, que dá viewport exato e
reproduzível:

```html
<!-- salvar em lp/viewport-test.html (mesma origem do server local,
     senão contentDocument trava por CORS) e DELETAR antes de commitar -->
<!doctype html>
<html><body style="margin:0">
<iframe id="f" src="/em-breve/" style="width:1366px;height:768px;border:0;display:block"></iframe>
</body></html>
```

Depois, via `mcp__claude-in-chrome__javascript_tool` na aba que abriu
esse arquivo:

```js
var iframe = document.getElementById('f');
[900, 768, 700, 650, 620, 600].forEach(function(h){
  iframe.style.height = h + 'px';
  var doc = iframe.contentDocument;
  var el = doc.querySelector('.soon-col-form'); // ou o container relevante
  console.log(h, el.scrollHeight - el.clientHeight); // 0 = sem overflow
});
```

`scrollHeight - clientHeight > 0` é overflow real, não "parece que tem
scroll" — é a forma programática de confirmar antes de dizer que
corrigiu.

### Checklist de verificação (rodar antes de considerar terminado)

Pra cada altura relevante do breakpoint desktop — **600, 650, 700, 768,
900px** (cobre notebook 13"/14" comum até monitor externo) — e largura
900px+:

- [ ] `scrollHeight - clientHeight === 0` (ou ≤1px, arredondamento) na
      coluna do form
- [ ] Sem scrollbar horizontal em nenhuma largura testada
- [ ] Nenhuma fonte abaixo de ~0.5rem / nenhum alvo de toque/clique
      menor que ~24×24px
- [ ] Testado com **hard reload** (`location.reload(true)` ou
      Ctrl+Shift+R) — o servidor local (`python -m http.server`) não
      manda `Cache-Control`, então o Chrome cacheia heuristicamente e
      pode mostrar CSS antigo mesmo depois de editar o arquivo. Sempre
      desconfiar de "parece diferente do que editei" antes de caçar bug
      de verdade — comparar primeiro via `curl` (local vs. produção,
      ignorando CRLF) pra descartar cache.

## Ao terminar de testar local

Sempre apagar o `viewport-test.html` antes de commitar — é ferramenta
de debug, não faz parte do site.
