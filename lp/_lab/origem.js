/* ============================================================
   ORIGEM DA VISITA — de onde a pessoa chegou, pra ir junto do cadastro
   ============================================================

   Por que existe (auditoria de 07/10/2026): o anúncio do Google Ads cai na
   HOME, mas quem lia UTM era só o /em-breve, onde o formulário está. Os CTAs
   da home vão pra "/em-breve" sem query, então todo lead vindo de anúncio
   chegava ao backend sem UTM e sem gclid: impossível saber de qual campanha
   veio, e impossível importar conversão offline depois.

   O que faz: na PRIMEIRA página da sessão (ou quando chega um clique novo de
   anúncio vindo de fora), grava no sessionStorage:
     · legalizai_origem → gclid/gbraid/wbraid/fbclid, página de entrada e
       referrer externo. O /em-breve/script.js lê e manda no cadastro.
     · legalizai_utm    → as UTMs, na MESMA chave que o /em-breve já lia
       como reserva quando a URL dele vem sem UTM.

   Navegação interna não sobrescreve nada. Isso importa porque, com o
   consentimento negado, o url_passthrough do Google repete o gclid nos links
   internos: sem essa trava, a "página de entrada" virava /em-breve.

   sessionStorage (e não cookie/localStorage) de propósito: some ao fechar a
   aba, não identifica ninguém sozinho e só sai do navegador junto do
   cadastro que a pessoa enviou. Está na tabela de /cookies como necessário.

   Carregado com `defer` ANTES dos outros scripts da página, pra já ter
   gravado quando o /em-breve/script.js rodar.
   ============================================================ */
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

  /* Já tem origem nesta aba e esta visita não é um clique novo vindo de fora:
     fica a que estava (é a que trouxe a pessoa). */
  if (salvo && (veioDeDentro || (!utms && !cliques))) return;

  var origem = { landingPage: window.location.pathname, referrer: refExterno };
  if (cliques) CLIQUES.forEach(function (k) { if (cliques[k]) origem[k] = cliques[k]; });

  try {
    sessionStorage.setItem(ORIGEM_KEY, JSON.stringify(origem));
    /* origem nova sem UTM apaga a UTM antiga: senão o gclid de agora iria pro
       cadastro com a campanha de uma visita anterior da mesma aba */
    if (utms) sessionStorage.setItem(UTM_KEY, JSON.stringify(utms));
    else sessionStorage.removeItem(UTM_KEY);
  } catch (e) {}
})();
