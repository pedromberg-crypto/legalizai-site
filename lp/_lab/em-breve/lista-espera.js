/* Lista de espera do /em-breve → rota pública do REQ-032 do backend.
   SPDD: spdd/prompt/GGQPA-XXX-202610261605-[Fix]-lista-de-espera-na-api-e-chat-desligado.md
         spdd/prompt/GGQPA-XXX-202610261900-[Feat]-tipo-de-negocio-e-clique-na-lista-de-espera.md (REQ-058)
   Só a lógica, sem DOM: o script.js liga o formulário. */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.LzListaEspera = fabrica();
})(this, function () {
  'use strict';

  /* Rota da API (a mesma Lambda do app). Único ponto de configuração. */
  var LISTA_ESPERA_API = 'https://cu2viedkfvwuiuauvvi4guzdnm0ktprm.lambda-url.sa-east-1.on.aws/api/v1/marketing/landing-leads';

  /* `origin` é obrigatório no contrato e o formulário não o coleta:
     o mesmo valor que o site sempre mandou. */
  var ORIGEM = 'coming-soon';
  var TEMPO_LIMITE_MS = 15000;
  var UTM_MAX = 200;
  var UTMS = [
    ['utm_source', 'utmSource'], ['utm_medium', 'utmMedium'], ['utm_campaign', 'utmCampaign'],
    ['utm_content', 'utmContent'], ['utm_term', 'utmTerm']
  ];

  /* REQ-058 — o tipo de negócio (data-business-type da opção) e a origem do
     clique (o que o /origem.js grava). A API recusa (400) o que não estiver
     no formato, então o que não passa aqui simplesmente não vai. */
  var TIPOS_NEGOCIO = ['NEW_COMPANY', 'MIGRATE_MEI', 'MIGRATE_ME'];
  var CLIQUES = ['gclid', 'gbraid', 'wbraid', 'fbclid'];
  var CAMPOS_REQ058 = ['businessType'].concat(CLIQUES, ['landingPage', 'referrer']);
  var ID_CLIQUE = /^[A-Za-z0-9._~-]{1,500}$/;
  var CAMINHO = /^\/[^?#\s]{0,299}$/;
  var REFERRER = /^https?:\/\/[^\s\/?#]+(\/[^?#\s]*)?$/;
  var REFERRER_MAX = 500;

  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }

  /* Corta query e fragmento: é onde mora PII numa URL (e-mail, telefone, token). */
  function semQuery(v) { return texto(v).split(/[?#]/)[0]; }

  /* Só os campos do contrato (REQ-032 + REQ-058): a API recusa campo extra (400). */
  function montarCorpo(c) {
    var partes = texto(c.nomeCompleto).split(/\s+/);
    var corpo = { firstName: partes[0] || '' };
    var sobrenome = partes.slice(1).join(' ');
    if (sobrenome) corpo.lastName = sobrenome;
    corpo.email = texto(c.email);
    corpo.whatsapp = texto(c.whatsapp).replace(/\D/g, '');
    /* "Belo Horizonte - MG" (escolha da lista) vira "Belo Horizonte"; a UF vai em `state` */
    corpo.city = texto(c.cidade).replace(/\s-\s*[A-Za-z]{2}$/, '').trim();
    var uf = texto(c.uf).toUpperCase();
    if (/^[A-Z]{2}$/.test(uf)) corpo.state = uf;
    corpo.origin = ORIGEM;
    var utms = c.utms || {};
    UTMS.forEach(function (par) {
      var v = texto(utms[par[0]]).slice(0, UTM_MAX);
      if (v) corpo[par[1]] = v;
    });
    if (c.aceiteEm) corpo.privacyAcceptedAt = c.aceiteEm;
    var tipo = texto(c.tipoNegocio);
    if (TIPOS_NEGOCIO.indexOf(tipo) >= 0) corpo.businessType = tipo;
    var origem = c.origem && typeof c.origem === 'object' ? c.origem : {};
    CLIQUES.forEach(function (k) {
      var v = texto(origem[k]);
      if (ID_CLIQUE.test(v)) corpo[k] = v;
    });
    var pagina = semQuery(origem.landingPage);
    if (CAMINHO.test(pagina)) corpo.landingPage = pagina;
    var ref = semQuery(origem.referrer);
    if (ref.length <= REFERRER_MAX && REFERRER.test(ref)) corpo.referrer = ref;
    return corpo;
  }

  function sem(corpo, chaves) {
    var resto = {};
    Object.keys(corpo).forEach(function (k) { if (chaves.indexOf(k) < 0) resto[k] = corpo[k]; });
    return resto;
  }

  function postar(fetchFn, url, corpo, ms) {
    var controle = typeof AbortController === 'function' ? new AbortController() : null;
    var relogio = controle ? setTimeout(function () { controle.abort(); }, ms || TEMPO_LIMITE_MS) : null;
    function fim(v) { if (relogio) clearTimeout(relogio); return v; }
    var opcoes = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
    if (controle) opcoes.signal = controle.signal;
    var pedido;
    try { pedido = Promise.resolve(fetchFn(url, opcoes)); } catch (e) { return Promise.resolve(fim({ rede: true })); }
    return pedido.then(function (r) { return fim({ status: r.status }); }, function () { return fim({ rede: true }); });
  }

  function ler(r) {
    return r && !r.rede && r.status >= 200 && r.status < 300 ? { tipo: 'ok' } : { tipo: 'erro' };
  }

  /* Num 400, reenvia em vez de perder o cadastro:
     1º sem os campos do REQ-058 (backend anterior ao REQ-058, ou um valor que
        a API não aceitou), mantendo o aceite;
     2º também sem privacyAcceptedAt (relógio do visitante adiantado: a API
        recusa instante mais de 5 min no futuro).
     Passo que não muda o corpo é pulado; 429, 5xx e rede não reenviam. */
  function enviar(fetchFn, corpo, url) {
    var destino = url || LISTA_ESPERA_API;
    var semNovos = sem(corpo, CAMPOS_REQ058);
    var tentativas = [corpo];
    if (Object.keys(semNovos).length < Object.keys(corpo).length) tentativas.push(semNovos);
    if ('privacyAcceptedAt' in semNovos) tentativas.push(sem(semNovos, ['privacyAcceptedAt']));
    function tentar(i) {
      return postar(fetchFn, destino, tentativas[i]).then(function (r) {
        if (r.status === 400 && i + 1 < tentativas.length) return tentar(i + 1);
        return ler(r);
      });
    }
    return tentar(0);
  }

  return {
    LISTA_ESPERA_API: LISTA_ESPERA_API,
    ORIGEM: ORIGEM,
    TIPOS_NEGOCIO: TIPOS_NEGOCIO,
    CAMPOS_REQ058: CAMPOS_REQ058,
    montarCorpo: montarCorpo,
    postar: postar,
    ler: ler,
    enviar: enviar
  };
});
