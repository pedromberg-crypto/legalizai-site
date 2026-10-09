/* ============================================================
   LEGALIZEI · LP — 100% client-side, zero backend
   1. header sombra ao rolar
   2. scroll reveal (IntersectionObserver)
   3. marquee (duplica trilha p/ loop infinito + pausa)
   3c. carrossel de diferenciais (loop infinito + autoplay)
   4. lottie local (window.* dos assets/*-data.js) + pausa fora do viewport
   5. validador de CNAE (concierge simulado, acessível)
   ============================================================ */
(function () {
  'use strict';

  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = motionQuery.matches;

  /* ---------- 1. header ---------- */
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 3. marquee ---------- */
  // duplica o .mq-set (aria-hidden: leitor de tela lê a lista UMA vez);
  // sem gap no track, a largura do set = 50% exato → loop sem salto
  var marquee = document.querySelector('.marquee');
  var track = document.querySelector('.marquee-track');
  // 🔄 11/09 (pedido do Pedro): a faixa volta a ROLAR no mobile. Antes ela
  // quebrava em linhas abaixo de 720px, e a trilha virava um bloco de 12
  // linhas empilhadas ocupando meia tela. Agora o único motivo pra não rolar
  // é o usuário ter pedido menos movimento no sistema.
  var vaiRolar = !reduceMotion;
  if (track && !reduceMotion && vaiRolar) {
    var set = track.querySelector('.mq-set');
    var clone = set.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  // Pausa a faixa quando ela sai da viewport. A .marquee tem mask-image, o que
  // força uma camada de composição própria: sem isto, essa camada fica sendo
  // recomposta a cada frame durante a sessão inteira, mesmo com a dobra três
  // telas acima. Mesmo padrão já usado nas lotties logo abaixo.
  if (marquee && track && vaiRolar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        marquee.classList.toggle('paused', !e.isIntersecting);
      });
    }, { threshold: 0 }).observe(marquee);
  }
  // 🆕 11/09 — PAUSA POR TOQUE. No desktop o mecanismo de parada é o :hover.
  // Touch não tem hover, e sem isto o celular ficava sem NENHUM jeito de
  // parar a faixa (WCAG 2.2.2). Encostar o dedo na trilha pausa; soltar
  // retoma. `pointer` cobre dedo, caneta e mouse com um listener só.
  if (marquee && vaiRolar && window.PointerEvent) {
    var segurar = function () { marquee.classList.add('paused'); };
    var soltar = function () { marquee.classList.remove('paused'); };
    marquee.addEventListener('pointerdown', segurar, { passive: true });
    marquee.addEventListener('pointerup', soltar, { passive: true });
    marquee.addEventListener('pointercancel', soltar, { passive: true });
    marquee.addEventListener('pointerleave', soltar, { passive: true });
  }
  // Botão de pausa dedicado segue fora, a pedido do Pedro. Mecanismos de
  // parada hoje: hover (desktop), toque contínuo (mobile) e o
  // prefers-reduced-motion do sistema, que desliga a animação de vez.
  // No mobile o ponto deixou de existir: lá a faixa não anima.

  /* ---------- 3c. carrossel de diferenciais (REFATORADO) --------------------
     .difs-rail é só o VISOR (overflow:hidden). Quem se move é .difs-track,
     via transform:translateX — nunca scroll nativo. O JS é a ÚNICA fonte de
     verdade de "qual card está centralizado": ele não pergunta pro navegador
     onde as coisas pararam (a versão anterior fazia isso com scroll-snap +
     geometria, e empatava/desalinhava conforme a largura da tela); ele
     DECIDE pra onde o trilho vai e guarda essa decisão em `centeredIx`.

     LÓGICA DO LOOP CONTÍNUO (a parte que importa matematicamente):
     Os N cards ficam em fila no DOM, cada um com `data-ix` FIXO (identidade
     permanente, 0..N-1) que nunca muda mesmo quando o nó troca de posição.
     `centeredIx` é a POSIÇÃO (índice entre os filhos atuais de .difs-track)
     que está centralizada agora — não a identidade do card, a posição.

     Centralizar o card na posição `i`: com `step` = largura do card + gap,
     translateX = (larguraDoVisor / 2) − (i·step + largura/2).
     Isso é regra de 3 pura: o visor tem um centro fixo; a soma i·step chega
     na borda esquerda do card i dentro do trilho; some meia largura pra achar
     o centro DELE; a diferença entre os dois centros é quanto empurrar.

     Andar pra frente é sempre `centeredIx + 1` — nunca zera translateX pra
     "rebobinar". Quando esse +1 aterrissa a LOOKAHEAD passos (ou menos) do
     ÚLTIMO card do DOM atual, a MANUTENÇÃO do loop dispara — mas só depois
     que a animação de verdade tiver acabado (evento transitionend no
     PRÓPRIO track, filtrado por e.target, porque cada card também tem
     transição de transform/scale e isso borbulha). LOOKAHEAD > 1 (não só
     "exatamente no último") de propósito: relocar o card só quando ele já
     era o último fazia ele nascer DENTRO da zona de espreita (vinha de fora
     do DOM, o navegador nunca tinha desenhado ele ali) — lido como "aparece
     do nada". Relocando um passo mais cedo, ele já está esperando fora de
     quadro (à direita) antes de precisar espreitar, e entra em cena pela
     MESMA animação de deslizar que todo card usa:
       1. move o 1º filho de .difs-track pro FIM (track.appendChild) — o
          card que acabou de sair pela esquerda vira "o próximo depois do
          último", fisicamente, no DOM;
       2. como o card centralizado perdeu uma posição à esquerda dele,
          `centeredIx--` e o translateX é recalculado e aplicado SEM
          transição (transition:none → muda o transform → força reflow →
          devolve a transição) — a correção é geometricamente idêntica à
          posição de antes da mudança de DOM, então não existe salto visual.
     O PRÓXIMO passo (centeredIx+1 de novo) desliza pro card que acabou de
     virar o novo último filho — que é sempre o próximo da fila real — e o
     ciclo se repete pra sempre. Nunca há "rebobinar": só passos de +1 pra
     frente, intercalados com uma correção de posição que ninguém vê.

     is-active: LIMPA a NodeList inteira antes de acender exatamente um
     (nunca "soma" classe a um vencedor) — não tem como duas ficarem acesas
     ao mesmo tempo, porque a decisão nunca é incremental. */
  function initDifsRail() {
    var rail = document.querySelector('.difs-rail');
    var track = document.querySelector('.difs-track');
    if (!rail || !track) return;
    var cards = [].slice.call(track.children);
    if (!cards.length) return;
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    /* DIFS_CLONE_COUNT: o visor sangra até a borda real da tela (sem teto de
       largura — ver .difs-rail no CSS), então em monitor ultrawide ele PEDE
       mais cards espiando ao mesmo tempo do que os 6 reais dão conta de
       cobrir com reserva. A resposta certa é dar mais CONTEÚDO ao trilho, não
       encolher o visor (rodada anterior tentou isso e trocou "vão branco na
       borda da tela" por "card sumindo na borda de uma caixa no meio da
       tela" — mesmo bug, lugar diferente). 2 clones (18 nós) ainda deixava a
       reserva curta demais em monitor bem largo (medido: buraco na direita
       depois de umas voltas). 6 (42 nós) sobra confortável em qualquer
       largura razoável de tela, e 42 elementos pequenos não pesa em nada pro
       navegador — o mecanismo de "mover o 1º pro fim" (ver
       maybeShuffleForward) não sabe nem precisa saber que são clones, pra
       ele são só posições no DOM. Clones são aria-hidden (conteúdo idêntico
       ao original, leitor de tela não precisa ouvir a mesma frase 7x). */
    var DIFS_CLONE_COUNT = 6;
    for (var ci = 0; ci < DIFS_CLONE_COUNT; ci++) {
      cards.forEach(function (c) {
        var clone = c.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      });
    }

    var cardW = 0, gapPx = 0, step = 0, LOOKAHEAD = 2;
    function measure() {
      // offsetWidth, NUNCA getBoundingClientRect().width: o card em repouso
      // tem transform:scale(.78) (ver .dif-card no CSS) — getBoundingClientRect
      // devolve o tamanho JÁ PINTADO (com o scale aplicado), 22% menor que o
      // real. offsetWidth é a caixa de LAYOUT, transform nunca mexe nela.
      // Era essa a causa raiz do card ativo saindo do centro: cardW/step
      // vinham ~22% menores que o espaçamento de verdade entre os cards.
      cardW = cards[0].offsetWidth;
      var g = getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0';
      gapPx = parseFloat(g) || 0;
      step = cardW + gapPx;
      // quantos cards cabem no visor de uma vez (arredondado pra cima, +1 de
      // folga pro caso de sobra de meio-card em cada ponta) — é ESSE número,
      // não uma constante fixa, que decide com quantos passos de antecedência
      // relocar. O teto agora é o total de nós FÍSICOS (com clones), não só
      // os 6 originais — é justamente ter mais nós físicos que sobra reserva
      // pra cobrir monitor largo sem encolher o visor (ver DIFS_CLONE_COUNT).
      // +3, não +1: essa é a reserva que o carrossel mantém EM REGIME (ver
      // maybeShuffleForward) — curta demais e sobra só o que já ia aparecer
      // mesmo, sem folga pro caso de o navegador medir um pixel a mais ou o
      // usuário arrastar rápido.
      LOOKAHEAD = clamp(Math.ceil(rail.clientWidth / step) + 3, 2, track.children.length - 1);
    }
    measure();

    function computeTranslateX(domIx) {
      return (rail.clientWidth / 2) - (domIx * step + cardW / 2);
    }
    function setTrackX(px, animate) {
      if (animate && !reduceMotion) {
        track.style.transform = 'translateX(' + px + 'px)';
      } else {
        // instantâneo: mata a transição, muda, força reflow, devolve a
        // transição — sem isto o navegador anima até a correção também.
        track.style.transition = 'none';
        track.style.transform = 'translateX(' + px + 'px)';
        void track.offsetWidth;
        track.style.transition = '';
      }
    }

    function syncActive() {
      // TODOS os nós físicos (18, com os clones) — não só os 6 originais em
      // `cards`: qualquer um deles, clone ou não, pode estar centralizado
      // agora, e deixar um clone com .is-active preso quebraria a regra de
      // "nunca duas ao mesmo tempo".
      [].forEach.call(track.children, function (c) { c.classList.remove('is-active'); });
      var node = track.children[centeredIx];
      if (!node) return;
      node.classList.add('is-active');
    }

    // LOOKAHEAD (quantos passos antes do fim relocar o próximo card) é
    // recalculado em measure() a partir de quantos cards cabem no visor —
    // ver comentário lá. Fixo em 1 (só no último) fazia o card recém-movido
    // nascer DENTRO da zona de espreita; um valor que acompanha a largura
    // real garante reserva suficiente em qualquer tamanho de tela.
    function maybeShuffleForward() {
      // manutenção dispara quando o centro assenta a LOOKAHEAD passos (ou
      // menos) do fim do DOM atual — ver explicação matemática lá em cima.
      if (centeredIx < track.children.length - LOOKAHEAD) return;
      track.appendChild(track.firstElementChild);
      centeredIx -= 1;
      setTrackX(computeTranslateX(centeredIx), false);
    }

    // "01" — só interessa a quem já leva 3 (o card de largada, ~meio da
    // fila, ver DEFAULT_IX abaixo). Card 0 sempre existe.
    var DEFAULT_IX = Math.min(3, cards.length - 1);
    var centeredIx = DEFAULT_IX;

    function goTo(domIx, animate) {
      // limite é o total de nós FÍSICOS (18, com clones) — não os 6
      // originais: senão o avanço nunca alcançaria os clones que existem
      // exatamente pra dar reserva em tela larga.
      domIx = clamp(domIx, 0, track.children.length - 1);
      centeredIx = domIx;
      var reallyAnimate = animate && !reduceMotion;
      setTrackX(computeTranslateX(centeredIx), reallyAnimate);
      syncActive();
      // sem animação real não existe transitionend pra disparar a manutenção
      // do loop (reduced-motion, ou correções internas já instantâneas) —
      // então roda na mão, sempre idempotente/seguro de chamar.
      if (!reallyAnimate) maybeShuffleForward();
    }

    track.addEventListener('transitionend', function (e) {
      if (e.target !== track || e.propertyName !== 'transform') return;
      maybeShuffleForward();
    });

    // estado inicial: centraliza no card de largada. .difs-rail-wrap nasce
    // com .reveal (opacity:0 até entrar na viewport), então isso é invisível.
    goTo(DEFAULT_IX, false);
    // a Sora ainda não carregou quando initDifsRail roda (script defer corre
    // antes do @font-face trocar) — o reflow da fonte de verdade muda a
    // largura do card, e o translateX calculado com a fonte de fallback fica
    // velho. Recentraliza uma vez, sem animar, quando a fonte assentar.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); setTrackX(computeTranslateX(centeredIx), false); });
    }
    // Recentraliza sempre que a CAIXA do visor mudar de tamanho de verdade —
    // ResizeObserver, não só 'resize' da window. Motivo medido: com o teto
    // de max-width no .difs-rail (ver styles.css), a PRIMEIRA medição
    // (measure(), síncrona, no load) podia rodar antes do navegador aplicar
    // esse teto por completo, calculando o translateX inicial pra uma
    // largura de visor errada (mais larga que os 680px reais) — o card
    // "ativo" nascia deslocado pra direita, fora do centro. 'resize' da
    // window não pega essa janela porque a VIEWPORT não mudou, só a caixa do
    // elemento — por isso ResizeObserver (observa o elemento em si, reage a
    // QUALQUER motivo de mudança de tamanho, inclusive o CSS assentando) em
    // vez de só orientação/redimensionamento manual da janela. */
    var roTimer = null;
    function recenterInstant() {
      clearTimeout(roTimer);
      roTimer = setTimeout(function () { measure(); setTrackX(computeTranslateX(centeredIx), false); }, 80);
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(recenterInstant).observe(rail);
    } else {
      window.addEventListener('resize', recenterInstant);
    }

    /* --- autoplay: setInterval fixo de 2s ------------------------------------
       Pausa: hover/foco (mouse ou teclado parados em cima) e fora da
       viewport (mesmo truque do .marquee lá em cima) — sem botão de pausa
       dedicado, mesma decisão já tomada pro .marquee (WCAG 2.2.2 pede
       controle visível pra conteúdo que anda sozinho >5s; aqui no LAB
       hover/foco/reduced-motion cobrem o caso, revisitar se for pra
       produção). Reduced-motion nunca liga o autoplay. */
    var AUTOPLAY_DELAY = 4000;
    var autoplayTimer = null;
    function startAutoplay() {
      if (reduceMotion || autoplayTimer) return;
      autoplayTimer = setInterval(function () { goTo(centeredIx + 1, true); }, AUTOPLAY_DELAY);
    }
    function stopAutoplay() { clearInterval(autoplayTimer); autoplayTimer = null; }
    // qualquer interação manual (arraste, teclado) reinicia a contagem de
    // AUTOPLAY_DELAY a partir do card onde a pessoa parou.
    function resetAutoplay() { stopAutoplay(); startAutoplay(); }

    rail.addEventListener('mouseenter', stopAutoplay);
    rail.addEventListener('mouseleave', startAutoplay);
    // focusin/focusout (não focus/blur): precisam borbulhar pra pegar foco em
    // QUALQUER ponto/card dentro do trilho, não só no próprio elemento rail.
    rail.addEventListener('focusin', stopAutoplay);
    rail.addEventListener('focusout', function (e) {
      if (!rail.contains(e.relatedTarget)) startAutoplay();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) startAutoplay(); else stopAutoplay();
        });
      }, { threshold: 0 }).observe(rail);
    } else {
      startAutoplay();
    }

    rail.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      goTo(centeredIx + (e.key === 'ArrowRight' ? 1 : -1), true);
      resetAutoplay();
    });

    /* --- arrastar (mouse + touch, Pointer Events unifica os dois) -----------
       Sem overflow-x:auto não existe mais scroll nativo pra herdar o gesto de
       toque de graça (era assim na versão anterior) — por isso precisa
       reimplementar aqui, e agora serve os dois: um pointerdown/move/up só. */
    var isDown = false, startClientX = 0, startTranslate = 0, currentTranslate = 0;
    rail.addEventListener('pointerdown', function (e) {
      isDown = true;
      startClientX = e.clientX;
      startTranslate = computeTranslateX(centeredIx);
      currentTranslate = startTranslate;
      rail.classList.add('is-dragging');
      track.classList.add('is-dragging'); // mata a transição CSS enquanto segue o ponteiro
      if (rail.setPointerCapture) rail.setPointerCapture(e.pointerId);
      stopAutoplay();
    });
    rail.addEventListener('pointermove', function (e) {
      if (!isDown) return;
      currentTranslate = startTranslate + (e.clientX - startClientX);
      track.style.transform = 'translateX(' + currentTranslate + 'px)';
    });
    function endDrag() {
      if (!isDown) return;
      isDown = false;
      rail.classList.remove('is-dragging');
      track.classList.remove('is-dragging');
      // quantos cards o arraste "pediu" pra andar, arredondado pro mais perto
      var deltaSteps = Math.round((startTranslate - currentTranslate) / step);
      goTo(centeredIx + deltaSteps, true);
      resetAutoplay();
    }
    rail.addEventListener('pointerup', endDrag);
    rail.addEventListener('pointercancel', endDrag);
  }
  initDifsRail();


  /* ---------- 4. (vago) — a Lottie saiu daqui ----------
     ✂️ `initLotties()` e os dois `<script src>` (lottie.min.js + paperplane,
     313 KB juntos) foram removidos. O único id que este bloco procurava,
     `#lot-phone-plane`, era do hero ANTIGO: o hero atual (shapeShowcase) não
     tem lottie nenhuma, então a página baixava a biblioteca inteira pra animar
     ZERO elemento. Nada visual se perdeu — não havia nada acontecendo.
     Se um dia voltar animação Lottie, volta este bloco E os `<script src>`. */

  /* ---------- 3b. silhueta do painel de vidro (LAB) ----------
     A borda sobe do topo reto e contorna o topo do aparelho mantendo uma folga
     constante (--glass-pad) nas laterais, nos cantos e em cima. Percurso:
     topo reto → concordância côncava → parede vertical → canto (raio do
     aparelho + folga) → topo → espelha do outro lado.
     UM clip-path só: montar isso com várias divs de vidro encostadas não
     funciona, porque cada backdrop-filter desfoca o próprio fundo e as
     emendas ficam visíveis. */
  function shapeShowcase() {
    var sc = document.querySelector('.hero-showcase');
    if (!sc) return;
    var glass = sc.querySelector('.showcase-glass');
    if (!glass) return;

    var cs = getComputedStyle(sc);
    var px = function (name) { return parseFloat(cs.getPropertyValue(name)) || 0; };
    // --glass-pad, --fillet-r e as razões continuam px/número LITERAIS no css:
    // custom property com calc()/min() não resolve em getComputedStyle (vira
    // NaN) e o clip-path sairia zerado.
    var pad = px('--glass-pad');
    // --phone-w virou fluida (min() com vw) pra não estourar o documento no
    // mobile, então ela NÃO pode mais ser lida como px. Medimos o elemento: é a
    // mesma medida-mestre, vem do layout real e funciona em qualquer navegador,
    // sem depender de @property. getBoundingClientRect por causa do subpixel
    // (offsetWidth arredondaria os 379,2px do desktop pra 379).
    var phoneEl = sc.querySelector('.showcase-phone');
    var pw = phoneEl ? phoneEl.getBoundingClientRect().width : px('--phone-w');
    if (!pw) return;
    // derivados por proporção (mesmas razões usadas no css), pra que mexer só
    // em --phone-w redimensione aparelho e contorno juntos
    var ph   = pw * 2176 / 1070;
    var rise = ph * px('--phone-rise-ratio');
    var bw = pw + pad * 2;                        // largura do contorno
    var br = pw * px('--phone-r-ratio') + pad;    // canto do vidro = canto do aparelho + folga
    var b  = rise + pad;                          // altura do contorno acima do topo reto
    var f  = px('--fillet-r');
    var R  = 40;                          // raio dos cantos externos do painel

    var W = sc.offsetWidth;
    var H = sc.offsetHeight + b;          // a caixa do vidro sobe `b` acima do painel
    if (!W || !H) return;

    /* Raio da BASE do painel. Era canto vivo enquanto a .marquee-band tinha
       background:#fff — a faixa opaca cobria a base e escondia o corte. Sem ela
       (2026-08-17) a base ficava exposta e o card parecia cortado, então fecha
       no mesmo R dos cantos externos do topo.
       A altura do painel NÃO muda: o aparelho continua saindo por baixo.
       trava: o raio não pode passar de meia largura nem de metade do corpo
       (parte do path abaixo do topo, `topH`), senão os dois arcos se cruzam e a
       silhueta se enrola em viewport minúscula. */
    var baseR = function (topH) { return Math.max(0, Math.min(R, W / 2, (H - topH) / 2)); };

    // a parede vertical precisa existir entre o canto e a concordância
    if (b - f < br) f = Math.max(0, b - br);

    var cx = W / 2, xa = cx - bw / 2, xb = cx + bw / 2;

    /* Caso degenerado (mobile): o ressalto ocupa o painel inteiro, não sobra
       "ombro" pros cantos externos nem pras concordâncias. Isso acontece por
       construção abaixo de ~435px de viewport, onde --phone-w é o container
       menos duas folgas — ou seja bw === W e xa === 0.
       A silhueta então é só um retângulo com o topo arredondado no raio do
       aparelho + folga: o vidro continua abraçando o topo do mockup com
       exatamente --glass-pad em volta, que é a regra do componente. Antes disso
       o path saía com xa NEGATIVO e o contorno era desenhado 469px de largura
       (medido a 360px) num painel de 320 — o traço vazava pra fora do painel e
       a "borda que abraça o aparelho" simplesmente não existia no celular. */
    if (xa <= R) {
      // base no MESMO R do caso normal (não em `br`): `br` é o raio do aparelho
      // + folga e só faz sentido onde o contorno segue o mockup. Na base não há
      // aparelho pra seguir, então o canto é o do painel.
      var rf = baseR(br);
      var dFlat =
        'M 0 ' + br +
        ' A ' + br + ' ' + br + ' 0 0 1 ' + br + ' 0' +
        ' L ' + (W - br) + ' 0' +
        ' A ' + br + ' ' + br + ' 0 0 1 ' + W + ' ' + br +
        ' L ' + W + ' ' + (H - rf) +
        ' A ' + rf + ' ' + rf + ' 0 0 1 ' + (W - rf) + ' ' + H +   // base dir. (convexa, sweep 1 = horário)
        ' L ' + rf + ' ' + H +
        ' A ' + rf + ' ' + rf + ' 0 0 1 0 ' + (H - rf) +           // base esq.
        ' Z';
      apply(dFlat, W, H);
      return;
    }
    // a concordância não pode invadir o canto externo do painel: encolhe até
    // caber (transição suave entre o trilho degenerado e o ressalto cheio)
    f = Math.min(f, xa - R);

    var rb = baseR(b);
    var d =
      'M ' + R + ' ' + b +
      ' L ' + (xa - f) + ' ' + b +
      ' A ' + f + ' ' + f + ' 0 0 0 ' + xa + ' ' + (b - f) +   // côncava: horizontal → vertical
      ' L ' + xa + ' ' + br +
      ' A ' + br + ' ' + br + ' 0 0 1 ' + (xa + br) + ' 0' +   // canto sup. esq. (segue o do aparelho)
      ' L ' + (xb - br) + ' 0' +
      ' A ' + br + ' ' + br + ' 0 0 1 ' + xb + ' ' + br +      // canto sup. dir.
      ' L ' + xb + ' ' + (b - f) +
      ' A ' + f + ' ' + f + ' 0 0 0 ' + (xb + f) + ' ' + b +   // côncava: vertical → horizontal
      ' L ' + (W - R) + ' ' + b +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + W + ' ' + (b + R) +
      ' L ' + W + ' ' + (H - rb) +
      ' A ' + rb + ' ' + rb + ' 0 0 1 ' + (W - rb) + ' ' + H +   // base dir.
      ' L ' + rb + ' ' + H +
      ' A ' + rb + ' ' + rb + ' 0 0 1 0 ' + (H - rb) +           // base esq.
      ' L 0 ' + (b + R) +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + R + ' ' + b +
      ' Z';

    apply(d, W, H);

    // TRÊS consumidores do mesmo `d`: recorte do vidro, traço do svg e recorte
    // do aparelho. Contorno não acompanha clip-path, e qualquer divergência
    // entre os três vira emenda visível — por isso o path é gerado uma vez e
    // distribuído aqui, nunca recalculado em outro lugar.
    function apply(path, w, h) {
      var cp = 'path("' + path + '")';
      glass.style.clipPath = cp;
      glass.style.webkitClipPath = cp;
      // o aparelho passa a terminar DENTRO do card: o wrapper tem a mesma caixa
      // do vidro, então o mesmo path corta a base (e os cantos arredondados)
      // sem tocar no topo — o ressalto do path já envolve o topo do mockup com
      // --glass-pad de folga, logo nada do aparelho fica de fora lá em cima.
      var phoneClip = sc.querySelector('.showcase-phone-clip');
      if (phoneClip) {
        phoneClip.style.clipPath = cp;
        phoneClip.style.webkitClipPath = cp;
      }
      var outline = sc.querySelector('.showcase-outline');
      if (outline) {
        outline.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        outline.setAttribute('height', h);
        outline.querySelector('path').setAttribute('d', path);
      }
    }
  }
  var shapeQueued = false;
  function queueShape() {
    if (shapeQueued) return;
    shapeQueued = true;
    requestAnimationFrame(function () { shapeQueued = false; shapeShowcase(); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', shapeShowcase);
  } else {
    shapeShowcase();
  }
  window.addEventListener('resize', queueShape);
  window.addEventListener('load', shapeShowcase);   // fontes carregadas mudam a altura dos cards

  /* ---------- 4a. menu: item ativo segue a seção visível (LAB) ----------
     Antes o "Início" tinha .is-active fixo no HTML, então o realce nunca
     mudava. Marca pelo miolo da tela: a seção que cruza a linha de ~40% da
     viewport é a ativa. */
  function initNavSpy() {
    var links = [].slice.call(document.querySelectorAll('.header-nav a'));
    if (!links.length) return;

    // SÓ âncora interna: o menu tem <a href="/blog">, e querySelector('/blog')
    // lança SyntaxError. Como a chamada era síncrona no init, a exceção subia e
    // matava TODO o resto do arquivo — inclusive o validador (seção 5), que
    // ficava sem nenhum listener: chip não preenchia, CTA não fazia nada.
    var targets = links.map(function (a) {
      var id = a.getAttribute('href') || '';
      return { link: a, el: id.charAt(0) === '#' && id.length > 1 ? document.querySelector(id) : null };
    }).filter(function (t) { return t.el; });
    if (!targets.length) return;

    function setActive(link) {
      links.forEach(function (a) { a.classList.toggle('is-active', a === link); });
    }

    var ticking = false;
    function update() {
      ticking = false;
      var line = window.innerHeight * 0.4;
      var current = targets[0].link;
      targets.forEach(function (t) {
        if (t.el.getBoundingClientRect().top <= line) current = t.link;
      });
      // no topo absoluto, o primeiro item manda
      if (window.scrollY < 40) current = targets[0].link;
      setActive(current);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    links.forEach(function (a) { a.addEventListener('click', function () { setActive(a); }); });
    update();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavSpy);
  } else {
    initNavSpy();
  }

  /* ---------- 4b. céu do hero (LAB) ----------
     As formas saíram do cloud.json do Lottie (cada nuvem = 3 elipses fundidas),
     mas o RUNTIME do lottie foi descartado: 8 instâncias animando engasgavam a
     thread a ponto das transições de CSS avançarem ~40ms em 3s. O movimento do
     arquivo original é só translate + scale + fade, então roda em keyframes CSS
     — composto na GPU, custo praticamente zero.
     Cada camada entra por um lado, deriva pro centro, encolhe e some. */
  /* nuvem vai como background-image (data URI), não como <svg> no DOM: menos
     nós, um paint só por camada, nada de re-rasterizar árvore SVG. */
  /* o blur vai DENTRO do svg (feGaussianBlur), não em filter: blur() no CSS:
     assim a borda macia é rasterizada uma vez junto da imagem, em vez de custar
     um passe de filtro por frame em cada camada. viewBox leva folga pro blur
     não ser cortado na borda. */
  function svgURL(vb, ratio, blur, ellipses) {
    var body = ellipses.map(function (e) {
      return '<ellipse cx="' + e[0] + '" cy="' + e[1] + '" rx="' + e[2] + '" ry="' + e[3] + '"/>';
    }).join('');
    return {
      url: 'url("data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '">' +
        '<filter id="b" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feGaussianBlur stdDeviation="' + blur + '"/></filter>' +
        '<g fill="#fff" filter="url(%23b)">' + body + '</g></svg>'
      ) + '")',
      ratio: ratio
    };
  }
  var CLOUD_SHAPES = {
    a: svgURL('-143 -91 286 182', '286/182', 9, [
      [-6.023, -0.207, 60.719, 60.793],
      [57.822, 5.755, 55.178, 55.246],
      [-71.617, 19.566, 41.384, 41.434]
    ]),
    b: svgURL('-85.5 -63 171 126', '171/126', 7, [
      [-27.732, 4.741, 35.768, 36.259],
      [12.851, -8.227, 32.329, 32.773],
      [40.583, 12.352, 22.917, 23.232]
    ])
  };

  // x1/x2 em vw: onde a nuvem nasce (borda) e onde ela morre (perto do centro)
  var CLOUD_LAYERS = [
    { s:'a', top:'-6%',  w:'22%', o:.34, x1:'-56vw', x2:'-12vw', y:'4%',  s1:1.00, s2:.58, dur:26, delay:-2  },
    { s:'b', top:'0%',   w:'17%', o:.30, x1:'54vw',  x2:'10vw',  y:'6%',  s1:1.10, s2:.60, dur:31, delay:-9  },
    { s:'b', top:'10%',  w:'13%', o:.24, x1:'-52vw', x2:'-6vw',  y:'5%',  s1:.90,  s2:.52, dur:24, delay:-16 },
    { s:'a', top:'15%',  w:'19%', o:.22, x1:'58vw',  x2:'8vw',   y:'-4%', s1:1.05, s2:.55, dur:34, delay:-5  },
    { s:'b', top:'25%',  w:'15%', o:.18, x1:'-58vw', x2:'-8vw',  y:'-6%', s1:.95,  s2:.50, dur:29, delay:-21 },
    { s:'a', top:'31%',  w:'11%', o:.20, x1:'52vw',  x2:'6vw',   y:'5%',  s1:.85,  s2:.48, dur:22, delay:-12 },
    { s:'b', top:'40%',  w:'16%', o:.14, x1:'-54vw', x2:'-10vw', y:'3%',  s1:1.00, s2:.55, dur:37, delay:-27 },
    { s:'a', top:'47%',  w:'13%', o:.12, x1:'56vw',  x2:'7vw',   y:'-3%', s1:.90,  s2:.50, dur:28, delay:-33 }
  ];

  function initSky() {
    var sky = document.getElementById('hero-sky');
    if (!sky) return;
    if (/[?&]sky=0/.test(location.search)) return; // LAB: ?sky=0 desliga o céu

    CLOUD_LAYERS.forEach(function (cfg) {
      var el = document.createElement('div');
      el.className = 'hero-cloud';
      el.style.setProperty('--top', cfg.top);
      el.style.setProperty('--w',   cfg.w);
      el.style.setProperty('--o',   cfg.o);
      el.style.setProperty('--x1',  cfg.x1);
      el.style.setProperty('--x2',  cfg.x2);
      el.style.setProperty('--y',   cfg.y);
      el.style.setProperty('--s1',  cfg.s1);
      el.style.setProperty('--s2',  cfg.s2);
      el.style.setProperty('--dur', cfg.dur + 's');
      // delay negativo = nasce já no meio do ciclo, evita todas entrarem juntas
      el.style.setProperty('--delay', cfg.delay + 's');
      el.style.setProperty('--img', CLOUD_SHAPES[cfg.s].url);
      el.style.setProperty('--ratio', CLOUD_SHAPES[cfg.s].ratio);
      sky.appendChild(el);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSky);
  } else {
    initSky();
  }

  // (este listener de `prefers-reduced-motion` existia só pra congelar as
  //  lotties quando a pessoa ligava "reduzir movimento" com a página aberta.
  //  Saiu junto com elas — as demais animações consultam `reduceMotion` na
  //  hora de rodar, então não precisam de um observador vivo.)

  /* ============================================================
     5. VALIDADOR DE CNAE — "IA" simulada client-side
     (mesma whitelist real do app)
     ============================================================ */
  var OK = {
    web:         { emoji: '💻', nome: 'Criação de sites e web design', desc: 'Você entrega sites e presença digital pra outras empresas.', cnae: 'CNAE 6201-5/02' },
    software:    { emoji: '⚙️', nome: 'Desenvolvimento de software',   desc: 'Você cria sistemas e programas sob encomenda.',              cnae: 'CNAE 6201-5/01' },
    design:      { emoji: '🎨', nome: 'Design e criação visual',       desc: 'Você cria identidade, layouts e peças pra marcas.',          cnae: 'CNAE 7410-2/99' },
    foto:        { emoji: '📸', nome: 'Fotografia',                    desc: 'Você produz fotos pra pessoas, marcas ou eventos.',          cnae: 'CNAE 7420-0/01' },
    mkt:         { emoji: '📣', nome: 'Marketing e publicidade',       desc: 'Você cuida da divulgação e das vendas de outras empresas.',  cnae: 'CNAE 7319-0/03' },
    consult:     { emoji: '🧭', nome: 'Consultoria empresarial',       desc: 'Você orienta a gestão e a estratégia de negócios.',          cnae: 'CNAE 7020-4/00' },
    restaurante: { emoji: '🍽️', nome: 'Restaurante e alimentação',     desc: 'Você serve comida no local ou pra viagem.',                  cnae: 'CNAE 5611-2/01' }
  };

  var WAIT = {
    medico:     { area: 'atividades médicas',   motivo: 'É uma atividade regulamentada (precisa de registro no conselho), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    advogado:   { area: 'advocacia',            motivo: 'A advocacia tem regras próprias da OAB, então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    transporte: { area: 'transporte de cargas', motivo: 'Hoje a gente cuida de quem vive de prestar serviço — transporte tem regras e rotina bem diferentes. Ainda não é a nossa praia, por enquanto.' }
  };

  /* --- lista de "não encontrei minha categoria" ---------------------------
     Trazida da tela real do app (`EnderecoCategoriaView`, lista `REGULAMENTADAS`
     de `entrada-lead.tsx`): as atividades regulamentadas mais comuns que
     esbarram na mesma barreira (registro em conselho profissional), mais
     "Comércio" como catch-all de quem revende produto (fora do modelo de
     serviço) e "outra" pra quem não é nenhuma das duas coisas. Todas viram
     '__wait': ninguém que caiu em "não encontrei" tinha como dar match verde
     — a lista só existe pra dar um motivo honesto em vez de silêncio. */
  var WAIT_REG = {
    comercio:    { area: 'comércio',                motivo: 'Hoje a gente atende só quem presta serviço, sem revenda de produto físico. Comércio tem regras fiscais bem diferentes, então ainda não é a nossa praia.' },
    engenharia:  { area: 'engenharia',               motivo: 'É uma atividade regulamentada (precisa de registro no CREA), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    medicina:    { area: 'medicina',                 motivo: 'É uma atividade regulamentada (precisa de registro no CRM), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    odontologia: { area: 'odontologia',               motivo: 'É uma atividade regulamentada (precisa de registro no CRO), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    advocacia:   { area: 'advocacia',                motivo: 'A advocacia tem regras próprias da OAB, então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    contabilidade:{ area: 'contabilidade',           motivo: 'É uma atividade regulamentada (precisa de registro no CRC), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    psicologia:  { area: 'psicologia',               motivo: 'É uma atividade regulamentada (precisa de registro no CRP), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    nutricao:    { area: 'nutrição',                 motivo: 'É uma atividade regulamentada (precisa de registro no CRN), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    fisioterapia:{ area: 'fisioterapia',             motivo: 'É uma atividade regulamentada (precisa de registro no CREFITO), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    arquitetura: { area: 'arquitetura',               motivo: 'É uma atividade regulamentada (precisa de registro no CAU), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    corretagem:  { area: 'corretagem de imóveis',    motivo: 'É uma atividade regulamentada (precisa de registro no CRECI), então a gente ainda não automatizou esse caso com a segurança que você merece. Estamos chegando lá.' },
    // "outra": area é preenchida em runtime com o texto que a pessoa digitou
    // (ver o branch '__reg_outra' no clique do go), não dá pra saber antes.
    outra:       { area: 'essa atividade',           motivo: 'Ainda não reconhecemos essa atividade na nossa lista, mas queremos entender melhor pra saber se cabe.' }
  };
  var REGULAMENTADAS_ORDEM = ['comercio','engenharia','medicina','odontologia','advocacia','contabilidade','psicologia','nutricao','fisioterapia','arquitetura','corretagem'];

  // \bapp\b: não casa "WhatsApp" · \bbar\b: não casa "barbearia"
  var MATCH = [
    [/site|web|p[áa]gina|landing/i,                                          ['web']],
    [/software|sistema|\bapp\b|aplicativo|desenvolv|programa[çc]|programa/i, ['software']],
    [/design|logo|logotipo|identidade|marcas?\b|layout|ilustra/i,            ['design']],
    [/foto|fot[óo]graf/i,                                                    ['foto']],
    [/marketing|publicidade|an[úu]ncio|tr[áa]fego|social media|divulga/i,    ['mkt']],
    [/consultor|consultoria|mentor|assessoria/i,                             ['consult']],
    [/restaurante|lanche|comida|\bbar\b|pizzaria|hamburgu|food|aliment/i,    ['restaurante']],
    [/m[ée]dic|consult[óo]rio|cl[íi]nic|dentist|sa[úu]de/i,                  ['__wait', 'medico']],
    [/advog|advocac|jur[íi]dic|direito/i,                                    ['__wait', 'advogado']],
    [/transport|frete|carga|caminh[ãa]o|motoboy|motorista|entregador/i,      ['__wait', 'transporte']]
  ];

  var CODES = {
    '6201502': ['web'], '6201501': ['software'], '7410299': ['design'],
    '7420001': ['foto'], '7319003': ['mkt'], '7020400': ['consult'], '5611201': ['restaurante'],
    '8630503': ['__wait', 'medico'], '6911701': ['__wait', 'advogado']
  };

  function digits(s) { return (s || '').replace(/\D/g, ''); }
  function $(id) { return document.getElementById(id); }

  var secAsk = $('v-ask'), secCode = $('v-code'), secThink = $('v-think'),
      secOk = $('v-ok'), secWait = $('v-wait');
  var input = $('v-input'), go = $('v-go'), retry = $('v-retry'), live = $('v-live');
  // BUGFIX (achado montando /_lab/blog): página sem o validador (ex.: blog)
  // não tem #v-input, e a próxima linha (input.placeholder) lançava TypeError
  // sem isso aqui — mesma causa-raiz já documentada no initNavSpy() acima
  // ("a exceção subia e matava TODO o resto do arquivo"). Como esta seção 5
  // roda solta no corpo da IIFE (não dentro de uma function própria), o throw
  // também derrubava tudo que viria DEPOIS dela no arquivo. Hoje não sobra
  // nada depois (é a última seção), mas o guard fica pra proteger a próxima
  // seção que alguém acrescentar.
  if (!input) return;
  // placeholder original, pra devolver se a pessoa voltar de "não encontrei"
  // pra uma categoria de verdade (ver catSelect mais abaixo).
  var inputPlaceholderDefault = input.placeholder;
  var inputPlaceholderOutros = 'Ex: sou advogado, sou médico, tenho um comércio…';
  // idem pro texto do CTA: "qual melhor atende" pressupõe que alguma das 14
  // categorias serve — em "não encontrei" a pergunta volta a ser a mais crua,
  // "vocês atendem isso ou não" (ver goTextDefault mais abaixo).
  var goTextDefault = go.textContent;
  var goTextOutros = 'Ver se me atendem';
  var codeInput = $('v-code-input'), codeGo = $('v-code-go'), codeErr = $('v-code-err');
  var concierge = document.querySelector('.concierge');
  var sheet = document.querySelector('.c-sheet');

  /* --- altura da folha: interpola, não trava ------------------------------
     ANTES existia lockMinHeight(): gravava a altura do estado de entrada em
     --c-min-h e usava como PISO. Resolvia o salto de layout (medido: o card
     encolhia ~480px ao sair da pergunta pro "pensando" e a página inteira
     pulava), mas cobrava barriga de branco — a 1280 sobravam 34px no #v-ok e
     78px no #v-wait, porque os dois são mais curtos que a pergunta.
     Agora a folha vai de A pra B continuamente (FLIP de altura):
       1. mede onde ela ESTÁ (getBoundingClientRect pega o valor interpolado se
          houver uma transição em curso — trocar de estado no meio de outra
          troca não colapsa);
       2. limpa a altura inline e mede o natural do estado NOVO;
       3. fixa a de origem, força um reflow (sem ele o browser junta as duas
          escritas no mesmo estilo computado e não há transição) e escreve a de
          destino.
     Ao fim volta pra `height:auto`. É isso que mantém a caixa correta no
     resize, quando a Sora carrega e quando o textarea cresce — sem precisar de
     nenhum listener remedindo nada, e sem risco de reflow em laço.
     Reduced motion: nem entra aqui, a altura muda direto (e o CSS já desliga
     transition com !important, então transitionend nunca dispararia — a altura
     inline ficaria grudada). */
  var morphTimer = null;
  function endMorph() {
    if (!sheet) return;
    window.clearTimeout(morphTimer);
    sheet.style.height = '';
    sheet.classList.remove('is-morphing');
  }
  if (sheet) {
    sheet.addEventListener('transitionend', function (e) {
      if (e.propertyName === 'height' && e.target === sheet) endMorph();
    });
  }
  function morphSheet(swap) {
    if (!sheet || reduceMotion) { swap(); if (sheet) endMorph(); return; }
    var from = sheet.getBoundingClientRect().height;
    swap();
    sheet.style.height = '';
    var to = sheet.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) { endMorph(); return; }
    sheet.classList.add('is-morphing');
    sheet.style.height = from + 'px';
    void sheet.offsetHeight;               // reflow proposital: ver passo 3 acima
    sheet.style.height = to + 'px';
    // rede de segurança: se a transição for cancelada (aba em background, troca
    // de estado no meio), transitionend não vem e a altura inline travaria
    window.clearTimeout(morphTimer);
    morphTimer = window.setTimeout(endMorph, 900);
  }

  function show(sec) {
    morphSheet(function () {
      [secAsk, secCode, secThink, secOk, secWait].forEach(function (s) { s.classList.add('hidden'); });
      sec.classList.remove('hidden');
    });
  }
  function announce(text) { live.textContent = text; }

  // textarea cresce com o texto (2 linhas fixas cortavam a resposta de quem
  // escreve mais). Teto de 6 linhas pra não empurrar o CTA pra fora da tela.
  var TA_MAX = 6 * 24 + 8;
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, TA_MAX) + 'px';
  }

  /* habilita o CTA por 2 réguas diferentes dependendo do caminho: a normal
     (texto livre, >=2 caracteres) ou a de "não encontrei" (2º dropdown
     escolhido, e se for "é outra atividade", o textarea dele também
     preenchido). `categoria`/`regCategoria` são declaradas mais abaixo neste
     mesmo escopo — function declaration é hoisted, então já pode ser chamada
     daqui, mas só passa a fazer sentido depois que as duas existirem. */
  function updateGoDisabled() {
    if (categoria === '__outros') {
      go.disabled = !regCategoria || (regCategoria === '__reg_outra' && regOutraInput.value.trim().length < 2);
    } else {
      go.disabled = input.value.trim().length < 2;
    }
  }

  input.addEventListener('input', function () {
    updateGoDisabled();
    retry.classList.add('hidden');
    input.removeAttribute('aria-invalid');
    autoGrow();
  });

  /* --- trilha de etapas (coluna esquerda) ------------------------------------
     Espelha em qual .c-step o wizard está. UMA função redesenha as 3 do zero
     a cada chamada (limpa is-active/is-done, marca de novo) em vez de ficar
     somando/tirando classe em pontos espalhados — mais fácil de garantir que
     nunca sobra estado velho (ex.: dar "refazer" depois do resultado tem que
     apagar o "concluída" da etapa 3 sem um handler dedicado pra isso). */
  var STEP_ORDER = ['tipo', 'cnae', 'resultado'];
  var stepItems = {};
  STEP_ORDER.forEach(function (k) { stepItems[k] = $('v-step-item-' + k); });
  function setActiveStep(key) {
    var ix = STEP_ORDER.indexOf(key);
    STEP_ORDER.forEach(function (k, i) {
      var el = stepItems[k];
      if (!el) return;
      el.classList.remove('is-active', 'is-done');
      if (i < ix) el.classList.add('is-done');
      else if (i === ix) el.classList.add('is-active');
    });
  }

  /* --- tipo de empresa (MEI × ME) — passo 1 do wizard -----------------------
     Só CAPTURA a escolha por enquanto: MEI e ME usam tabelas de CNAE diferentes,
     mas a tabela ainda não chegou — resolve()/MATCH acima continuam intocados.
     tipoEmpresa fica pronta pro dia em que isso for ligado a sério; nenhuma
     opção aqui muda o resultado hoje.
     Escolher já AVANÇA o wizard (card é passo 1, o resto do formulário é passo
     2). .c-step-off (não .hidden) — os dois passos ficam empilhados na MESMA
     célula de grid o tempo todo (ver .c-wizard em styles.css), então trocar
     não muda a altura do card; .hidden tiraria o passo escondido do cálculo
     de altura da linha, que é exatamente o que essa técnica evita.
     Volta é o botão .c-back — não limpa a escolha, só troca qual .c-step está
     visível, então quem volta vê o card já marcado. */
  var tipoEmpresa = null;
  var stepTipo = $('v-step-tipo'), stepCnae = $('v-step-cnae'), tipoBackLabel = $('v-tipo-back-label');
  [].slice.call(document.querySelectorAll('input[name="v-tipo"]')).forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (!radio.checked) return;
      tipoEmpresa = radio.value; // 'mei' | 'me'
      if (tipoBackLabel) tipoBackLabel.textContent = radio.value === 'mei' ? 'MEI' : 'ME';
      if (stepTipo && stepCnae) {
        stepTipo.classList.add('c-step-off');
        stepCnae.classList.remove('c-step-off');
      }
      setActiveStep('cnae');
    });
  });
  var tipoBackBtn = $('v-tipo-back');
  if (tipoBackBtn && stepTipo && stepCnae) {
    tipoBackBtn.addEventListener('click', function () {
      stepCnae.classList.add('c-step-off');
      stepTipo.classList.remove('c-step-off');
      setActiveStep('tipo');
    });
  }

  /* --- dropdown de categoria -------------------------------------------------
     Substitui os 10 chips de sugestão. Padrão ARIA "listbox button": um botão
     (aria-haspopup=listbox) expande uma role=listbox — não é combobox de busca,
     a lista é fixa e fechada (14 itens), então não há campo de texto pra
     digitar/filtrar.
     A escolha fica em `categoria` (mesmo gancho de tipoEmpresa, pra fase 2) e
     PROPOSITALMENTE não reescreve o textarea: o textarea segue sendo a fonte
     do match por regex, calibrado pra frase coloquial ("sou designer"); jogar
     ali o rótulo amplo da categoria ("Design", "Ensino e cursos"...) mudaria
     de vocabulário sem tocar em MATCH, e o match quebraria silenciosamente. */
  var categoria = null;
  var catRoot = $('v-cat'), catTrigger = $('v-cat-trigger'), catValue = $('v-cat-value'), catList = $('v-cat-list');
  var catOptions = catList ? [].slice.call(catList.querySelectorAll('[role="option"]')) : [];
  var catActiveIx = -1;

  function catSetActive(ix) {
    if (catActiveIx >= 0 && catOptions[catActiveIx]) catOptions[catActiveIx].classList.remove('is-active');
    catActiveIx = ix;
    var opt = catOptions[catActiveIx];
    if (!opt) { catList.removeAttribute('aria-activedescendant'); return; }
    opt.classList.add('is-active');
    catList.setAttribute('aria-activedescendant', opt.id);
    opt.scrollIntoView({ block: 'nearest' });
  }
  function catSelectedIx() {
    for (var i = 0; i < catOptions.length; i++) {
      if (catOptions[i].getAttribute('aria-selected') === 'true') return i;
    }
    return -1;
  }
  function catOpen() {
    if (!catList.classList.contains('hidden')) return;
    catList.classList.remove('hidden');
    catTrigger.setAttribute('aria-expanded', 'true');
    var startIx = catSelectedIx();
    catSetActive(startIx >= 0 ? startIx : 0);
    catList.focus();
  }
  // focusTrigger=false só quando o foco já está indo pra outro lugar (Tab) —
  // devolver o foco ao trigger nesse caso prenderia quem está navegando.
  function catClose(focusTrigger) {
    if (catList.classList.contains('hidden')) return;
    catList.classList.add('hidden');
    catTrigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger !== false) catTrigger.focus();
  }
  /* "Não encontrei minha categoria" (15ª opção, data-other) não é uma
     categoria — é sinal de que nenhuma das 14 serviu. Guarda '__outros' em vez
     do rótulo, pra decidir sem comparar string. O rótulo na tela continua o
     texto normal da opção.
     🔄 trazido do app (tela `EnderecoCategoriaView`, o dropdown de
     REGULAMENTADAS): '__outros' costumava só trocar placeholder/CTA e deixar
     o textarea original resolver por regex — agora abre o 2º dropdown
     (.c-outros) com a lista curta de atividades regulamentadas + "é outra",
     que é o que de fato decide o desfecho (sempre '__wait', ver go.click). */
  function catSelect(ix) {
    var opt = catOptions[ix];
    if (!opt) return;
    catOptions.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
    opt.setAttribute('aria-selected', 'true');
    categoria = opt.dataset.other ? '__outros' : opt.textContent.trim();
    catValue.textContent = opt.textContent.trim();
    catTrigger.classList.add('is-filled');
    // exemplo do placeholder muda junto: em "não encontrei" ele deixa de sugerir
    // o que a gente atende (site, design...) e passa a mostrar o que a gente
    // JÁ SABE que não atende ainda — é o cenário que essa opção existe pra cobrir.
    input.placeholder = opt.dataset.other ? inputPlaceholderOutros : inputPlaceholderDefault;
    go.textContent = opt.dataset.other ? goTextOutros : goTextDefault;

    var wantOutros = !!opt.dataset.other;
    if (splitEl.classList.contains('is-outros') !== wantOutros) {
      morphSheet(function () {
        splitEl.classList.toggle('is-outros', wantOutros);
        outrosBlock.classList.toggle('hidden', !wantOutros);
        if (!wantOutros) resetReg();
      });
    }
    updateGoDisabled();
  }

  if (catRoot && catTrigger && catList) {
    catTrigger.addEventListener('click', function () {
      if (catList.classList.contains('hidden')) catOpen(); else catClose();
    });
    // seta/enter/espaço no botão fechado já abrem a lista (comportamento nativo
    // de <select>) em vez de exigir um clique extra só pra entrar nela
    catTrigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        catOpen();
      }
    });
    catList.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); catSetActive(Math.min(catActiveIx + 1, catOptions.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); catSetActive(Math.max(catActiveIx - 1, 0)); }
      else if (e.key === 'Home') { e.preventDefault(); catSetActive(0); }
      else if (e.key === 'End') { e.preventDefault(); catSetActive(catOptions.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var chosen = catOptions[catActiveIx];
        catSelect(catActiveIx);
        // "não encontrei": fecha sem devolver foco ao trigger e já joga o
        // cursor no textarea — é pra lá que a pessoa precisa ir agora.
        if (chosen && chosen.dataset.other) { catClose(false); input.focus(); }
        else catClose();
      }
      else if (e.key === 'Escape') { e.preventDefault(); catClose(); }
      else if (e.key === 'Tab') { catClose(false); }
    });
    catOptions.forEach(function (opt, ix) {
      opt.addEventListener('click', function () {
        catSetActive(ix);
        catSelect(ix);
        if (opt.dataset.other) { catClose(false); input.focus(); }
        else catClose();
      });
    });
    // clique fora fecha sem escolher (padrão de qualquer dropdown nativo)
    document.addEventListener('click', function (e) {
      if (!catList.classList.contains('hidden') && !catRoot.contains(e.target)) catClose(false);
    });
  }

  /* --- 2º dropdown: "não encontrei minha categoria" --------------------------
     Mesmo padrão ARIA do dropdown principal (listbox button), reaproveitado
     porque a mecânica é idêntica — só o que cada escolha SIGNIFICA muda
     (aqui, toda escolha termina em '__wait', nunca em match verde: quem chegou
     aqui já disse que nenhuma das 14 categorias reais serve). */
  var regCategoria = null; // um id de REGULAMENTADAS_ORDEM, ou '__reg_outra', ou null
  var splitEl = document.querySelector('.c-split');
  var outrosBlock = $('v-outros');
  var regRoot = $('v-reg'), regTrigger = $('v-reg-trigger'), regValue = $('v-reg-value'), regList = $('v-reg-list');
  var regOptions = regList ? [].slice.call(regList.querySelectorAll('[role="option"]')) : [];
  var regOutraWrap = $('v-reg-outra-wrap'), regOutraInput = $('v-reg-outra');
  var regActiveIx = -1;

  function regSetActive(ix) {
    if (regActiveIx >= 0 && regOptions[regActiveIx]) regOptions[regActiveIx].classList.remove('is-active');
    regActiveIx = ix;
    var opt = regOptions[regActiveIx];
    if (!opt) { regList.removeAttribute('aria-activedescendant'); return; }
    opt.classList.add('is-active');
    regList.setAttribute('aria-activedescendant', opt.id);
    opt.scrollIntoView({ block: 'nearest' });
  }
  function regSelectedIx() {
    for (var i = 0; i < regOptions.length; i++) {
      if (regOptions[i].getAttribute('aria-selected') === 'true') return i;
    }
    return -1;
  }
  function regOpen() {
    if (!regList.classList.contains('hidden')) return;
    regList.classList.remove('hidden');
    regTrigger.setAttribute('aria-expanded', 'true');
    var startIx = regSelectedIx();
    regSetActive(startIx >= 0 ? startIx : 0);
    regList.focus();
  }
  function regClose(focusTrigger) {
    if (regList.classList.contains('hidden')) return;
    regList.classList.add('hidden');
    regTrigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger !== false) regTrigger.focus();
  }
  function regSelect(ix) {
    var opt = regOptions[ix];
    if (!opt) return;
    regOptions.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
    opt.setAttribute('aria-selected', 'true');
    regCategoria = opt.dataset.outra ? '__reg_outra' : REGULAMENTADAS_ORDEM[ix];
    regValue.textContent = opt.textContent.trim();
    regTrigger.classList.add('is-filled');
    var wantOutra = !!opt.dataset.outra;
    if (regOutraWrap.classList.contains('hidden') === wantOutra) {
      morphSheet(function () { regOutraWrap.classList.toggle('hidden', !wantOutra); });
    }
    if (!wantOutra) regOutraInput.value = '';
    if (wantOutra) regOutraInput.focus();
    updateGoDisabled();
  }
  function resetReg() {
    regCategoria = null;
    regValue.textContent = 'Escolhe uma atividade';
    regTrigger.classList.remove('is-filled');
    regOptions.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
    regActiveIx = -1;
    regOutraWrap.classList.add('hidden');
    regOutraInput.value = '';
  }

  if (regRoot && regTrigger && regList) {
    regTrigger.addEventListener('click', function () {
      if (regList.classList.contains('hidden')) regOpen(); else regClose();
    });
    regTrigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        regOpen();
      }
    });
    regList.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); regSetActive(Math.min(regActiveIx + 1, regOptions.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); regSetActive(Math.max(regActiveIx - 1, 0)); }
      else if (e.key === 'Home') { e.preventDefault(); regSetActive(0); }
      else if (e.key === 'End') { e.preventDefault(); regSetActive(regOptions.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var chosen = regOptions[regActiveIx];
        regSelect(regActiveIx);
        if (chosen && chosen.dataset.outra) { regClose(false); } else regClose();
      }
      else if (e.key === 'Escape') { e.preventDefault(); regClose(); }
      else if (e.key === 'Tab') { regClose(false); }
    });
    regOptions.forEach(function (opt, ix) {
      opt.addEventListener('click', function () {
        regSetActive(ix);
        regSelect(ix);
        regClose(!opt.dataset.outra);
      });
    });
    document.addEventListener('click', function (e) {
      if (!regList.classList.contains('hidden') && !regRoot.contains(e.target)) regClose(false);
    });
    regOutraInput.addEventListener('input', updateGoDisabled);
  }

  // atividade regulamentada no texto SEMPRE vence match verde
  // (falso "não" vira lead na waitlist; falso "sim" vira promessa quebrada)
  function resolve(text) {
    var firstOk = null, firstWait = null;
    for (var i = 0; i < MATCH.length; i++) {
      if (!MATCH[i][0].test(text)) continue;
      if (MATCH[i][1][0] === '__wait') { if (!firstWait) firstWait = MATCH[i][1]; }
      else if (!firstOk) { firstOk = MATCH[i][1]; }
    }
    return firstWait || firstOk;
  }

  function present(key) {
    if (!key) { // não entendeu → mensagem persistente, texto do usuário preservado
      // o erro sai do hidden ANTES do show: a folha mede a altura de destino
      // dentro de morphSheet, e revelar a linha depois faria a caixa dar um
      // pulinho de 30px logo em seguida à transição
      retry.classList.remove('hidden');
      show(secAsk);
      // o aria-describedby do textarea aponta pro #v-retry: com aria-invalid, o
      // leitor lê campo + motivo quando o foco volta, sem segunda live region
      input.setAttribute('aria-invalid', 'true');
      announce('Não achei sua atividade. Conte com mais detalhe o que você faz.');
      input.focus();
      return;
    }
    setActiveStep('resultado'); // chegou num veredito de verdade (__wait, __wait_reg ou OK)
    if (key[0] === '__wait' || key[0] === '__wait_reg') {
      var w = key[0] === '__wait' ? WAIT[key[1]] : WAIT_REG[key[1]];
      $('v-wait-area').textContent = w.area;
      $('v-wait-motivo').textContent = w.motivo;
      $('v-wait-done').classList.add('hidden');
      show(secWait);
      announce('Ainda não atendemos ' + w.area + '. Deixe seu e-mail que avisamos quando abrir.');
      secWait.focus();
    } else {
      var r = OK[key[0]];
      $('v-ok-emoji').textContent = r.emoji;
      $('v-ok-nome').textContent = r.nome;
      $('v-ok-desc').textContent = r.desc;
      $('v-ok-cnae').textContent = r.cnae;
      show(secOk);
      announce('Boa notícia: a gente cuida de você. ' + r.nome + ', ' + r.cnae + '.');
      secOk.focus();
    }
  }

  /* A barra do "pensando" é DETERMINADA: a duração da animação é a mesma do
     setTimeout que traz o resultado, então ela chega no fim junto com a
     resposta. Fonte única aqui, entregue ao CSS por --think-dur. */
  var THINK_MS = 1200;   // caminho "descreve o que faz"
  var CODE_MS = 900;     // caminho "já sei meu CNAE" (não há texto pra ler)
  function think(ms) {
    secThink.style.setProperty('--think-dur', ms + 'ms');
    show(secThink);
  }

  go.addEventListener('click', function () {
    // "não encontrei": quem chegou aqui já disse que nenhuma das 14 serve,
    // então o desfecho é sempre '__wait_reg' — não passa pelo resolve()/MATCH
    // do textarea original (que está escondido, ver .c-split.is-outros).
    if (categoria === '__outros') {
      if (!regCategoria) return;
      var isOutra = regCategoria === '__reg_outra';
      var outraTxt = isOutra ? regOutraInput.value.trim() : '';
      if (isOutra && outraTxt.length < 2) return;
      $('v-echo').textContent = '“' + (isOutra ? outraTxt : regValue.textContent) + '”';
      think(reduceMotion ? 200 : THINK_MS);
      secThink.focus({ preventScroll: true });
      announce('Analisando o que você faz…');
      if (isOutra) WAIT_REG.outra.area = outraTxt; // área só existe depois que a pessoa escreve
      var regKey = ['__wait_reg', isOutra ? 'outra' : regCategoria];
      window.setTimeout(function () { present(regKey); }, reduceMotion ? 200 : THINK_MS);
      return;
    }
    var text = input.value.trim();
    if (text.length < 2) return;
    $('v-echo').textContent = '“' + text + '”';
    think(reduceMotion ? 200 : THINK_MS);
    // o botão clicado acabou de virar display:none — sem isto o foco cai no
    // <body> e quem navega por teclado/leitor perde o lugar na página
    secThink.focus({ preventScroll: true });
    announce('Analisando o que você faz…');
    var key = resolve(text);
    window.setTimeout(function () { present(key); }, reduceMotion ? 200 : THINK_MS);
  });

  // Enter no textarea envia (shift+enter quebra linha)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!go.disabled) go.click(); }
  });

  // voltar pro início: a folha volta à altura da pergunta pela mesma transição
  // de sempre — refazer não pode custar um solavanco maior do que perguntar
  // texto do textarea e categoria escolhida continuam como estavam — só o
  // resultado (v-ok/v-wait) some, igual sempre foi pro texto
  function backToAsk() { show(secAsk); setActiveStep('cnae'); input.focus(); }
  $('v-ok-back').addEventListener('click', backToAsk);
  $('v-wait-back').addEventListener('click', backToAsk);

  /* ---- caminho "já sei meu CNAE" ---- */
  $('v-know').addEventListener('click', function () {
    show(secCode);
    codeInput.focus();
  });
  $('v-code-back').addEventListener('click', backToAsk);

  codeInput.addEventListener('input', function () {
    // máscara 0000-0/00 preservando a posição do cursor (conta dígitos à esquerda do caret)
    var caret = codeInput.selectionStart || 0;
    var digitsBefore = digits(codeInput.value.slice(0, caret)).length;
    var d = digits(codeInput.value).slice(0, 7);
    var out = d;
    if (d.length > 4) out = d.slice(0, 4) + '-' + d.slice(4, 5) + (d.length > 5 ? '/' + d.slice(5) : '');
    codeInput.value = out;
    // reposiciona o caret depois do mesmo nº de dígitos
    var pos = 0, seen = 0;
    while (pos < out.length && seen < digitsBefore) { if (/\d/.test(out[pos])) seen++; pos++; }
    codeInput.setSelectionRange(pos, pos);
    codeGo.disabled = d.length < 7;
    codeErr.classList.add('hidden');
    codeInput.removeAttribute('aria-invalid');
  });

  function checkCode() {
    var hit = CODES[digits(codeInput.value)];
    if (!hit) {
      codeErr.classList.remove('hidden');
      codeInput.setAttribute('aria-invalid', 'true');
      return;
    }
    $('v-echo').textContent = 'CNAE ' + codeInput.value;
    think(reduceMotion ? 200 : CODE_MS);
    secThink.focus({ preventScroll: true });
    announce('Verificando o código…');
    window.setTimeout(function () { present(hit); }, reduceMotion ? 200 : CODE_MS);
  }
  codeGo.addEventListener('click', checkCode);
  codeInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (!codeGo.disabled) checkCode(); }
  });

  /* ---- waitlist: captura fake (sem backend) ---- */
  $('v-wait-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('v-wait-email');
    if (!email.value || email.validity && !email.validity.valid) return;
    email.value = '';
    // pela mesma transição do resto: a confirmação acrescenta ~30px e sem o
    // morph a caixa dava um pulinho seco
    morphSheet(function () { $('v-wait-done').classList.remove('hidden'); });
    announce('Anotado! Assim que abrir, você é o primeiro a saber.');
  });
})();

