
(function () {
  'use strict';
  var LANCAMENTO = '2026-11-10T00:00:00-03:00';
  var FRASE_NO_DIA = 'O app da Legalizaí chega às lojas hoje.';
  var FRASE_DEPOIS = 'O app da Legalizaí já está chegando às lojas.';
  var alvo = Date.parse(LANCAMENTO);
  var blocos = document.querySelectorAll('[data-contagem]');
  if (!blocos.length || isNaN(alvo)) return;
  var FUSO = 'America/Sao_Paulo';
  var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var porExtenso = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: FUSO });
  var diaIso = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO });
  var diaDoLancamento = diaIso.format(alvo);
  var dois = function (n) { return n < 10 ? '0' + n : String(n); };
  var cada = function (sel, fn) {
    blocos.forEach(function (b) { b.querySelectorAll(sel).forEach(fn); });
  };
  var poe = function (el, txt) { if (el.textContent !== txt) el.textContent = txt; };
  cada('[data-contagem-dia]', function (el) { el.textContent = porExtenso.format(alvo); });
  if (calmo) cada('[data-contagem-num="s"]', function (el) { el.parentNode.hidden = true; });
  var relogio;
  function chegou() {
    var frase = diaIso.format(Date.now()) === diaDoLancamento ? FRASE_NO_DIA : FRASE_DEPOIS;
    blocos.forEach(function (b) { b.classList.add('contagem-zerada'); });
    cada('[data-contagem-relogio]', function (el) { el.hidden = true; });
    cada('[data-contagem-chegou]', function (el) {
      el.innerHTML = '';
      var forte = document.createElement('strong');
      forte.textContent = 'Chegou o dia!';
      el.append(forte, ' ' + frase);
      el.hidden = false;
    });
  }
  function tique() {
    var falta = alvo - Date.now();
    if (falta <= 0) {
      clearInterval(relogio);
      chegou();
      return;
    }
    var s = Math.floor(falta / 1000);
    var v = {
      d: Math.floor(s / 86400),
      h: Math.floor((s % 86400) / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
    };
    cada('[data-contagem-num]', function (el) { poe(el, dois(v[el.dataset.contagemNum])); });
    cada('[data-contagem-un="d"]', function (el) { poe(el, v.d === 1 ? 'dia' : 'dias'); });
    cada('[data-contagem-un="h"]', function (el) { poe(el, v.h === 1 ? 'hora' : 'horas'); });
  }
  tique();
  if (alvo - Date.now() > 0) relogio = setInterval(tique, 1000);
  blocos.forEach(function (b) { b.hidden = false; });
})();
