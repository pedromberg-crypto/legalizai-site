/* ============================================================
   CONSENTIMENTO DE COOKIES (LGPD) — banner + painel de preferências
   ============================================================

   COMO AS PEÇAS SE ENCAIXAM
   -------------------------
   1. Cada página tem, no <head> e ANTES do GTM/Pixel, um script inline que
      lê a escolha salva e manda o `gtag('consent','default', ...)`. Ele
      precisa ser inline e síncrono: se esperasse este arquivo (defer), o GTM
      já teria disparado as tags sem saber o que a pessoa escolheu.
   2. Este arquivo (defer) só cuida do que é visível: mostra o banner se não
      há escolha salva, abre o painel e, quando a pessoa decide, avisa o
      Google (consent 'update'), a Meta (fbq consent) e o GTM (evento
      `lz_consent_update`, pra tag que não for do Google usar como gatilho).

   ⚠️ A CHAVE, A VERSÃO E A VALIDADE vivem nos dois lugares (aqui e no inline
   do <head> de cada página). Mudou uma, muda a outra. Subir VERSAO faz o
   banner reaparecer pra todo mundo — é o que fazer quando entrar uma
   categoria ou fornecedor novo.

   CATEGORIAS
     · necessários  sempre ligados (esta própria escolha, página de obrigado)
     · análise      Google Analytics        → analytics_storage
     · marketing    Google Ads + Meta Pixel → ad_storage, ad_user_data,
                                              ad_personalization, fbq consent
   ============================================================ */
