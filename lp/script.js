/* ============================================================
   LEGALIZEI · LP — 100% client-side, zero backend
   1. header sombra ao rolar
   2. scroll reveal (IntersectionObserver)
   3. marquee (duplica trilha p/ loop infinito + pausa)
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
  if (track && !reduceMotion) {
    var set = track.querySelector('.mq-set');
    var clone = set.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }
  // WCAG 2.2.2: controle de pausa visível (independente da preferência do SO)
  var mqToggle = document.getElementById('mq-toggle');
  if (mqToggle && marquee) {
    mqToggle.addEventListener('click', function () {
      var paused = marquee.classList.toggle('paused');
      mqToggle.setAttribute('aria-pressed', String(paused));
      mqToggle.textContent = paused ? '▶ Retomar animação' : '⏸ Pausar animação';
    });
  }

  /* ---------- 4. lottie (local; pausa fora do viewport e sob reduced-motion) ---------- */
  var lottieAnims = [];
  function initLotties() {
    if (!window.lottie) return;
    [
      { id: 'lot-plane',  data: window.PAPERPLANE },
      { id: 'lot-humano', data: window.CUSTOMER_NEED },
      { id: 'lot-chata',  data: window.CONTENT_MOD },
      { id: 'lot-claro',  data: window.MARKETING_MGMT }
    ].forEach(function (item) {
      var el = document.getElementById(item.id);
      if (!el || !item.data) return;
      var anim = window.lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: true,
        autoplay: false,
        animationData: item.data
      });
      lottieAnims.push({ el: el, anim: anim });
    });

    // toca só o que está visível (perf + WCAG); nada toca com reduced-motion
    if (!('IntersectionObserver' in window)) {
      if (!reduceMotion) lottieAnims.forEach(function (l) { l.anim.play(); });
      return;
    }
    var lio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var hit = lottieAnims.find(function (l) { return l.el === e.target; });
        if (!hit) return;
        if (e.isIntersecting && !motionQuery.matches) hit.anim.play();
        else hit.anim.pause();
      });
    }, { threshold: 0.1 });
    lottieAnims.forEach(function (l) { lio.observe(l.el); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLotties);
  } else {
    initLotties();
  }

  // usuário liga "reduzir movimento" com a página aberta → congela lotties na hora
  function onMotionChange() {
    if (motionQuery.matches) lottieAnims.forEach(function (l) { l.anim.pause(); });
  }
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
  else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);

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
  var codeInput = $('v-code-input'), codeGo = $('v-code-go'), codeErr = $('v-code-err');

  function show(sec) {
    [secAsk, secCode, secThink, secOk, secWait].forEach(function (s) { s.classList.add('hidden'); });
    sec.classList.remove('hidden');
  }
  function announce(text) { live.textContent = text; }

  input.addEventListener('input', function () {
    go.disabled = input.value.trim().length < 2;
    retry.classList.add('hidden');
  });

  document.querySelectorAll('.c-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      input.value = chip.textContent.trim();
      go.disabled = false;
      retry.classList.add('hidden');
      input.focus();
    });
  });

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
      show(secAsk);
      retry.classList.remove('hidden');
      announce('Não achei sua atividade. Conte com mais detalhe o que você faz.');
      input.focus();
      return;
    }
    if (key[0] === '__wait') {
      var w = WAIT[key[1]];
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

  go.addEventListener('click', function () {
    var text = input.value.trim();
    if (text.length < 2) return;
    $('v-echo').textContent = '“' + text + '”';
    show(secThink);
    announce('Analisando o que você faz…');
    var key = resolve(text);
    window.setTimeout(function () { present(key); }, reduceMotion ? 200 : 1200);
  });

  // Enter no textarea envia (shift+enter quebra linha)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!go.disabled) go.click(); }
  });

  $('v-ok-back').addEventListener('click', function () { show(secAsk); input.focus(); });
  $('v-wait-back').addEventListener('click', function () { show(secAsk); input.focus(); });

  /* ---- caminho "já sei meu CNAE" ---- */
  $('v-know').addEventListener('click', function () { show(secCode); codeInput.focus(); });
  $('v-code-back').addEventListener('click', function () { show(secAsk); input.focus(); });

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
    show(secThink);
    announce('Verificando o código…');
    window.setTimeout(function () { present(hit); }, reduceMotion ? 200 : 900);
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
    $('v-wait-done').classList.remove('hidden');
    announce('Anotado! Assim que abrir, você é o primeiro a saber.');
  });
})();