/* ═══════════════════════════════════════════════════════════════════════════
   🚧 MODO EDIÇÃO (temporário, só em localhost) — REMOVER ANTES DE PORTAR
   ESTA PÁGINA PRA PRODUÇÃO.

   Mesma regra que valeu na dobra do simulador, agora pra página inteira:

   1. RECARREGA SOZINHA QUANDO UM ARQUIVO MUDA. HEAD a cada 1,5s no html, no
      css e nos js da página (inclusive os do simulador); se o `last-modified`
      de qualquer um mudar, recarrega.
   2. VOLTA PRA DOBRA QUE ESTAVA SENDO EDITADA. A posição de rolagem é gravada
      no sessionStorage e restaurada depois do load — sem isso cada refresh
      joga pro topo e a dobra em edição tem que ser reencontrada na mão.

   sessionStorage (não local): morre com a aba e não contamina outra.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;

  var CHAVE = 'lab-edicao-scroll';

  // grava a posição sem custo: um timer curto no lugar de escrever a cada
  // evento de scroll.
  var pendente = null;
  addEventListener('scroll', function () {
    if (pendente) return;
    pendente = setTimeout(function () {
      pendente = null;
      try { sessionStorage.setItem(CHAVE, String(scrollY)); } catch (e) {}
    }, 150);
  }, { passive: true });

  // o navegador também tenta restaurar sozinho, e brigaria com a gente
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function voltarPraDobra() {
    var y = 0;
    try { y = Number(sessionStorage.getItem(CHAVE)) || 0; } catch (e) {}
    if (!y) return;
    // duas vezes: a primeira posiciona, a segunda corrige o que as imagens e
    // as animações de entrada deslocaram depois do load.
    scrollTo(0, y);
    setTimeout(function () { scrollTo(0, y); }, 220);
  }
  if (document.readyState === 'complete') voltarPraDobra();
  else addEventListener('load', voltarPraDobra);

  var ARQUIVOS = [
    location.pathname,
    '/_lab/styles.css',
    '/_lab/script.js'
    // ✂️ 09/10: atendimento.css/.js saíram da lista junto com o validador
  ];
  var assinatura = null;
  setInterval(function () {
    Promise.all(ARQUIVOS.map(function (u) {
      return fetch(u + '?ping=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        .then(function (r) { return r.headers.get('last-modified') || r.headers.get('etag') || ''; })
        .catch(function () { return ''; });
    })).then(function (marcas) {
      var agora = marcas.join('|');
      if (assinatura === null) { assinatura = agora; return; }
      if (agora !== assinatura) location.reload();
    });
  }, 1500);
})();
