/* ============================================================
   LEGALIZAI · Chat do Léo (em-breve)
   Widget de atendimento: visitante conversa com o Léo (agente
   da Legalizai) direto na LP. Primeiro ponto de contato antes
   da integração com WhatsApp. Backend: /site-chat no
   legalizai-backend — o histórico vive lá, chaveado por um
   visitorId gerado aqui e guardado em localStorage.
   ============================================================ */
(function () {
  'use strict';

  var API = 'https://api.legalizai.com.br/site-chat/messages';
  var VISITOR_KEY = 'legalizai_chat_visitor';

  function visitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) {
      /* localStorage bloqueado: id só da aba — histórico não persiste, chat funciona */
      return window.__legalizaiVid || (window.__legalizaiVid = 'v-' + Date.now());
    }
  }

  /* ---------- estilos (tokens da própria LP) ---------- */
  var css = [
    '#lz-chat-btn{position:fixed;right:18px;bottom:18px;z-index:9998;display:flex;align-items:center;gap:10px;',
    'background:var(--coral-600,#DD4E27);color:#fff;border:0;border-radius:999px;padding:14px 20px;cursor:pointer;',
    'font:600 15px var(--font,Sora,sans-serif);box-shadow:var(--shadow-coral,0 8px 24px rgba(242,100,60,.28));transition:transform .15s}',
    '#lz-chat-btn:hover{transform:translateY(-2px)}',
    '#lz-chat{position:fixed;right:18px;bottom:18px;z-index:9999;width:min(370px,calc(100vw - 24px));height:min(540px,calc(100dvh - 40px));',
    'display:none;flex-direction:column;background:#fff;border:1px solid var(--ink-200,#E3DED7);border-radius:20px;overflow:hidden;',
    'box-shadow:0 18px 48px rgba(27,30,36,.22);font-family:var(--font,Sora,sans-serif)}',
    '#lz-chat.aberto{display:flex}',
    '#lz-chat-head{display:flex;align-items:center;gap:11px;padding:14px 16px;background:var(--coral-600,#DD4E27);color:#fff;flex:none}',
    '#lz-chat-head .lz-avatar{width:36px;height:36px;border-radius:50%;background:#fff;color:var(--coral-600,#DD4E27);display:grid;place-items:center;font-weight:800;font-size:15px;flex:none}',
    '#lz-chat-head .lz-nome{font-weight:700;font-size:15px;line-height:1.2}',
    '#lz-chat-head .lz-sub{font-size:11.5px;opacity:.85}',
    '#lz-chat-close{margin-left:auto;background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px 6px}',
    '#lz-chat-msgs{flex:1;min-height:0;overflow-y:auto;padding:14px;background:var(--ink-50,#FAF8F5);display:flex;flex-direction:column;gap:8px}',
    '.lz-msg{max-width:82%;padding:9px 13px;border-radius:15px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.lz-msg.agent{align-self:flex-start;background:#fff;border:1px solid var(--ink-200,#E3DED7);border-bottom-left-radius:5px;color:var(--ink-900,#1B1E24)}',
    '.lz-msg.user{align-self:flex-end;background:var(--coral-600,#DD4E27);color:#fff;border-bottom-right-radius:5px}',
    '.lz-msg.digitando{color:var(--ink-500,#736E67);font-style:italic}',
    '#lz-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid var(--ink-200,#E3DED7);background:#fff;flex:none}',
    '#lz-chat-input{flex:1;border:1px solid var(--ink-200,#E3DED7);border-radius:12px;padding:10px 12px;font:inherit;font-size:13.5px;outline:none}',
    '#lz-chat-input:focus{border-color:var(--coral-500,#F2643C)}',
    '#lz-chat-send{background:var(--coral-600,#DD4E27);color:#fff;border:0;border-radius:12px;padding:0 16px;font:600 13.5px var(--font,Sora,sans-serif);cursor:pointer}',
    '#lz-chat-send:disabled{opacity:.55;cursor:default}',
    '@media (max-width:480px){#lz-chat{right:12px;bottom:12px}}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- DOM ---------- */
  var btn = document.createElement('button');
  btn.id = 'lz-chat-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Abrir chat com o Léo');
  btn.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Fale com o Léo</span>';

  var panel = document.createElement('div');
  panel.id = 'lz-chat';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat com o Léo, atendente da Legalizai');
  panel.innerHTML =
    '<div id="lz-chat-head">' +
      '<div class="lz-avatar" aria-hidden="true">L</div>' +
      '<div><div class="lz-nome">Léo</div><div class="lz-sub">Atendimento Legalizai</div></div>' +
      '<button id="lz-chat-close" type="button" aria-label="Fechar chat">&times;</button>' +
    '</div>' +
    '<div id="lz-chat-msgs" aria-live="polite"></div>' +
    '<form id="lz-chat-form">' +
      '<input id="lz-chat-input" type="text" maxlength="500" placeholder="Escreva sua mensagem…" autocomplete="off">' +
      '<button id="lz-chat-send" type="submit">Enviar</button>' +
    '</form>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('#lz-chat-msgs');
  var form = panel.querySelector('#lz-chat-form');
  var input = panel.querySelector('#lz-chat-input');
  var send = panel.querySelector('#lz-chat-send');
  var carregou = false;

  /* Sempre textContent — nada do que o visitante (ou o modelo) escrever vira HTML. */
  function bolha(role, texto, extraClass) {
    var el = document.createElement('div');
    el.className = 'lz-msg ' + role + (extraClass ? ' ' + extraClass : '');
    el.textContent = texto;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function boasVindas() {
    bolha('agent', 'Oi! Eu sou o Léo, da Legalizai. 👋 Pode me perguntar o que quiser sobre a gente — e se quiser garantir o 1º mês grátis, o formulário está aqui na página.');
  }

  function carregarHistorico() {
    if (carregou) return;
    carregou = true;
    fetch(API + '?visitorId=' + encodeURIComponent(visitorId()))
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (lista) {
        if (!lista.length) { boasVindas(); return; }
        lista.forEach(function (m) { bolha(m.role === 'agent' ? 'agent' : 'user', m.content); });
      })
      .catch(function () { boasVindas(); });
  }

  function abrir() {
    panel.classList.add('aberto');
    btn.style.display = 'none';
    carregarHistorico();
    input.focus();
  }
  function fechar() {
    panel.classList.remove('aberto');
    btn.style.display = 'flex';
  }

  btn.addEventListener('click', abrir);
  panel.querySelector('#lz-chat-close').addEventListener('click', fechar);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var texto = input.value.trim();
    if (!texto || send.disabled) return;

    bolha('user', texto);
    input.value = '';
    send.disabled = true;
    input.disabled = true;
    var digitando = bolha('agent', 'Léo está digitando…', 'digitando');

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId: visitorId(), text: texto })
    })
      .then(function (res) {
        if (res.status === 429) throw new Error('limite');
        if (!res.ok) throw new Error('erro');
        return res.json();
      })
      .then(function (m) {
        digitando.remove();
        bolha('agent', m.content);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'leo_chat_message', form_id: 'lz-chat' });
      })
      .catch(function (err) {
        digitando.remove();
        bolha('agent', err.message === 'limite'
          ? 'Opa, muitas mensagens em sequência — me dá um minutinho e a gente continua. 🙂'
          : 'Tive um problema aqui do meu lado. Pode tentar de novo em instantes?');
      })
      .finally(function () {
        send.disabled = false;
        input.disabled = false;
        input.focus();
      });
  });
})();
