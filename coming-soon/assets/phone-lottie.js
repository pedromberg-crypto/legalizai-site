/* Driver do Lottie do mockup do phone — mesmo padrão do componente Lottie
   do app (goToAndStop em setInterval, não rAF): evita o avião congelar
   quando a aba fica em background. */
(function () {
  'use strict';

  function carregarRuntime() {
    if (window.lottie) return Promise.resolve(window.lottie);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = '/coming-soon/assets/lottie.min.js';
      s.async = true;
      s.onload = function () {
        if (window.lottie) resolve(window.lottie);
        else reject(new Error('lottie não inicializou'));
      };
      s.onerror = function () { reject(new Error('lottie falhou')); };
      document.head.appendChild(s);
    });
  }

  document.querySelectorAll('.phone-lottie').forEach(function (el) {
    var path = el.getAttribute('data-lottie-path');
    var fps = parseInt(el.getAttribute('data-lottie-fps'), 10) || 30;
    var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    carregarRuntime().then(function (rt) {
      var anim = rt.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        path: path
      });
      anim.addEventListener('DOMLoaded', function () {
        var total = Math.floor(anim.totalFrames);
        if (reduzido) {
          anim.goToAndStop(Math.floor(total / 2), true);
          return;
        }
        var f = 0;
        setInterval(function () {
          f = (f + 1) % total;
          anim.goToAndStop(f, true);
        }, 1000 / fps);
      });
    }).catch(function () {
      /* asset falhou: ilustração some, resto da tela segue funcionando */
    });
  });
})();
