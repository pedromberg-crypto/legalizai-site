/* ============================================================
   CONTAGEM PRO LANÇAMENTO DO APP — home e /em-breve
   ============================================================
   A DATA MORA AQUI E SÓ AQUI. A home e o /em-breve carregam este mesmo
   arquivo (o /em-breve pega o /lancamento.js gerado pelo build, igual já faz
   com o origem.js), então mudar a data é mudar UMA linha e rodar o build.

   Marcação: qualquer elemento com [data-contagem]. Dentro dele:
     [data-contagem-dia]      recebe a data por extenso ("10 de novembro")
     [data-contagem-num="d"]  dias   (idem "h", "m", "s")
     [data-contagem-un="d"]   rótulo que flexiona ("dia" / "dias"; idem "h")
     [data-contagem-relogio]  o bloco dos números (some no zero)
     [data-contagem-chegou]   a frase de lançamento (aparece no zero)
   O bloco nasce `hidden` no HTML: sem JS, ninguém vê relógio zerado.

   No zero (pedido do Pedro, 09/10): os números saem e entra "Chegou o dia",
   e fica assim até o site virar pro modo app (`modo-copy.mjs loja app`), que
   esconde o bloco inteiro pela classe .so-espera na home. A frase muda depois
   do dia 10 porque "chega às lojas hoje" passaria a ser mentira no dia 11.

   Movimento reduzido (prefers-reduced-motion): o bloco dos segundos some e o
   relógio só muda de minuto em minuto. Um número trocando a cada segundo é
   conteúdo que se atualiza sozinho (WCAG 2.2.2); de minuto em minuto, não
   incomoda e continua sendo uma contagem.

   O relógio é o do aparelho de quem visita. Celular com hora errada vê a
   contagem errada; não há como evitar isso num site estático sem servidor.
   ============================================================ */
(function () {
  'use strict';

  /* 10/11/2026, 00:00 em Brasília. O -03:00 é fixo de propósito: o Brasil não
     tem horário de verão desde 2019, então o fuso não muda até lá.
     Sem horário definido ainda, a contagem vai até a virada do dia. Quando o
     horário fechar, troca só o "00:00:00" (ex.: '2026-11-10T10:00:00-03:00'). */
  var LANCAMENTO = '2026-11-10T00:00:00-03:00';

  var FRASE_NO_DIA = 'O app da Legalizaí chega às lojas hoje.';
  var FRASE_DEPOIS = 'O app da Legalizaí já está chegando às lojas.';

  var alvo = Date.parse(LANCAMENTO);
  var blocos = document.querySelectorAll('[data-contagem]');
  if (!blocos.length || isNaN(alvo)) return;

  var FUSO = 'America/Sao_Paulo';
  var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* "10 de novembro" e "2026-11-10", os dois no fuso de Brasília: quem abre o
     site de outro fuso continua vendo o dia do lançamento daqui. */
  var porExtenso = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: FUSO });
  var diaIso = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: FUSO });
  var diaDoLancamento = diaIso.format(alvo);

  var dois = function (n) { return n < 10 ? '0' + n : String(n); };
  var cada = function (sel, fn) {
    blocos.forEach(function (b) { b.querySelectorAll(sel).forEach(fn); });
  };
  /* só escreve o que mudou: a cada segundo, o normal é mudar um número só */
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
  /* intervalo de 1s mesmo no modo calmo: o número de minutos só muda quando
     o minuto vira, então o efeito é o mesmo, e a virada pro zero acontece na
     hora certa. O valor é recalculado do relógio a cada tique, então aba em
     segundo plano (onde o navegador atrasa o setInterval) não acumula erro. */
  if (alvo - Date.now() > 0) relogio = setInterval(tique, 1000);

  blocos.forEach(function (b) { b.hidden = false; });
})();
