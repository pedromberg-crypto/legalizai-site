
(function () {
  'use strict';
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = motionQuery.matches;
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
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
  var marquee = document.querySelector('.marquee');
  var track = document.querySelector('.marquee-track');
  var vaiRolar = window.matchMedia('(min-width:720px)').matches;
  if (track && !reduceMotion && vaiRolar) {
    var set = track.querySelector('.mq-set');
    var clone = set.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }
  if (marquee && track && vaiRolar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        marquee.classList.toggle('paused', !e.isIntersecting);
      });
    }, { threshold: 0 }).observe(marquee);
  }
  function initDifsRail() {
    var rail = document.querySelector('.difs-rail');
    var track = document.querySelector('.difs-track');
    if (!rail || !track) return;
    var cards = [].slice.call(track.children);
    if (!cards.length) return;
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
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
      cardW = cards[0].offsetWidth;
      var g = getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0';
      gapPx = parseFloat(g) || 0;
      step = cardW + gapPx;
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
        track.style.transition = 'none';
        track.style.transform = 'translateX(' + px + 'px)';
        void track.offsetWidth;
        track.style.transition = '';
      }
    }
    function syncActive() {
      [].forEach.call(track.children, function (c) { c.classList.remove('is-active'); });
      var node = track.children[centeredIx];
      if (!node) return;
      node.classList.add('is-active');
    }
    function maybeShuffleForward() {
      if (centeredIx < track.children.length - LOOKAHEAD) return;
      track.appendChild(track.firstElementChild);
      centeredIx -= 1;
      setTrackX(computeTranslateX(centeredIx), false);
    }
    var DEFAULT_IX = Math.min(3, cards.length - 1);
    var centeredIx = DEFAULT_IX;
    function goTo(domIx, animate) {
      domIx = clamp(domIx, 0, track.children.length - 1);
      centeredIx = domIx;
      var reallyAnimate = animate && !reduceMotion;
      setTrackX(computeTranslateX(centeredIx), reallyAnimate);
      syncActive();
      if (!reallyAnimate) maybeShuffleForward();
    }
    track.addEventListener('transitionend', function (e) {
      if (e.target !== track || e.propertyName !== 'transform') return;
      maybeShuffleForward();
    });
    goTo(DEFAULT_IX, false);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); setTrackX(computeTranslateX(centeredIx), false); });
    }
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
    var AUTOPLAY_DELAY = 4000;
    var autoplayTimer = null;
    function startAutoplay() {
      if (reduceMotion || autoplayTimer) return;
      autoplayTimer = setInterval(function () { goTo(centeredIx + 1, true); }, AUTOPLAY_DELAY);
    }
    function stopAutoplay() { clearInterval(autoplayTimer); autoplayTimer = null; }
    function resetAutoplay() { stopAutoplay(); startAutoplay(); }
    rail.addEventListener('mouseenter', stopAutoplay);
    rail.addEventListener('mouseleave', startAutoplay);
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
    var isDown = false, startClientX = 0, startTranslate = 0, currentTranslate = 0;
    rail.addEventListener('pointerdown', function (e) {
      isDown = true;
      startClientX = e.clientX;
      startTranslate = computeTranslateX(centeredIx);
      currentTranslate = startTranslate;
      rail.classList.add('is-dragging');
      track.classList.add('is-dragging');
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
      var deltaSteps = Math.round((startTranslate - currentTranslate) / step);
      goTo(centeredIx + deltaSteps, true);
      resetAutoplay();
    }
    rail.addEventListener('pointerup', endDrag);
    rail.addEventListener('pointercancel', endDrag);
  }
  initDifsRail();
  function shapeShowcase() {
    var sc = document.querySelector('.hero-showcase');
    if (!sc) return;
    var glass = sc.querySelector('.showcase-glass');
    if (!glass) return;
    var cs = getComputedStyle(sc);
    var px = function (name) { return parseFloat(cs.getPropertyValue(name)) || 0; };
    var pad = px('--glass-pad');
    var phoneEl = sc.querySelector('.showcase-phone');
    var pw = phoneEl ? phoneEl.getBoundingClientRect().width : px('--phone-w');
    if (!pw) return;
    var ph   = pw * 2176 / 1070;
    var rise = ph * px('--phone-rise-ratio');
    var bw = pw + pad * 2;
    var br = pw * px('--phone-r-ratio') + pad;
    var b  = rise + pad;
    var f  = px('--fillet-r');
    var R  = 40;
    var W = sc.offsetWidth;
    var H = sc.offsetHeight + b;
    if (!W || !H) return;
    var baseR = function (topH) { return Math.max(0, Math.min(R, W / 2, (H - topH) / 2)); };
    if (b - f < br) f = Math.max(0, b - br);
    var cx = W / 2, xa = cx - bw / 2, xb = cx + bw / 2;
    if (xa <= R) {
      var rf = baseR(br);
      var dFlat =
        'M 0 ' + br +
        ' A ' + br + ' ' + br + ' 0 0 1 ' + br + ' 0' +
        ' L ' + (W - br) + ' 0' +
        ' A ' + br + ' ' + br + ' 0 0 1 ' + W + ' ' + br +
        ' L ' + W + ' ' + (H - rf) +
        ' A ' + rf + ' ' + rf + ' 0 0 1 ' + (W - rf) + ' ' + H +
        ' L ' + rf + ' ' + H +
        ' A ' + rf + ' ' + rf + ' 0 0 1 0 ' + (H - rf) +
        ' Z';
      apply(dFlat, W, H);
      return;
    }
    f = Math.min(f, xa - R);
    var rb = baseR(b);
    var d =
      'M ' + R + ' ' + b +
      ' L ' + (xa - f) + ' ' + b +
      ' A ' + f + ' ' + f + ' 0 0 0 ' + xa + ' ' + (b - f) +
      ' L ' + xa + ' ' + br +
      ' A ' + br + ' ' + br + ' 0 0 1 ' + (xa + br) + ' 0' +
      ' L ' + (xb - br) + ' 0' +
      ' A ' + br + ' ' + br + ' 0 0 1 ' + xb + ' ' + br +
      ' L ' + xb + ' ' + (b - f) +
      ' A ' + f + ' ' + f + ' 0 0 0 ' + (xb + f) + ' ' + b +
      ' L ' + (W - R) + ' ' + b +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + W + ' ' + (b + R) +
      ' L ' + W + ' ' + (H - rb) +
      ' A ' + rb + ' ' + rb + ' 0 0 1 ' + (W - rb) + ' ' + H +
      ' L ' + rb + ' ' + H +
      ' A ' + rb + ' ' + rb + ' 0 0 1 0 ' + (H - rb) +
      ' L 0 ' + (b + R) +
      ' A ' + R + ' ' + R + ' 0 0 1 ' + R + ' ' + b +
      ' Z';
    apply(d, W, H);
    function apply(path, w, h) {
      var cp = 'path("' + path + '")';
      glass.style.clipPath = cp;
      glass.style.webkitClipPath = cp;
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
  window.addEventListener('load', shapeShowcase);
  function initNavSpy() {
    var links = [].slice.call(document.querySelectorAll('.header-nav a'));
    if (!links.length) return;
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
    if (/[?&]sky=0/.test(location.search)) return;
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
    outra:       { area: 'essa atividade',           motivo: 'Ainda não reconhecemos essa atividade na nossa lista, mas queremos entender melhor pra saber se cabe.' }
  };
  var REGULAMENTADAS_ORDEM = ['comercio','engenharia','medicina','odontologia','advocacia','contabilidade','psicologia','nutricao','fisioterapia','arquitetura','corretagem'];
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
  if (!input) return;
  var inputPlaceholderDefault = input.placeholder;
  var inputPlaceholderOutros = 'Ex: sou advogado, sou médico, tenho um comércio…';
  var goTextDefault = go.textContent;
  var goTextOutros = 'Ver se me atendem';
  var codeInput = $('v-code-input'), codeGo = $('v-code-go'), codeErr = $('v-code-err');
  var concierge = document.querySelector('.concierge');
  var sheet = document.querySelector('.c-sheet');
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
    void sheet.offsetHeight;
    sheet.style.height = to + 'px';
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
  var TA_MAX = 6 * 24 + 8;
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, TA_MAX) + 'px';
  }
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
  var tipoEmpresa = null;
  var stepTipo = $('v-step-tipo'), stepCnae = $('v-step-cnae'), tipoBackLabel = $('v-tipo-back-label');
  [].slice.call(document.querySelectorAll('input[name="v-tipo"]')).forEach(function (radio) {
    radio.addEventListener('change', function () {
      if (!radio.checked) return;
      tipoEmpresa = radio.value;
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
  function catClose(focusTrigger) {
    if (catList.classList.contains('hidden')) return;
    catList.classList.add('hidden');
    catTrigger.setAttribute('aria-expanded', 'false');
    if (focusTrigger !== false) catTrigger.focus();
  }
  function catSelect(ix) {
    var opt = catOptions[ix];
    if (!opt) return;
    catOptions.forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
    opt.setAttribute('aria-selected', 'true');
    categoria = opt.dataset.other ? '__outros' : opt.textContent.trim();
    catValue.textContent = opt.textContent.trim();
    catTrigger.classList.add('is-filled');
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
    document.addEventListener('click', function (e) {
      if (!catList.classList.contains('hidden') && !catRoot.contains(e.target)) catClose(false);
    });
  }
  var regCategoria = null;
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
    if (!key) {
      retry.classList.remove('hidden');
      show(secAsk);
      input.setAttribute('aria-invalid', 'true');
      announce('Não achei sua atividade. Conte com mais detalhe o que você faz.');
      input.focus();
      return;
    }
    setActiveStep('resultado');
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
  var THINK_MS = 1200;
  var CODE_MS = 900;
  function think(ms) {
    secThink.style.setProperty('--think-dur', ms + 'ms');
    show(secThink);
  }
  go.addEventListener('click', function () {
    if (categoria === '__outros') {
      if (!regCategoria) return;
      var isOutra = regCategoria === '__reg_outra';
      var outraTxt = isOutra ? regOutraInput.value.trim() : '';
      if (isOutra && outraTxt.length < 2) return;
      $('v-echo').textContent = '“' + (isOutra ? outraTxt : regValue.textContent) + '”';
      think(reduceMotion ? 200 : THINK_MS);
      secThink.focus({ preventScroll: true });
      announce('Analisando o que você faz…');
      if (isOutra) WAIT_REG.outra.area = outraTxt;
      var regKey = ['__wait_reg', isOutra ? 'outra' : regCategoria];
      window.setTimeout(function () { present(regKey); }, reduceMotion ? 200 : THINK_MS);
      return;
    }
    var text = input.value.trim();
    if (text.length < 2) return;
    $('v-echo').textContent = '“' + text + '”';
    think(reduceMotion ? 200 : THINK_MS);
    secThink.focus({ preventScroll: true });
    announce('Analisando o que você faz…');
    var key = resolve(text);
    window.setTimeout(function () { present(key); }, reduceMotion ? 200 : THINK_MS);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!go.disabled) go.click(); }
  });
  function backToAsk() { show(secAsk); setActiveStep('cnae'); input.focus(); }
  $('v-ok-back').addEventListener('click', backToAsk);
  $('v-wait-back').addEventListener('click', backToAsk);
  $('v-know').addEventListener('click', function () {
    show(secCode);
    codeInput.focus();
  });
  $('v-code-back').addEventListener('click', backToAsk);
  codeInput.addEventListener('input', function () {
    var caret = codeInput.selectionStart || 0;
    var digitsBefore = digits(codeInput.value.slice(0, caret)).length;
    var d = digits(codeInput.value).slice(0, 7);
    var out = d;
    if (d.length > 4) out = d.slice(0, 4) + '-' + d.slice(4, 5) + (d.length > 5 ? '/' + d.slice(5) : '');
    codeInput.value = out;
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
  $('v-wait-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('v-wait-email');
    if (!email.value || email.validity && !email.validity.valid) return;
    email.value = '';
    morphSheet(function () { $('v-wait-done').classList.remove('hidden'); });
    announce('Anotado! Assim que abrir, você é o primeiro a saber.');
  });
})();
(function () {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  var CHAVE = 'lab-edicao-scroll';
  var pendente = null;
  addEventListener('scroll', function () {
    if (pendente) return;
    pendente = setTimeout(function () {
      pendente = null;
      try { sessionStorage.setItem(CHAVE, String(scrollY)); } catch (e) {}
    }, 150);
  }, { passive: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  function voltarPraDobra() {
    var y = 0;
    try { y = Number(sessionStorage.getItem(CHAVE)) || 0; } catch (e) {}
    if (!y) return;
    scrollTo(0, y);
    setTimeout(function () { scrollTo(0, y); }, 220);
  }
  if (document.readyState === 'complete') voltarPraDobra();
  else addEventListener('load', voltarPraDobra);
  var ARQUIVOS = [
    location.pathname,
    '/styles.css',
    '/script.js',
    '/atendimento/atendimento.css',
    '/atendimento/atendimento.js'
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
