/* ============================================================
   LEGALIZAI · Coming Soon
   Envia os dados do formulário pro legalizai-backend, que grava
   cada cadastro numa planilha do Google Sheets.
   ============================================================ */
(function () {
  'use strict';

  var WAITLIST_ENDPOINT = 'https://api.legalizai.com.br/waitlist';

  function $(id) { return document.getElementById(id); }

  var form = $('soon-form');
  var nome = $('soon-nome');
  var sobrenome = $('soon-sobrenome');
  var email = $('soon-email');
  var whatsapp = $('soon-whatsapp');
  var cidade = $('soon-cidade');
  var done = $('soon-done');
  var error = $('soon-error');
  var submitBtn = form.querySelector('.soon-submit');

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

    error.classList.add('hidden');
    submitBtn.disabled = true;

    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome.value.trim(),
        sobrenome: sobrenome.value.trim(),
        email: email.value.trim(),
        whatsapp: whatsapp.value.trim(),
        cidade: cidade.value.trim(),
        origem: 'coming-soon'
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('request_failed');

        /* conversão pro GTM — sem PII, só o sinal do evento */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'waitlist_signup', form_id: 'soon-form' });

        nome.value = '';
        sobrenome.value = '';
        email.value = '';
        whatsapp.value = '';
        cidade.value = '';
        done.classList.remove('hidden');
      })
      .catch(function () {
        error.classList.remove('hidden');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
})();
