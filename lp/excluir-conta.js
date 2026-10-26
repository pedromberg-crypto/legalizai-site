/* Exclusão de conta pela página pública (REQ-056 do backend).
   SPDD: spdd/prompt/GGQPA-XXX-202610261520-[Feat]-excluir-conta-pela-api.md
   Só a lógica, sem DOM: a página /excluir-conta liga os eventos. */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.LzExclusao = fabrica();
})(this, function () {
  'use strict';

  /* Base da API, a mesma do app. Único ponto de configuração.
     Vazio = a página manda sempre o pedido por e-mail. */
  var EXCLUSAO_API = 'https://cu2viedkfvwuiuauvvi4guzdnm0ktprm.lambda-url.sa-east-1.on.aws/api/v1/';

  var PRAZO_PADRAO_DIAS = 30;
  var ESPERA_PADRAO_S = 60;
  var TEMPO_LIMITE_MS = 15000;

  function usaApi(opcao, base) {
    return opcao === 'conta' && !!(base === undefined ? EXCLUSAO_API : base);
  }

  function rota(nome, base) {
    var b = base === undefined ? EXCLUSAO_API : base;
    if (b.charAt(b.length - 1) !== '/') b += '/';
    return b + (nome === 'codigo' ? 'account-deletion/code' : 'account-deletion');
  }

  function corpoDoCodigo(email) {
    return { email: String(email).trim(), kind: 'ACCOUNT' };
  }

  function corpoDaConfirmacao(email, codigo) {
    return { email: String(email).trim(), code: String(codigo), kind: 'ACCOUNT' };
  }

  /* Resolve sempre: { status, corpo, retryAfter } ou { rede: true }
     (sem rede, CORS bloqueado ou tempo esgotado). */
  function postar(fetchFn, url, corpo, ms) {
    var controle = typeof AbortController === 'function' ? new AbortController() : null;
    var relogio = controle ? setTimeout(function () { controle.abort(); }, ms || TEMPO_LIMITE_MS) : null;
    function fim(v) { if (relogio) clearTimeout(relogio); return v; }
    var opcoes = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) };
    if (controle) opcoes.signal = controle.signal;
    var pedido;
    try { pedido = Promise.resolve(fetchFn(url, opcoes)); } catch (e) { return Promise.resolve(fim({ rede: true })); }
    return pedido.then(function (r) {
      var retryAfter = r.headers && r.headers.get ? r.headers.get('Retry-After') : null;
      return r.json().catch(function () { return {}; }).then(function (c) {
        return fim({ status: r.status, corpo: c || {}, retryAfter: retryAfter });
      });
    }, function () { return fim({ rede: true }); });
  }

  function segundosDeEspera(retryAfter, agora) {
    if (retryAfter === null || retryAfter === undefined || retryAfter === '') return ESPERA_PADRAO_S;
    var s = String(retryAfter).trim();
    if (/^\d+$/.test(s)) return Math.max(1, parseInt(s, 10));
    var data = Date.parse(s);
    if (!isNaN(data)) {
      var dif = Math.ceil((data - (agora === undefined ? Date.now() : agora)) / 1000);
      return dif >= 1 ? dif : ESPERA_PADRAO_S;
    }
    return ESPERA_PADRAO_S;
  }

  function codigoDoErro(r) { return (r.corpo && r.corpo.code) || ''; }

  function lerCodigo(r) {
    if (r.rede) return { tipo: 'manual' };
    if (r.status >= 200 && r.status < 300) return { tipo: 'codigo' };
    if (r.status === 429) return { tipo: 'espera', segundos: segundosDeEspera(r.retryAfter) };
    if (r.status === 400) return { tipo: 'emailInvalido' };
    return { tipo: 'manual' };
  }

  function lerConfirmacao(r) {
    if (r.rede) return { tipo: 'manual' };
    if (r.status === 200) {
      var g = r.corpo && r.corpo.graceDays;
      return { tipo: 'recebido', graceDays: (typeof g === 'number' && g > 0 && g % 1 === 0) ? g : PRAZO_PADRAO_DIAS };
    }
    if (r.status === 429) return { tipo: 'espera', segundos: segundosDeEspera(r.retryAfter) };
    if (r.status === 400) return { tipo: 'incorreto' };
    if (r.status === 422 && codigoDoErro(r) === 'VERIFICATION_CODE_INVALID') return { tipo: 'incorreto' };
    if (r.status === 422 && codigoDoErro(r) === 'VERIFICATION_CODE_EXPIRED') return { tipo: 'vencido' };
    return { tipo: 'manual' };
  }

  function textoEspera(segundos) {
    if (segundos < 120) return 'Muitas tentativas. Tente de novo em ' + segundos + ' segundos.';
    return 'Muitas tentativas. Tente de novo em ' + Math.ceil(segundos / 60) + ' minutos.';
  }

  function mascarar(e) {
    var p = String(e).split('@');
    return p[0].slice(0, 2) + '•••@' + (p[1] || '');
  }

  function textosRecebido(graceDays, email) {
    return {
      principal: 'Sua conta foi desativada agora. A exclusão termina em ' + graceDays + ' dias.',
      confirmacao: 'Enviamos a confirmação para ' + mascarar(email) + '.',
      desfazer: 'Mudou de ideia? Entre de novo no app com seu e-mail e senha em até ' + graceDays + ' dias e tudo volta como estava.'
    };
  }

  var TEXTOS = {
    incorreto: 'Código incorreto.',
    vencido: 'Este código venceu. Peça um novo.',
    emailInvalido: 'Confira o e-mail.',
    motivoOutraOpcao: 'Por enquanto, este pedido é feito por e-mail.',
    motivoFalha: 'Não conseguimos enviar o código agora.'
  };

  function textoReenvio(segundos) {
    return 'Não chegou? Confira o spam ou peça um novo em ' + segundos + 's.';
  }

  return {
    EXCLUSAO_API: EXCLUSAO_API,
    ESPERA_REENVIO_S: 60,
    TEXTOS: TEXTOS,
    usaApi: usaApi,
    rota: rota,
    corpoDoCodigo: corpoDoCodigo,
    corpoDaConfirmacao: corpoDaConfirmacao,
    postar: postar,
    segundosDeEspera: segundosDeEspera,
    lerCodigo: lerCodigo,
    lerConfirmacao: lerConfirmacao,
    textoEspera: textoEspera,
    textoReenvio: textoReenvio,
    textosRecebido: textosRecebido,
    mascarar: mascarar
  };
});
