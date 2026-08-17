/* ============================================================
   LEGALIZAI · Coming Soon — 100% client-side, zero backend
   Captura fake (mesmo padrão do wait-form da LP principal):
   sem persistência real, só confirma visualmente pro usuário.
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var form = $('soon-form');
  var nome = $('soon-nome');
  var sobrenome = $('soon-sobrenome');
  var email = $('soon-email');
  var whatsapp = $('soon-whatsapp');
  var cidade = $('soon-cidade');
  var consent = $('soon-consent');
  var done = $('soon-done');

  function digits(s) { return (s || '').replace(/\D/g, ''); }

  /* máscara (00) 00000-0000, preservando a posição do cursor */
  whatsapp.addEventListener('input', function () {
    var caret = whatsapp.selectionStart || 0;
    var digitsBefore = digits(whatsapp.value.slice(0, caret)).length;
    var d = digits(whatsapp.value).slice(0, 11);
    var out = d;
    if (d.length > 2) out = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 7) out = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    whatsapp.value = out;
    var pos = 0, seen = 0;
    while (pos < out.length && seen < digitsBefore) { if (/\d/.test(out[pos])) seen++; pos++; }
    whatsapp.setSelectionRange(pos, pos);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!nome.value.trim() || !sobrenome.value.trim() || !cidade.value.trim()) return;
    if (!email.value || (email.validity && !email.validity.valid)) return;
    if (digits(whatsapp.value).length < 10) return;
    /* guarda de consentimento. O `required` do HTML já barra o envio (a página
       não usa novalidate, então o navegador mostra a bolha nativa como faz com
       os outros campos) — esta linha existe pro caso de o atributo cair num
       refactor: sem ela, o formulário voltaria a enviar sem consentimento e
       ninguém perceberia. */
    if (!consent.checked) return;

    /* conversão pro GTM — sem PII, só o sinal do evento */
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'waitlist_signup', form_id: 'soon-form', lgpd_consent: true });

    nome.value = '';
    sobrenome.value = '';
    email.value = '';
    whatsapp.value = '';
    cidade.value = '';
    consent.checked = false;   /* o próximo envio precisa de consentimento novo */
    done.classList.remove('hidden');
  });
})();
