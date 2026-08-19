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
  var consent = $('soon-consent');
  var done = $('soon-done');
  var error = $('soon-error');
  var submitBtn = form.querySelector('.soon-submit');

  console.log('[waitlist-debug] script inicializado', { form: !!form, submitBtn: !!submitBtn });

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
    console.log('[waitlist-debug] submit handler disparado', {
      nome: nome.value, sobrenome: sobrenome.value, email: email.value,
      whatsapp: whatsapp.value, cidade: cidade.value,
      emailValid: email.validity && email.validity.valid,
      whatsappDigits: digits(whatsapp.value).length,
    });
    if (!nome.value.trim() || !sobrenome.value.trim() || !cidade.value.trim()) {
      console.log('[waitlist-debug] bloqueado: nome/sobrenome/cidade vazio');
      return;
    }
    if (!email.value || (email.validity && !email.validity.valid)) {
      console.log('[waitlist-debug] bloqueado: email invalido');
      return;
    }
    if (digits(whatsapp.value).length < 10) {
      console.log('[waitlist-debug] bloqueado: whatsapp com menos de 10 digitos');
      return;
    }
    /* guarda de consentimento LGPD. O `required` do HTML já barra o envio (a
       página não usa novalidate, então o navegador mostra a bolha nativa como
       faz com os outros cinco campos) — esta guarda existe pro caso de o
       atributo cair num refactor: sem ela o formulário voltaria a mandar dado
       pessoal pro backend sem consentimento, e ninguém perceberia. */
    if (!consent.checked) {
      console.log('[waitlist-debug] bloqueado: consentimento LGPD nao marcado');
      return;
    }

    console.log('[waitlist-debug] validacao passou, enviando fetch...');
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
        console.log('[waitlist-debug] resposta recebida', res.status);
        if (!res.ok) throw new Error('request_failed');

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
      })
      .catch(function (err) {
        console.log('[waitlist-debug] erro no fetch', err);
        error.classList.remove('hidden');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
})();
