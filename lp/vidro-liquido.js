
(function () {
  'use strict';
  var secao = document.querySelector('.steps');
  if (!secao) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cards = secao.querySelectorAll('.step');
  if (!cards.length) return;
  var VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    'precision mediump float;',
    'uniform vec2 uRes;',
    'uniform float uRaio;',
    'uniform vec3 uTopo;',
    'uniform vec3 uBase;',
    'uniform float uTraco;',
    'uniform float uClaro;',
    'uniform float uDark;',
    'uniform float uHibrido;',
    'uniform float uPuro;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float ruido(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 3; i++){ v += a * ruido(p); p *= 2.0; a *= 0.5; }',
    '  return v;',
    '}',
    'vec3 campo(vec2 uv){',
    '  vec3 c = mix(uTopo, uBase, clamp(uv.y, 0.0, 1.0));',
    '  float q = smoothstep(1.1, 0.0, distance(uv, vec2(1.15, 0.15)));',
    '  float f = smoothstep(1.0, 0.0, distance(uv, vec2(-0.15, 0.9)));',
    '  c = mix(c, vec3(1.0, 0.86, 0.79), q * 0.34);',
    '  c = mix(c, vec3(0.52, 0.17, 0.08), f * 0.3);',
    '  return c;',
    '}',
    'float sdCaixa(vec2 p, vec2 meio, float r){',
    '  vec2 d = abs(p) - meio + r;',
    '  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;',
    '}',
    'void main(){',
    '  vec2 frag = gl_FragCoord.xy;',
    '  vec2 topo = vec2(frag.x, uRes.y - frag.y);',
    '  vec2 meio = uRes * 0.5;',
    '  vec2 pos = topo - meio;',
    '  float d = sdCaixa(pos, meio, uRaio);',
    '  float dentro = 1.0 - smoothstep(-1.0, 0.5, d);',
    '  if (dentro <= 0.0) { gl_FragColor = vec4(0.0); return; }',
    '  vec2 n = vec2(fbm(topo * 0.012), fbm(topo.yx * 0.012 + 8.3)) - 0.5;',
    '  vec2 nFino = vec2(fbm(topo * 0.06 + 3.1), fbm(topo.yx * 0.06)) - 0.5;',
    '  float borda = 1.0 - smoothstep(0.0, 34.0, -d);',
    '  vec2 dir = normalize(pos + vec2(0.0001));',
    '  vec2 desloc = dir * borda * borda * 40.0 + n * 26.0 + nFino * 6.0;',
    '  vec3 soma = vec3(0.0);',
    '  for (int x = -1; x <= 1; x++){',
    '    for (int y = -1; y <= 1; y++){',
    '      vec2 off = vec2(float(x), float(y)) * 8.0;',
    '      vec2 a = (topo + desloc + off) / uRes;',
    '      soma += campo(a);',
    '    }',
    '  }',
    '  vec3 vidro = soma / 9.0;',
    '  float diag = clamp((topo.x / uRes.x + topo.y / uRes.y) * 0.5, 0.0, 1.0);',
    '  vec3 fechado = vidro * mix(0.66, 0.92, diag);',
    '  float lum0 = dot(fechado, vec3(0.299, 0.587, 0.114));',
    '  fechado = mix(vec3(lum0), fechado, 1.25);',
    '  vec3 claro = mix(vidro, vec3(1.0), mix(0.9, 0.76, diag));',
    '  vec3 escuro = mix(vidro, vec3(0.106, 0.118, 0.141), mix(0.9, 0.8, diag));',
    '  vec3 coral = mix(vidro, vec3(0.72, 0.24, 0.11), 0.55);',
    '  vec3 hibrido = mix(coral, escuro, smoothstep(0.15, 0.85, diag));',
    '  vidro = mix(fechado, claro, uClaro);',
    '  vidro = mix(vidro, escuro, uDark);',
    '  vidro = mix(vidro, hibrido, uHibrido);',
    '  vidro = mix(vidro, soma / 9.0, uPuro);',
    '  float brilho = fbm(topo * 0.02 + 17.0);',
    '  vidro += (brilho - 0.5) * mix(0.13, 0.05, uClaro) * smoothstep(uRes.y, 0.0, topo.y);',
    '  float grao = mix(mix(0.055, 0.022, uClaro), 0.045, uDark);',
    '  vidro += (hash(floor(topo)) - 0.5) * grao;',
    '  vidro += smoothstep(2.5, 0.0, topo.y) * mix(mix(0.3, 0.18, uClaro), 0.28, uDark);',
    '  vidro += smoothstep(2.5, 0.0, topo.x) * mix(mix(0.2, 0.12, uClaro), 0.18, uDark);',
    '  vidro -= smoothstep(2.0, 0.0, uRes.y - topo.y) * mix(0.06, 0.03, uClaro);',
    '  vidro = mix(vidro, vec3(1.0), smoothstep(1.6, 0.0, abs(d)) * 0.45 * uTraco);',
    '  gl_FragColor = vec4(vidro, dentro);',
    '}'
  ].join('\n');
  var campoEl = document.querySelector('.campo');
  function hexPraRgb(v) {
    v = (v || '').trim();
    var m = v.match(/^#?([0-9a-f]{6})$/i);
    if (m) {
      var n = parseInt(m[1], 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    var r = v.match(/rgba?\(([^)]+)\)/);
    if (r) {
      var p = r[1].split(',').map(parseFloat);
      return [p[0] / 255, p[1] / 255, p[2] / 255];
    }
    return null;
  }
  function varCss(el, nome) { return getComputedStyle(el).getPropertyValue(nome).trim(); }
  function stopsDoCampo() {
    if (!campoEl) return null;
    var pares = [
      ['--c1', '--c1-ate'], ['--c2', '--c2-em'], ['--c3', '--c3-em'],
      ['--c3', '--c3-ate'], ['--c4', '--c4-em'], ['--c4', '--c4-ate'],
      ['--c5', '--c5-em'], ['--c5', '--c5-ate'], ['--c6', '--c6-em'], ['--c7', '--c7-em']
    ];
    var out = [];
    for (var i = 0; i < pares.length; i++) {
      var cor = hexPraRgb(varCss(campoEl, pares[i][0]));
      var pos = parseFloat(varCss(campoEl, pares[i][1]));
      if (!cor || isNaN(pos)) continue;
      out.push([pos, cor]);
    }
    return out.length ? out : null;
  }
  function corNaAltura(stops, y) {
    if (!stops) return [0.95, 0.39, 0.24];
    if (y <= stops[0][0]) return stops[0][1];
    for (var i = 1; i < stops.length; i++) {
      if (y <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i];
        var t = (y - a[0]) / Math.max(1, b[0] - a[0]);
        return [
          a[1][0] + (b[1][0] - a[1][0]) * t,
          a[1][1] + (b[1][1] - a[1][1]) * t,
          a[1][2] + (b[1][2] - a[1][2]) * t
        ];
      }
    }
    return stops[stops.length - 1][1];
  }
  var glCanvas = document.createElement('canvas');
  var gl = null;
  try {
    gl = glCanvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
  } catch (e) { return; }
  if (!gl) return;
  function compilar(tipo, fonte) {
    var sh = gl.createShader(tipo);
    gl.shaderSource(sh, fonte);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[vidro] shader:', gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }
  var vs = compilar(gl.VERTEX_SHADER, VS);
  var fs = compilar(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[vidro] link:', gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var locPos = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
  var U = {
    res: gl.getUniformLocation(prog, 'uRes'),
    raio: gl.getUniformLocation(prog, 'uRaio'),
    topo: gl.getUniformLocation(prog, 'uTopo'),
    base: gl.getUniformLocation(prog, 'uBase'),
    traco: gl.getUniformLocation(prog, 'uTraco'),
    claro: gl.getUniformLocation(prog, 'uClaro'),
    dark: gl.getUniformLocation(prog, 'uDark'),
    hibrido: gl.getUniformLocation(prog, 'uHibrido'),
    puro: gl.getUniformLocation(prog, 'uPuro')
  };
  function montar(el, opcoes) {
    opcoes = opcoes || {};
    var canvas = document.createElement('canvas');
    canvas.className = opcoes.classe || 'step-vidro';
    canvas.setAttribute('aria-hidden', 'true');
    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    var revelado = false;
    function desenhar() {
      if (!revelado) return;
      var b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(b.width * dpr), h = Math.round(b.height * dpr);
      glCanvas.width = w; glCanvas.height = h;
      canvas.width = w; canvas.height = h;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(U.res, w, h);
      var raio = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 28;
      gl.uniform1f(U.raio, raio * dpr);
      var stops = stopsDoCampo();
      var yCampo = campoEl ? b.top - campoEl.getBoundingClientRect().top : b.top;
      var topo = corNaAltura(stops, yCampo);
      var base = corNaAltura(stops, yCampo + b.height);
      gl.uniform3f(U.topo, topo[0], topo[1], topo[2]);
      gl.uniform3f(U.base, base[0], base[1], base[2]);
      gl.uniform1f(U.traco, opcoes.traco === false ? 0.0 : 1.0);
      gl.uniform1f(U.claro, opcoes.claro ? 1.0 : 0.0);
      gl.uniform1f(U.dark, opcoes.dark ? 1.0 : 0.0);
      gl.uniform1f(U.hibrido, opcoes.hibrido ? 1.0 : 0.0);
      gl.uniform1f(U.puro, opcoes.puro ? 1.0 : 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(glCanvas, 0, 0);
    }
    el.insertBefore(canvas, el.firstChild);
    function revelar() {
      if (revelado) return;
      revelado = true;
      desenhar();
    }
    var margem = 300;
    if (el.getBoundingClientRect().top < (window.innerHeight || 0) + margem) {
      revelar();
    } else {
      if (window.IntersectionObserver) {
        var io = new IntersectionObserver(function (entradas) {
          for (var k = 0; k < entradas.length; k++) {
            if (entradas[k].isIntersecting) { io.disconnect(); revelar(); break; }
          }
        }, { rootMargin: margem + 'px 0px' });
        io.observe(el);
      }
      var conferir = function () {
        if (revelado) { removeEventListener('scroll', conferir); return; }
        if (el.getBoundingClientRect().top < (window.innerHeight || 0) + margem) {
          removeEventListener('scroll', conferir);
          revelar();
        }
      };
      addEventListener('scroll', conferir, { passive: true });
    }
    if (opcoes.persistente && window.MutationObserver) {
      new MutationObserver(function () {
        if (!canvas.parentNode) {
          el.insertBefore(canvas, el.firstChild);
          desenhar();
        }
      }).observe(el, { childList: true });
    }
    var t = null;
    function agendar() { clearTimeout(t); t = setTimeout(desenhar, 80); }
    addEventListener('resize', agendar, { passive: true });
    addEventListener('load', agendar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(agendar);
    if (window.ResizeObserver) new ResizeObserver(agendar).observe(el);
    return true;
  }
  var ok = 0;
  for (var i = 0; i < cards.length; i++) if (montar(cards[i], { dark: true, hibrido: true })) ok++;
  if (ok === cards.length) secao.classList.add('is-vidro-webgl');
  var cartaoProva = document.querySelector('.prova-tela');
  if (cartaoProva && montar(cartaoProva, { classe: 'step-vidro', dark: true })) {
    cartaoProva.classList.add('is-vidro-dark');
  }
  var perguntas = document.querySelectorAll('.faq-list details');
  for (var q = 0; q < perguntas.length; q++) {
    if (montar(perguntas[q], { classe: 'step-vidro', dark: true })) {
      perguntas[q].classList.add('is-vidro-dark');
    }
  }
  var cartaoPlanos = document.querySelector('.planos-copy');
  if (cartaoPlanos && montar(cartaoPlanos, { classe: 'step-vidro', dark: true, hibrido: true })) {
    cartaoPlanos.classList.add('is-vidro-dark');
  }
  var tabela = document.querySelector('.vs-table-wrap');
  if (tabela && montar(tabela, { classe: 'step-vidro', dark: true, hibrido: true, traco: false })) {
    tabela.classList.add('is-vidro-hibrido');
  }
  var cartaoTeto = document.querySelector('.crescer-inner');
  if (cartaoTeto && montar(cartaoTeto, { classe: 'step-vidro', dark: true, hibrido: true, traco: false })) {
    cartaoTeto.classList.add('is-vidro-hibrido');
  }
  var posts = document.querySelectorAll('.blog-grid .bp-link');
  for (var b = 0; b < posts.length; b++) {
    if (montar(posts[b], { classe: 'step-vidro', dark: true, hibrido: true })) posts[b].classList.add('is-vidro-coral');
  }
  var trilha = document.querySelector('.sim-rail');
  if (trilha && montar(trilha, { classe: 'step-vidro', dark: true, hibrido: true })) {
    trilha.classList.add('is-vidro-misto');
  }
  var vidroHero = document.querySelector('.showcase-glass');
  if (vidroHero && montar(vidroHero, { classe: 'hero-vidro', traco: false, dark: true, hibrido: true })) {
    document.querySelector('.hero-showcase').classList.add('is-vidro-webgl');
  }
})();
