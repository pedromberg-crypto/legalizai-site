/* ============================================================
   LEGALIZAI · Obrigado (pós-cadastro)
   Preenche nome/plano a partir de window.__legalizaiThanks — o script
   inline no <head> do index.html desta pasta já leu isso do
   sessionStorage (chave gravada por ../script.js antes do redirect) e
   já apagou a chave. Se a chave não existisse, aquele script já
   redirecionou pra /em-breve antes deste arquivo sequer carregar; o
   `if (!data) return` abaixo só cobre a fresta entre o redirect ser
   disparado e a navegação de fato acontecer.

   PLANO_COPY/a montagem do card duplicam um pedaço pequeno de
   ../script.js (~10 linhas) de propósito: site sem build/módulos ES,
   então "importar" o arquivo inteiro só por isso pesaria mais do que
   repetir o trecho que interessa aqui.
   ============================================================ */
(function () {
  'use strict';

  var data = window.__legalizaiThanks;
  if (!data) return;

  function $(id) { return document.getElementById(id); }

  var PLANO_COPY = {
    mei: {
      rotulo: 'MEI', valor: 'R$19', depois: 'R$49',
      icone: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9m0 0 3-3m-3 3 3 3M4 17h9m0 0-3-3m3 3-3 3"/></svg>'
    },
    me: {
      rotulo: 'ME&nbsp;/&nbsp;Simples', valor: 'R$79', depois: 'R$139',
      icone: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11M9 8h2M9 12h2M9 16h2"/></svg>'
    }
  };

  var titleEl = $('obrigado-title');
  var planEl = $('obrigado-plan');

  var nome = (data.nome || '').trim();
  if (titleEl) titleEl.textContent = nome ? 'Combinado, ' + nome + '!' : 'Combinado!';

  var planoInfo = PLANO_COPY[data.plano];
  if (planEl) {
    if (planoInfo) {
      planEl.innerHTML =
        '<div class="soon-price-plan-card">' +
          '<div class="soon-price-plan-head">' +
            '<span class="soon-price-icon" aria-hidden="true">' + planoInfo.icone + '</span>' +
            '<span class="soon-price-plan-name">' + planoInfo.rotulo + '</span>' +
          '</div>' +
          '<div class="soon-price-value-row">' +
            '<p class="soon-price-value">' + planoInfo.valor + '<em>/mês</em></p>' +
            '<span class="soon-price-duration">3 primeiros meses</span>' +
          '</div>' +
          '<p class="soon-price-then"><span class="soon-price-then-label">depois</span> <strong>' + planoInfo.depois + '</strong>/mês</p>' +
        '</div>';
    } else {
      /* sem plano salvo (cadastro antigo sem essa info, ou tipo não
         reconhecido) — some com o wrapper em vez de mostrar caixa vazia */
      planEl.remove();
    }
  }

  /* ---------- confete (Lottie) no lugar do check estático ----------
     Mesmo runtime e mesmo arquivo do modal de sucesso em ../script.js
     (carregarLottieRuntime, ~15 linhas) — duplicado de propósito, ver
     cabeçalho deste arquivo sobre por que copiar em vez de importar.
     prefers-reduced-motion mantém o check estático já presente no HTML
     em vez de mostrar a animação — é a mesma checagem que o modal de
     origem faz antes de tocar o confete lá. */
  var badgeEl = $('obrigado-badge');
  var lottieRuntimeLoading = null;

  function carregarLottieRuntime() {
    if (window.lottie) return Promise.resolve(window.lottie);
    if (lottieRuntimeLoading) return lottieRuntimeLoading;
    lottieRuntimeLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/em-breve/assets/lottie.min.js';
      s.async = true;
      s.onload = function () {
        if (window.lottie) resolve(window.lottie);
        else reject(new Error('lottie não inicializou'));
      };
      s.onerror = function () { reject(new Error('lottie falhou')); };
      document.head.appendChild(s);
    });
    return lottieRuntimeLoading;
  }

  if (badgeEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    badgeEl.classList.add('obrigado-badge-lottie');
    badgeEl.innerHTML = '';
    carregarLottieRuntime().then(function (rt) {
      rt.loadAnimation({
        container: badgeEl,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        path: '/em-breve/assets/success-confetti-legalizei.json'
      });
    }).catch(function (err) {
      console.log('[obrigado-debug] confete falhou ao carregar', err);
    });
  }

  /* ---------- compartilhar ---------- */
  var shareUrl = window.location.origin + '/em-breve';
  var waMsg = 'Oferta imperdível pra abrir empresa: 3 meses a partir de R$19/mês. ' + shareUrl;
  var waLink = $('obrigado-whatsapp');
  if (waLink) waLink.href = 'https://wa.me/?text=' + encodeURIComponent(waMsg);

  var copyBtn = $('obrigado-copy');
  var copyLabel = copyBtn ? copyBtn.querySelector('.obrigado-share-btn-label') : null;
  var copyTimer = null;

  function marcarCopiado() {
    if (!copyBtn) return;
    copyBtn.classList.add('is-copied');
    if (copyLabel) copyLabel.textContent = 'Link copiado!';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(function () {
      copyBtn.classList.remove('is-copied');
      if (copyLabel) copyLabel.textContent = 'Copiar link';
    }, 2200);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(marcarCopiado).catch(function () {
          window.prompt('Copie o link:', shareUrl);
        });
      } else {
        /* clipboard API indisponível (http sem TLS, navegador antigo) —
           prompt já vem com o texto selecionado, dá pra Ctrl+C direto */
        window.prompt('Copie o link:', shareUrl);
      }
    });
  }
})();
