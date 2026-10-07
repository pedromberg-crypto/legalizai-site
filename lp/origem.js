
(function () {
  'use strict';
  var ORIGEM_KEY = 'legalizai_origem';
  var UTM_KEY = 'legalizai_utm';
  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var CLIQUES = ['gclid', 'gbraid', 'wbraid', 'fbclid'];
  var params, salvo = null;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
  try { salvo = JSON.parse(sessionStorage.getItem(ORIGEM_KEY)); } catch (e) {}
  function ler(chaves) {
    var achou = null;
    chaves.forEach(function (k) {
      var v = params.get(k);
      if (v) { achou = achou || {}; achou[k] = v.slice(0, 500); }
    });
    return achou;
  }
  var utms = ler(UTMS);
  var cliques = ler(CLIQUES);
  var refExterno = '';
  var veioDeDentro = false;
  try {
    if (document.referrer) {
      if (new URL(document.referrer).hostname === window.location.hostname) veioDeDentro = true;
      else refExterno = document.referrer.slice(0, 500);
    }
  } catch (e) {}
  if (salvo && (veioDeDentro || (!utms && !cliques))) return;
  var origem = { landingPage: window.location.pathname, referrer: refExterno };
  if (cliques) CLIQUES.forEach(function (k) { if (cliques[k]) origem[k] = cliques[k]; });
  try {
    sessionStorage.setItem(ORIGEM_KEY, JSON.stringify(origem));
    if (utms) sessionStorage.setItem(UTM_KEY, JSON.stringify(utms));
    else sessionStorage.removeItem(UTM_KEY);
  } catch (e) {}
})();
