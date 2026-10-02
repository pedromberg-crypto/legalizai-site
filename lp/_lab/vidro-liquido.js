/* ============================================================================
   VIDRO LÍQUIDO (WebGL) — cartões da dobra "Três passos e pronto"
   ----------------------------------------------------------------------------
   Adaptado do shader de "liquid glass" que o Pedro trouxe (CodePen com lente
   seguindo o mouse). O que veio de lá: a matemática da refração — caixa de
   canto arredondado, deslocamento da UV perto da borda e realce de luz na
   quina. É o que o `backdrop-filter` não faz: ele BORRA, mas não DEFORMA.

   O que mudou, e por quê:

   1. UM CANVAS POR CARTÃO, não um canvas pra dobra inteira.
      🐛 A primeira versão media os três cartões e desenhava as lentes nas
      posições medidas. Toda vez que algo mudava de altura (fonte carregando,
      imagem chegando), os cartões desciam e as lentes ficavam no lugar velho:
      o vidro comia o padding de cima e sobrava embaixo. Nem ResizeObserver
      resolveu — sempre existe uma janela entre o layout mudar e o redesenho.
      Agora o canvas é FILHO do cartão, com `inset:0`: ele É o cartão. Não há o
      que medir, então não há como desalinhar.

   2. NÃO EXISTE IMAGEM DE FUNDO. O original refrata uma foto. O nosso fundo é
      gradiente CSS ao vivo; capturar em bitmap seria pesado e quebraria a cada
      scroll. Como o campo é NOSSO, o shader redesenha ele — e as cores vêm dos
      próprios stops `--c1..--c7` do CSS, lidos e interpolados na altura do
      cartão, então o vidro refrata a MESMA cor que está atrás dele.

   3. TEXTURA DENTRO DO VIDRO. Vidro real não é liso: tem grão, microrrisco e
      variação de espessura. O shader gera isso por ruído (hash + fbm) e usa em
      três papéis — deslocamento da amostra (a espessura irregular do material),
      grão fino sobre a cor, e um brilho difuso puxado pra quina de cima. Sem
      isso o cartão vira véu chapado, por mais que o borrão esteja certo.

   4. 81 AMOSTRAS POR PIXEL VIRAM 9. O laço 9×9 do original é o custo e o
      aspecto leitoso. Com o fundo sendo função matemática, 9 bastam.

   5. NÃO ANIMA. Sem `requestAnimationFrame`, sem relógio. Desenha uma vez e de
      novo só quando o cartão muda de tamanho. Canvas parado custa o mesmo que
      uma imagem.

   Degradação: sem WebGL, com `prefers-reduced-motion`, ou se qualquer etapa
   falhar, o script sai calado e a dobra fica com o vidro em CSS que já existe.
   Quem troca um pelo outro é a classe `is-vidro-webgl` na seção.
   ========================================================================== */
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
    'uniform vec2 uRes;',    // tamanho do cartão em px de dispositivo
    'uniform float uRaio;',  // raio do canto
    'uniform vec3 uTopo;',   // cor do campo no topo do cartão
    'uniform vec3 uBase;',   // cor do campo na base do cartão
    'uniform float uTraco;', // 1 = shader desenha o fio da borda; 0 = não
    'uniform float uClaro;', // 1 = vidro fosco branco
    'uniform float uDark;',  // 1 = vidro escuro (quase preto, com o coral por dentro)
    'uniform float uHibrido;', // 1 = coral em cima/esquerda virando dark embaixo/direita
    'uniform float uPuro;',   // 1 = SEM tingimento: só refração, textura e luz

    // ---- ruído: a textura do material
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float ruido(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    // fbm de 3 oitavas: escalas diferentes de imperfeição ao mesmo tempo
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 3; i++){ v += a * ruido(p); p *= 2.0; a *= 0.5; }',
    '  return v;',
    '}',

    // ---- o campo coral, desenhado em vez de fotografado
    'vec3 campo(vec2 uv){',
    '  vec3 c = mix(uTopo, uBase, clamp(uv.y, 0.0, 1.0));',
    '  float q = smoothstep(1.1, 0.0, distance(uv, vec2(1.15, 0.15)));',
    '  float f = smoothstep(1.0, 0.0, distance(uv, vec2(-0.15, 0.9)));',
    '  c = mix(c, vec3(1.0, 0.86, 0.79), q * 0.34);',
    '  c = mix(c, vec3(0.52, 0.17, 0.08), f * 0.3);',
    '  return c;',
    '}',

    // ---- distância assinada de um retângulo de canto arredondado
    'float sdCaixa(vec2 p, vec2 meio, float r){',
    '  vec2 d = abs(p) - meio + r;',
    '  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;',
    '}',

    'void main(){',
    '  vec2 frag = gl_FragCoord.xy;',
    '  vec2 topo = vec2(frag.x, uRes.y - frag.y);',   // origem no canto sup-esq
    '  vec2 meio = uRes * 0.5;',
    '  vec2 pos = topo - meio;',
    '  float d = sdCaixa(pos, meio, uRaio);',
    '  float dentro = 1.0 - smoothstep(-1.0, 0.5, d);',
    '  if (dentro <= 0.0) { gl_FragColor = vec4(0.0); return; }',

    // TEXTURA (1/3): espessura irregular do vidro. Duas escalas de fbm em eixos
    // trocados dão um deslocamento que não parece grade.
    '  vec2 n = vec2(fbm(topo * 0.012), fbm(topo.yx * 0.012 + 8.3)) - 0.5;',
    '  vec2 nFino = vec2(fbm(topo * 0.06 + 3.1), fbm(topo.yx * 0.06)) - 0.5;',

    // REFRAÇÃO: perto da borda, o que está atrás é puxado pra fora. É isto que
    // dá espessura ao material, em vez de véu.
    '  float borda = 1.0 - smoothstep(0.0, 34.0, -d);',
    '  vec2 dir = normalize(pos + vec2(0.0001));',
    '  vec2 desloc = dir * borda * borda * 40.0 + n * 26.0 + nFino * 6.0;',

    // BORRÃO: 9 amostras (o fundo é função, não textura).
    '  vec3 soma = vec3(0.0);',
    '  for (int x = -1; x <= 1; x++){',
    '    for (int y = -1; y <= 1; y++){',
    '      vec2 off = vec2(float(x), float(y)) * 8.0;',
    '      vec2 a = (topo + desloc + off) / uRes;',
    '      soma += campo(a);',
    '    }',
    '  }',
    '  vec3 vidro = soma / 9.0;',

    // DOIS TONS DO MESMO MATERIAL, escolhidos por `uClaro`:
    //
    // FECHADO (uClaro = 0) — o cartão é mais escuro que o campo. O material
    // escurece e satura o que atravessa; o contraste vem do tom, não da luz.
    //
    // CLARO (uClaro = 1) — vidro fosco branco. O mesmo cálculo, invertido: em
    // vez de multiplicar pra baixo, puxa pro branco. A cor do campo continua
    // atravessando (por isso não é um branco chapado: o coral aparece por
    // dentro, de leve), e a refração/textura seguem idênticas.
    //
    // Nos dois casos o degradê diagonal fica: é ele que denuncia a espessura
    // do bloco, mais fechado num canto e abrindo no oposto.
    '  float diag = clamp((topo.x / uRes.x + topo.y / uRes.y) * 0.5, 0.0, 1.0);',
    '  vec3 fechado = vidro * mix(0.66, 0.92, diag);',
    '  float lum0 = dot(fechado, vec3(0.299, 0.587, 0.114));',
    '  fechado = mix(vec3(lum0), fechado, 1.25);',   // satura de volta o que o escuro comeu
    '  vec3 claro = mix(vidro, vec3(1.0), mix(0.9, 0.76, diag));',
    // DARK: o mesmo material puxado pro quase-preto da marca (--ink-900). Não é
    // preto chapado: 12 a 22% da cor refratada continua passando (mais no canto
    // que abre), então o coral do campo aparece por dentro do vidro e as bordas
    // seguem refratando. É o cartão escuro do app, em vidro.
    '  vec3 escuro = mix(vidro, vec3(0.106, 0.118, 0.141), mix(0.9, 0.8, diag));',
    // HÍBRIDO: o mesmo bloco começa CORAL na quina de cima à esquerda e vira
    // DARK na de baixo à direita. Não é meio a meio: a virada acontece num
    // trecho largo (0.15 → 0.85 da diagonal), senão a emenda vira uma faixa
    // atravessando o cartão. O coral aqui é o do campo, só um pouco fechado —
    // é o mesmo coral que está atrás do vidro, não um segundo coral.
    '  vec3 coral = mix(vidro, vec3(0.72, 0.24, 0.11), 0.55);',
    '  vec3 hibrido = mix(coral, escuro, smoothstep(0.15, 0.85, diag));',
    '  vidro = mix(fechado, claro, uClaro);',
    '  vidro = mix(vidro, escuro, uDark);',
    '  vidro = mix(vidro, hibrido, uHibrido);',
    // PURO: nenhum tom por cima. O que aparece é exatamente o fundo refratado,
    // e o material se anuncia só pela deformação da borda, pela textura e pelo
    // fio de luz. É o vidro mais "invisível" dos quatro.
    '  vidro = mix(vidro, soma / 9.0, uPuro);',

    // TEXTURA (2/3): brilho difuso dentro do vidro, mais forte perto do topo —
    // é a luz presa no material, não um reflexo desenhado.
    '  float brilho = fbm(topo * 0.02 + 17.0);',
    '  vidro += (brilho - 0.5) * mix(0.13, 0.05, uClaro) * smoothstep(uRes.y, 0.0, topo.y);',

    // TEXTURA (3/3): grão fino por cima de tudo, na escala do pixel
    '  float grao = mix(mix(0.055, 0.022, uClaro), 0.045, uDark);',
    '  vidro += (hash(floor(topo)) - 0.5) * grao;',

    // fios de luz medidos em PX até a borda (a versão anterior usava smoothstep
    // com edge0 > edge1, que é indefinido: saía faixa larga, não fio)
    '  vidro += smoothstep(2.5, 0.0, topo.y) * mix(mix(0.3, 0.18, uClaro), 0.28, uDark);',
    '  vidro += smoothstep(2.5, 0.0, topo.x) * mix(mix(0.2, 0.12, uClaro), 0.18, uDark);',
    '  vidro -= smoothstep(2.0, 0.0, uRes.y - topo.y) * mix(0.06, 0.03, uClaro);',
    // traço de 1px na borda: o cartão é transparente no modo WebGL, então o
    // contorno só existe se o shader desenhar
    '  vidro = mix(vidro, vec3(1.0), smoothstep(1.6, 0.0, abs(d)) * 0.45 * uTraco);',

    '  gl_FragColor = vec4(vidro, dentro);',
    '}'
  ].join('\n');

  /* ------------------------------------------------- cor real do campo ---- */

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

  // [posição em px, cor], na ordem da rampa do .campo
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

  /* ------------------------------------------------ UM CONTEXTO SÓ ------
     🔴 Navegador tem teto de contextos WebGL por página (~16 no Chrome), e ao
     passar dele ele começa a DERRUBAR os mais antigos — o vidro dos primeiros
     cartões apagaria sozinho conforme a lista crescesse. Com hero + 3 passos +
     prova + planos + tabela + teto + 7 perguntas já eram 14.

     Então existe UM contexto, num canvas fora da tela. Cada elemento recebe um
     canvas 2D (barato, sem limite prático) e o desenho é: renderiza no WebGL do
     tamanho daquele elemento, copia com `drawImage`. Um shader, uma GPU, N
     cartões.

     `preserveDrawingBuffer:true` é obrigatório aqui: sem ele o buffer pode ser
     descartado antes do `drawImage` e o cartão sai vazio. */

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

    /* 🔒 O PORTÃO da preguiça. Não basta adiar a PRIMEIRA pintura: o canvas
       também é redesenhado por `load`, por `document.fonts.ready`, pelo
       ResizeObserver (que dispara uma vez assim que observa) e por `resize`.
       Sem este portão, esses gatilhos pintavam os 19 logo depois do load e a
       economia sumia — medido: 18 dos 19 acabavam pintados mesmo com o
       IntersectionObserver no lugar.
       Enquanto `revelado` for falso, TODO caminho de desenho é inerte. */
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
      // o raio vem do próprio CSS do elemento: um lugar só pra mexer
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

    /* 🔄 DESENHO PREGUIÇOSO (09/09, medido). Antes os 19 canvas eram pintados
       de uma vez no carregamento — FAQ e blog inclusive, que estão a telas de
       distância. Cronometrado: o script custava 157 ms de thread principal
       contra 32 ms do script.js e 1 ms do atendimento.js. Era, sozinho, quase
       cinco vezes todo o resto do nosso JS.

       Agora cada canvas só pinta quando o elemento chega a 300px da viewport.
       O que está na primeira dobra continua pintando na hora (o observer
       dispara imediatamente pra quem já está visível), e o resto sai do
       caminho crítico. O efeito é o mesmo — muda QUANDO, não O QUÊ.

       `rootMargin` de 300px dá folga pro shader compilar antes de a pessoa
       chegar. Sem IntersectionObserver (navegador antigo), pinta na hora,
       que é o comportamento de antes. */
    function revelar() {
      if (revelado) return;
      revelado = true;
      desenhar();
    }

    /* TRÊS CAMINHOS PRA REVELAR, e é de propósito: o vidro nunca pode deixar
       de aparecer só porque um deles não disparou.

       1. Já está na primeira dobra (ou a 300px dela)? Pinta AGORA, síncrono.
          São 1 ou 2 elementos — o custo que sobra no carregamento.
       2. Senão, IntersectionObserver: pinta quando chegar perto.
       3. REDE DE SEGURANÇA: no primeiro scroll, confere de novo na mão.
          O IO pode não disparar em situações que a gente não controla (aba em
          segundo plano, renderização suspensa) — foi exatamente o que
          aconteceu na bancada de medição. Se ele falhar, o primeiro rolar da
          página resolve, e quem rolou está justamente olhando. */
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

    /* 🔴 O cartão-tela do simulador é reescrito por innerHTML a cada passo, o
       que APAGA o canvas junto. Quando `opcoes.persistente`, um MutationObserver
       devolve o canvas pro topo do elemento sempre que ele some — e redesenha,
       porque a altura muda de um passo pro outro. */
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

  /* os 3 passos no tom MISTO (coral entrando na quina de cima à esquerda,
     escurecendo até a de baixo à direita): o coral puro deixava os três
     cartões colados na cor do campo, sem contorno; o misto devolve a
     separação sem virar bloco escuro no meio da parte clara da página. */
  var ok = 0;
  for (var i = 0; i < cards.length; i++) if (montar(cards[i], { dark: true, hibrido: true })) ok++;
  if (ok === cards.length) secao.classList.add('is-vidro-webgl');

  /* ---- o mesmo material no painel de vidro do HERO -----------------------
     O painel do hero tem silhueta recortada por `clip-path` (o degrau onde o
     aparelho encaixa) e o contorno é um SVG por cima. Então aqui o canvas
     entra DENTRO do `.showcase-glass`: quem corta a silhueta continua sendo o
     clip-path do pai, e o shader só precisa preencher o retângulo.
     `traco:false` porque o contorno já existe (o SVG) — desenhar o fio nas
     bordas do retângulo apareceria fora da silhueta.
     Tom HÍBRIDO (coral entrando, dark saindo), o mesmo da tabela e da dobra do
     teto: assim o material do topo da página é o mesmo do fim dela. */
  /* ---- variante DARK: o cartão da assinatura, na dobra da prova ----------
     Mesmo shader, `dark:true`. É a mesma peça do app (o cartão preto do "DAS
     de junho"): vidro quase preto com o coral do campo aparecendo por dentro.
     O texto dele inverte pra branco no CSS. A variante CLARA continua no
     código (`claro:true`), pronta pra quando fizer sentido. */
  var cartaoProva = document.querySelector('.prova-tela');
  if (cartaoProva && montar(cartaoProva, { classe: 'step-vidro', dark: true })) {
    cartaoProva.classList.add('is-vidro-dark');
  }

  /* ---- as perguntas do FAQ, no mesmo tom dark -----------------------------
     Detalhe do <details>: ele muda de altura ao abrir. O ResizeObserver que
     cada canvas já tem redesenha sozinho — foi de graça. */
  var perguntas = document.querySelectorAll('.faq-list details');
  for (var q = 0; q < perguntas.length; q++) {
    if (montar(perguntas[q], { classe: 'step-vidro', dark: true })) {
      perguntas[q].classList.add('is-vidro-dark');
    }
  }

  /* ---- o cartão "Dois planos. Nenhum asterisco." -------------------------
     Tom MISTO, o mesmo dos 3 passos (coral entrando, escurecendo na diagonal).
     Só ele: os dois cartões de PLANO ao lado continuam brancos, porque é lá
     que moram preço, lista e CTA — texto denso sobre vidro escuro cansa e a
     comparação entre os dois planos ficaria mais difícil de ler. */
  var cartaoPlanos = document.querySelector('.planos-copy');
  if (cartaoPlanos && montar(cartaoPlanos, { classe: 'step-vidro', dark: true, hibrido: true })) {
    cartaoPlanos.classList.add('is-vidro-dark');
  }

  /* ---- a tabela de comparação, em vidro HÍBRIDO --------------------------
     Tom MISTO, como o resto da página: coral entrando na quina de cima à
     esquerda (onde fica a nossa coluna) e escurecendo até a de baixo à
     direita, onde ficam "os outros". Já foi dark inteiro por uma rodada — o
     que resolveu o contorno sumido não foi o tom, foi o campo atrás dela ter
     escurecido depois. */
  var tabela = document.querySelector('.vs-table-wrap');
  if (tabela && montar(tabela, { classe: 'step-vidro', dark: true, hibrido: true, traco: false })) {
    tabela.classList.add('is-vidro-hibrido');
  }

  /* ---- a dobra do teto do MEI, no mesmo híbrido --------------------------
     Mesmo material da tabela logo acima: as duas dobras falam do mesmo assunto
     (comparar e crescer) e ficam coladas, então dividir o material amarra as
     duas em um bloco só em vez de dois cartões diferentes. */
  var cartaoTeto = document.querySelector('.crescer-inner');
  if (cartaoTeto && montar(cartaoTeto, { classe: 'step-vidro', dark: true, hibrido: true, traco: false })) {
    cartaoTeto.classList.add('is-vidro-hibrido');
  }

  /* ---- os cartões do blog, no tom CORAL ----------------------------------
     Tom MISTO, o mesmo dos 3 passos e da trilha: o coral entra por cima e o
     cartão escurece na diagonal. Eles vivem no bloco escuro do fim da página,
     então o coral da entrada é justamente o que devolve a separação do fundo
     sem voltar pro branco chapado. */
  var posts = document.querySelectorAll('.blog-grid .bp-link');
  for (var b = 0; b < posts.length; b++) {
    if (montar(posts[b], { classe: 'step-vidro', dark: true, hibrido: true })) posts[b].classList.add('is-vidro-coral');
  }

  /* ---- a trilha de etapas do wizard, no tom misto ------------------------
     Só a COLUNA DA ESQUERDA. O cartão-tela ao lado fica branco: lá a pessoa
     digita CEP, escolhe em select e lê valor em R$ — contraste ali não se
     negocia. A trilha é leitura de acompanhamento (onde estou, o que já
     passou), e é onde o material cabe sem custo. */
  var trilha = document.querySelector('.sim-rail');
  if (trilha && montar(trilha, { classe: 'step-vidro', dark: true, hibrido: true })) {
    trilha.classList.add('is-vidro-misto');
  }

  var vidroHero = document.querySelector('.showcase-glass');
  if (vidroHero && montar(vidroHero, { classe: 'hero-vidro', traco: false, dark: true, hibrido: true })) {
    document.querySelector('.hero-showcase').classList.add('is-vidro-webgl');
  }
})();
