/* Lista de espera do /em-breve → rota pública do REQ-032 do backend.
   SPDD: spdd/prompt/GGQPA-XXX-202610261605-[Fix]-lista-de-espera-na-api-e-chat-desligado.md
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

  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }

  /* Só os campos do contrato: a API recusa campo extra (400). Tipo de negócio
     e origem do clique não vão, porque o contrato ainda não os aceita. */
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
    return corpo;
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

  /* 400 com privacyAcceptedAt pode ser só o relógio do visitante adiantado
     (a API recusa instante mais de 5 min no futuro): reenvia uma vez sem ele. */
  function enviar(fetchFn, corpo, url) {
    var destino = url || LISTA_ESPERA_API;
    return postar(fetchFn, destino, corpo).then(function (r) {
      if (r.status !== 400 || !corpo.privacyAcceptedAt) return ler(r);
      var semAceite = {};
      Object.keys(corpo).forEach(function (k) { if (k !== 'privacyAcceptedAt') semAceite[k] = corpo[k]; });
      return postar(fetchFn, destino, semAceite).then(ler);
    });
  }

  return {
    LISTA_ESPERA_API: LISTA_ESPERA_API,
    ORIGEM: ORIGEM,
    montarCorpo: montarCorpo,
    postar: postar,
    ler: ler,
    enviar: enviar
  };
});