(function () {
  'use strict';

  var CHAVE = 'lz_consent';
  var VERSAO = 1;
  var VALIDADE_MS = 365 * 24 * 60 * 60 * 1000; // 12 meses, depois pergunta de novo

  function ler() {
    try {
      var c = JSON.parse(localStorage.getItem(CHAVE));
      if (c && c.v === VERSAO && Date.now() - c.t < VALIDADE_MS) return c;
    } catch (e) {}
    return null;
  }

  function gravar(analytics, marketing) {
    var c = { v: VERSAO, t: Date.now(), analytics: !!analytics, marketing: !!marketing };
    /* localStorage bloqueado (aba anônima de alguns navegadores): a escolha
       vale só nesta página, e o banner volta na próxima. Melhor que travar. */
    try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  /* Quem aceitou e depois voltou atrás não pode continuar com os cookies que
     as tags já gravaram. Apaga os de análise/marketing conhecidos, no host e
     no domínio-pai (o GA grava em .legalizai.com.br). */
  var COOKIES_ANALISE = /^(_ga|_ga_.*|_gid|_gat.*)$/;
  var COOKIES_MARKETING = /^(_gcl_.*|_fbp|_fbc)$/;

  function apagarCookies(regex) {
    var host = location.hostname;
    var dominios = ['', host, '.' + host.replace(/^www\./, '')];
    document.cookie.split(';').forEach(function (par) {
      var nome = par.split('=')[0].trim();
      if (!regex.test(nome)) return;
      dominios.forEach(function (d) {
        document.cookie = nome + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  function aplicar(c) {
    var a = c.analytics ? 'granted' : 'denied';
    var m = c.marketing ? 'granted' : 'denied';
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    window.gtag('consent', 'update', {
      analytics_storage: a,
      ad_storage: m,
      ad_user_data: m,
      ad_personalization: m
    });
    window.gtag('set', 'ads_data_redaction', m === 'denied');
    window.dataLayer.push({
      event: 'lz_consent_update',
      lz_consent_analytics: a,
      lz_consent_marketing: m
    });
    window.lzMarketing = !!c.marketing;
    if (typeof window.fbq === 'function') window.fbq('consent', c.marketing ? 'grant' : 'revoke');
    if (!c.analytics) apagarCookies(COOKIES_ANALISE);
    if (!c.marketing) apagarCookies(COOKIES_MARKETING);
  }

  /* ─── ESTILO ────────────────────────────────────────────────────────────
     Injetado daqui porque o banner roda em páginas com CSS diferentes (LP,
     páginas legais, /em-breve em Tailwind). Tudo prefixado com .lzc- e com
     cor fixa: não herda nada de ninguém, então não quebra quando o CSS de
     uma página mudar. Fica em cima de tudo (overlay), fora do fluxo — não
     mexe no "cabe sem rolagem" do desktop do /em-breve. */
  var CSS = [
    '.lzc-banner,.lzc-painel{font-family:"Sora",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1B1E24;-webkit-font-smoothing:antialiased;box-sizing:border-box}',
    '.lzc-banner *,.lzc-painel *{box-sizing:border-box}',
    /* respiro lateral por PADDING do contêiner, não por margem do card: a
       faixa fixa ocupa a largura toda e tem 16px (o gutter do site) de cada
       lado; o card é 100% dela. Na versão com margin:auto o card encostava na
       esquerda do /em-breve no mobile (29/09). env() respeita o notch. A
       faixa não pega clique (pointer-events), só o card. */
    '.lzc-faixa{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;padding:0 16px max(16px,env(safe-area-inset-bottom));pointer-events:none;box-sizing:border-box}',
    '.lzc-banner{pointer-events:auto;width:100%;max-width:1040px;margin:0;background:#fff;border:1px solid #E3DED7;border-radius:16px;box-shadow:0 14px 40px rgba(27,30,36,.18);padding:14px 16px;display:flex;flex-direction:column;gap:10px;animation:lzc-sobe .25s ease-out}',
    '.lzc-banner p{margin:0;font-size:.78rem;line-height:1.5;color:#34363C}',
    '.lzc-banner strong{color:#1B1E24}',
    '.lzc-banner a,.lzc-painel a{color:#B83D1C;font-weight:600}',
    '.lzc-acoes{display:flex;flex-wrap:wrap;gap:8px}',
    '.lzc-btn{font:inherit;font-size:.82rem;font-weight:600;min-height:44px;padding:10px 18px;border-radius:999px;cursor:pointer;border:1.5px solid transparent;flex:1 1 auto;transition:background-color .15s,border-color .15s,color .15s}',
    '.lzc-btn:focus-visible,.lzc-toggle input:focus-visible+span{outline:3px solid #F47F58;outline-offset:2px}',
    /* 🔄 29/09 — decisão do Pedro: no BANNER só "Aceitar" é botão; rejeitar
       e personalizar viram link dentro do texto (padrão da maioria dos sites
       BR). Continua 1 clique pra rejeitar, que é o que segura a regra da ANPD
       de "rejeitar tão fácil quanto aceitar". Não esconder mais que isso.
       No PAINEL os três botões seguem iguais. */
    '.lzc-link{font:inherit;font-weight:600;color:#B83D1C;background:none;border:0;padding:0;margin:0;text-decoration:underline;cursor:pointer}',
    '.lzc-link:hover{color:#8C2F16}',
    '.lzc-link:focus-visible{outline:3px solid #F47F58;outline-offset:2px;border-radius:4px}',
    '.lzc-sim{background:#F2643C;color:#fff}',
    '.lzc-sim:hover{background:#DD4E27}',
    '.lzc-nao{background:#1B1E24;color:#fff}',
    '.lzc-nao:hover{background:#34363C}',
    '.lzc-mais{background:#fff;color:#1B1E24;border-color:#CBC5BC}',
    '.lzc-mais:hover{border-color:#1B1E24}',
    '.lzc-fundo{position:fixed;inset:0;z-index:2147483001;background:rgba(27,30,36,.55);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.lzc-painel{background:#fff;border-radius:20px;width:100%;max-width:560px;max-height:calc(100vh - 32px);overflow-y:auto;padding:22px 20px 18px;box-shadow:0 24px 60px rgba(27,30,36,.3)}',
    '.lzc-painel h2{margin:0 0 6px;font-size:1.15rem;font-weight:700;line-height:1.3}',
    '.lzc-painel > p{margin:0 0 14px;font-size:.8rem;line-height:1.55;color:#524E48}',
    '.lzc-cat{border:1px solid #E3DED7;border-radius:14px;padding:12px 14px;margin-bottom:10px}',
    '.lzc-cat-topo{display:flex;align-items:center;justify-content:space-between;gap:12px}',
    '.lzc-cat h3{margin:0;font-size:.9rem;font-weight:700}',
    '.lzc-cat p{margin:6px 0 0;font-size:.74rem;line-height:1.5;color:#736E67}',
    '.lzc-fixo{font-size:.7rem;font-weight:600;color:#736E67;white-space:nowrap}',
    '.lzc-toggle{position:relative;display:inline-flex;flex:none;cursor:pointer}',
    '.lzc-toggle input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}',
    '.lzc-toggle span{display:block;width:46px;height:26px;border-radius:999px;background:#CBC5BC;position:relative;transition:background-color .15s}',
    '.lzc-toggle span::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}',
    '.lzc-toggle input:checked+span{background:#F2643C}',
    '.lzc-toggle input:checked+span::after{transform:translateX(20px)}',
    '.lzc-painel .lzc-acoes{margin-top:14px}',
    '.lzc-painel-rodape{margin:12px 0 0;font-size:.72rem;color:#736E67;text-align:center}',
    '@keyframes lzc-sobe{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}',
    '@media (min-width:900px){.lzc-banner{flex-direction:row;align-items:center;gap:20px;padding:16px 20px}.lzc-banner p{flex:1}.lzc-banner .lzc-acoes{flex:none;flex-wrap:nowrap}.lzc-btn{flex:none}.lzc-painel{padding:28px 28px 22px}}',
    '@media (prefers-reduced-motion:reduce){.lzc-banner{animation:none}.lzc-btn,.lzc-toggle span,.lzc-toggle span::after{transition:none}}'
  ].join('');

  function injetarCss() {
    if (document.getElementById('lzc-css')) return;
    var s = document.createElement('style');
    s.id = 'lzc-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ─── BANNER ───────────────────────────────────────────────────────── */
  var banner = null;

  function fecharBanner() {
    if (banner) { banner.remove(); banner = null; }
  }

  function decidir(analytics, marketing) {
    aplicar(gravar(analytics, marketing));
    fecharBanner();
    fecharPainel();
  }

  function mostrarBanner() {
    if (banner) return;
    injetarCss();
    // `banner` é a faixa (é ela que sai do DOM ao decidir); o card vai dentro
    banner = document.createElement('div');
    banner.className = 'lzc-faixa';
    var card = document.createElement('section');
    card.className = 'lzc-banner';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Aviso de cookies');
    banner.appendChild(card);
    card.innerHTML =
      /* texto enxuto (~150 caracteres, era ~290): mantém o que o consentimento
         precisa ter pra valer — o quê (cookies), pra quê (medir visitas e
         anúncios), que depende de permissão, como recusar e onde ler mais. */
      '<p><strong>Usamos cookies</strong> pro site funcionar e, com a sua permissão, ' +
      'pra medir visitas e anúncios. Você pode ' +
      '<button type="button" class="lzc-link" data-lzc="rejeitar">rejeitar</button> ou ' +
      '<button type="button" class="lzc-link" data-lzc="personalizar">escolher quais</button>. ' +
      '<a href="/cookies">Saiba mais</a></p>' +
      '<div class="lzc-acoes">' +
        '<button type="button" class="lzc-btn lzc-sim" data-lzc="aceitar">Aceitar cookies</button>' +
      '</div>';
    card.addEventListener('click', function (e) {
      var acao = e.target.closest('[data-lzc]');
      if (!acao) return;
      var qual = acao.getAttribute('data-lzc');
      if (qual === 'aceitar') decidir(true, true);
      else if (qual === 'rejeitar') decidir(false, false);
      else abrirPainel();
    });
    document.body.appendChild(banner);
  }

  /* ─── PAINEL DE PREFERÊNCIAS ───────────────────────────────────────── */
  var fundo = null;
  var focoAntes = null;

  function categoria(id, titulo, texto, marcado, fixo) {
    var controle = fixo
      ? '<span class="lzc-fixo">Sempre ativos</span>'
      : '<label class="lzc-toggle"><input type="checkbox" role="switch" id="lzc-' + id + '"' +
        (marcado ? ' checked' : '') + ' aria-describedby="lzc-' + id + '-txt"><span aria-hidden="true"></span></label>';
    return '<div class="lzc-cat"><div class="lzc-cat-topo">' +
      (fixo ? '<h3>' + titulo + '</h3>' : '<h3><label for="lzc-' + id + '">' + titulo + '</label></h3>') +
      controle + '</div><p id="lzc-' + id + '-txt">' + texto + '</p></div>';
  }

  function fecharPainel() {
    if (!fundo) return;
    fundo.remove();
    fundo = null;
    document.removeEventListener('keydown', teclado);
    if (focoAntes && document.contains(focoAntes)) focoAntes.focus();
  }

  function teclado(e) {
    if (!fundo) return;
    if (e.key === 'Escape') { fecharPainel(); return; }
    if (e.key !== 'Tab') return;
    // prende o Tab dentro do painel enquanto ele está aberto (aria-modal)
    var foco = fundo.querySelectorAll('a[href],button,input');
    var primeiro = foco[0], ultimo = foco[foco.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  function abrirPainel() {
    if (fundo) return;
    injetarCss();
    focoAntes = document.activeElement;
    // painel reaberto mostra a escolha atual; primeira vez, tudo desligado
    var atual = ler() || { analytics: false, marketing: false };
    fundo = document.createElement('div');
    fundo.className = 'lzc-fundo';
    fundo.innerHTML =
      '<div class="lzc-painel" role="dialog" aria-modal="true" aria-labelledby="lzc-titulo">' +
        '<h2 id="lzc-titulo">Preferências de cookies</h2>' +
        '<p>Escolha o que você permite. Dá pra mudar quando quiser, pelo link ' +
        '"Cookies" no rodapé do site.</p>' +
        categoria('necessarios', 'Necessários',
          'Fazem o site funcionar: guardam esta sua escolha e levam seus dados do cadastro ' +
          'até a página de confirmação. Não dá pra desligar.', true, true) +
        categoria('analise', 'Análise',
          'Google Analytics. Conta visitas e mostra quais páginas funcionam, sem identificar você.',
          atual.analytics, false) +
        categoria('marketing', 'Marketing',
          'Google Ads e Meta Pixel (Facebook e Instagram). Medem se nossos anúncios trouxeram ' +
          'você e ajudam a mostrar anúncios mais relevantes.', atual.marketing, false) +
        '<div class="lzc-acoes">' +
          '<button type="button" class="lzc-btn lzc-nao" data-lzc="rejeitar">Rejeitar todos</button>' +
          '<button type="button" class="lzc-btn lzc-mais" data-lzc="salvar">Salvar preferências</button>' +
          '<button type="button" class="lzc-btn lzc-sim" data-lzc="aceitar">Aceitar todos</button>' +
        '</div>' +
        '<p class="lzc-painel-rodape">Detalhes de cada cookie na <a href="/cookies">Política de cookies</a>.</p>' +
      '</div>';
    fundo.addEventListener('click', function (e) {
      if (e.target === fundo) { fecharPainel(); return; }
      var acao = e.target.closest('[data-lzc]');
      if (!acao) return;
      var qual = acao.getAttribute('data-lzc');
      if (qual === 'aceitar') decidir(true, true);
      else if (qual === 'rejeitar') decidir(false, false);
      else decidir(document.getElementById('lzc-analise').checked, document.getElementById('lzc-marketing').checked);
    });
    document.body.appendChild(fundo);
    document.addEventListener('keydown', teclado);
    fundo.querySelector('input,button').focus();
  }

  /* ─── LIGAÇÃO COM A PÁGINA ──────────────────────────────────────────────
     Qualquer link com [data-lz-cookies] (o "Cookies" do rodapé) abre o
     painel. Sem JS, o href="/cookies" continua levando pra política. */
  document.addEventListener('click', function (e) {
    var gatilho = e.target.closest && e.target.closest('[data-lz-cookies]');
    if (!gatilho) return;
    e.preventDefault();
    abrirPainel();
  });

  window.lzConsent = { abrir: abrirPainel, ler: ler };

  if (!ler()) mostrarBanner();
})();
