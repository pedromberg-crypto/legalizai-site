
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
  var vaiRolar = !reduceMotion;
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
  if (marquee && vaiRolar && window.PointerEvent) {
    var segurar = function () { marquee.classList.add('paused'); };
    var soltar = function () { marquee.classList.remove('paused'); };
    marquee.addEventListener('pointerdown', segurar, { passive: true });
    marquee.addEventListener('pointerup', soltar, { passive: true });
    marquee.addEventListener('pointercancel', soltar, { passive: true });
    marquee.addEventListener('pointerleave', soltar, { passive: true });
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
    '/script.js'
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
