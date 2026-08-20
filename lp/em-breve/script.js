/* ============================================================
   LEGALIZAI · Coming Soon
   Envia os dados do formulário pro legalizai-backend, que grava
   cada cadastro numa planilha do Google Sheets.
   ============================================================ */
(function () {
  'use strict';

  var WAITLIST_ENDPOINT = 'https://api.legalizai.com.br/waitlist';
  var MUNICIPIOS_URL = '/em-breve/assets/municipios.json';
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var UTM_STORAGE_KEY = 'legalizai_utm';

  function $(id) { return document.getElementById(id); }

  /* O Meta preenche utm_campaign={{campaign.name}}, utm_content={{adset.name}}
     e utm_term={{ad.name}} dinamicamente na URL do anúncio (taxonomia de
     tráfego pago). UTM presente na URL vale e sobrescreve o que tinha salvo;
     URL sem UTM (usuário navegou/recarregou depois do clique) reaproveita a
     última capturada na sessão em vez de perder a origem. */
  function captureUtms() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = {};
    var hasAny = false;
    UTM_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value) { fromUrl[key] = value.slice(0, 200); hasAny = true; }
    });
    if (hasAny) {
      try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl)); } catch (e) {}
      return fromUrl;
    }
    try {
      var saved = sessionStorage.getItem(UTM_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  var utms = captureUtms();

  var form = $('soon-form');
  var nome = $('soon-nome');
  var email = $('soon-email');
  var whatsapp = $('soon-whatsapp');
  var cidade = $('soon-cidade');
  var acList = $('soon-cidade-list');
  var consent = $('soon-consent');
  var done = $('soon-done');
  var error = $('soon-error');
  var submitBtn = form.querySelector('.soon-submit');

  console.log('[waitlist-debug] script inicializado', { form: !!form, submitBtn: !!submitBtn });

  function digits(s) { return (s || '').replace(/\D/g, ''); }

  /* separa "Nome completo" em nome/sobrenome pro contrato existente do backend */
  function splitNome(fullName) {
    var parts = fullName.trim().split(/\s+/);
    return { nome: parts[0], sobrenome: parts.slice(1).join(' ') || parts[0] };
  }

  /* ---------- autocomplete de cidade (lista oficial do IBGE) ----------
     Sugestão, não trava: o campo continua aceitando texto livre. O JSON
     (~120KB) só é buscado no primeiro foco do campo, pra não pesar no
     carregamento da página — quem nunca chega no formulário nunca baixa. */
  var AC_LIMIT = 8;
  /* Sem esse empurrão a ordem alfabética enterra a cidade óbvia: "bel" traria
     oito "Bela Vista do ..." e nenhuma Belo Horizonte, "rio" nenhuma Rio de
     Janeiro. Capitais + região metropolitana de BH (a base do escritório)
     sobem pro topo; o resto desempata por nome mais curto. */
  var CIDADES_PRIORITARIAS = [
    'Belo Horizonte|MG', 'Contagem|MG', 'Betim|MG', 'Nova Lima|MG', 'Uberlândia|MG', 'Juiz de Fora|MG',
    'São Paulo|SP', 'Rio de Janeiro|RJ', 'Brasília|DF', 'Salvador|BA', 'Fortaleza|CE', 'Curitiba|PR',
    'Recife|PE', 'Porto Alegre|RS', 'Manaus|AM', 'Belém|PA', 'Goiânia|GO', 'São Luís|MA', 'Maceió|AL',
    'Natal|RN', 'Campo Grande|MS', 'Teresina|PI', 'João Pessoa|PB', 'Cuiabá|MT', 'Aracaju|SE',
    'Florianópolis|SC', 'Vitória|ES', 'Porto Velho|RO', 'Macapá|AP', 'Rio Branco|AC', 'Boa Vista|RR',
    'Palmas|TO', 'Guarulhos|SP', 'Campinas|SP', 'Osasco|SP', 'Santo André|SP', 'Sorocaba|SP',
    'Ribeirão Preto|SP', 'São Bernardo do Campo|SP', 'Niterói|RJ', 'Duque de Caxias|RJ',
    'Londrina|PR', 'Joinville|SC', 'Caxias do Sul|RS'
  ];
  var municipios = null;
  var acMatches = [];
  var acIndex = -1;
  var acLoading = false;

  /* "São Gonçalo" e "sao goncalo" precisam casar: tira acento e caixa */
  function normalize(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function loadMunicipios() {
    if (municipios || acLoading) return;
    acLoading = true;
    fetch(MUNICIPIOS_URL)
      .then(function (res) { return res.json(); })
      .then(function (list) {
        var prioridade = Object.create(null);
        CIDADES_PRIORITARIAS.forEach(function (k) { prioridade[k] = true; });
        municipios = list.map(function (item) {
          return {
            nome: item[0], uf: item[1], busca: normalize(item[0]),
            peso: prioridade[item[0] + '|' + item[1]] ? 0 : 1
          };
        });
        if (document.activeElement === cidade) renderMatches(cidade.value);
      })
      .catch(function (err) {
        console.log('[waitlist-debug] falha ao carregar municipios', err);
        acLoading = false;
      });
  }

  function closeList() {
    acList.classList.add('hidden');
    acList.innerHTML = '';
    cidade.setAttribute('aria-expanded', 'false');
    cidade.removeAttribute('aria-activedescendant');
    acMatches = [];
    acIndex = -1;
  }

  /* Quem começa com o que foi digitado vem antes de quem só contém: "sao pau"
     mostra São Paulo antes de Nova São Paulo. Dentro de cada grupo vale o peso
     (capital/RMBH primeiro) e depois o nome mais curto. */
  function rankMatch(a, b) {
    return a.peso - b.peso || a.nome.length - b.nome.length || a.nome.localeCompare(b.nome, 'pt');
  }

  function findMatches(query) {
    var q = normalize(query);
    if (!q || !municipios) return [];
    var prefix = [], contains = [], i;
    for (i = 0; i < municipios.length; i++) {
      if (municipios[i].busca.lastIndexOf(q, 0) === 0) prefix.push(municipios[i]);
    }
    prefix.sort(rankMatch);
    /* prefixo sempre vence "contém", então com o limite já cheio a segunda
       varredura seria jogada fora pelo slice — em "a" isso é o corpo inteiro
       dos 5571 municípios a cada tecla */
    if (prefix.length >= AC_LIMIT) return prefix.slice(0, AC_LIMIT);

    for (i = 0; i < municipios.length; i++) {
      if (municipios[i].busca.indexOf(q) > 0) contains.push(municipios[i]);
    }
    contains.sort(rankMatch);
    return prefix.concat(contains).slice(0, AC_LIMIT);
  }

  /* monta o <li> por nó de DOM (nunca innerHTML): o nome vem de um JSON
     externo e o trecho destacado vem do que o usuário digitou */
  function buildOption(item, query, index) {
    var li = document.createElement('li');
    li.className = 'soon-ac-option';
    li.id = 'soon-ac-opt-' + index;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');

    var label = document.createElement('span');
    var at = item.busca.indexOf(normalize(query));
    var len = normalize(query).length;
    if (at >= 0 && len > 0) {
      label.appendChild(document.createTextNode(item.nome.slice(0, at)));
      var mark = document.createElement('mark');
      mark.textContent = item.nome.slice(at, at + len);
      label.appendChild(mark);
      label.appendChild(document.createTextNode(item.nome.slice(at + len)));
    } else {
      label.textContent = item.nome;
    }

    var uf = document.createElement('span');
    uf.className = 'soon-ac-uf';
    uf.textContent = item.uf;

    li.appendChild(label);
    li.appendChild(uf);
    return li;
  }

  function renderMatches(query) {
    acMatches = findMatches(query);
    acIndex = -1;
    acList.innerHTML = '';
    cidade.removeAttribute('aria-activedescendant');

    if (!acMatches.length) { closeList(); return; }

    var frag = document.createDocumentFragment();
    acMatches.forEach(function (item, i) { frag.appendChild(buildOption(item, query, i)); });
    acList.appendChild(frag);
    acList.classList.remove('hidden');
    cidade.setAttribute('aria-expanded', 'true');
  }

  function highlight(next) {
    if (!acMatches.length) return;
    var options = acList.children;
    if (acIndex >= 0) options[acIndex].setAttribute('aria-selected', 'false');
    acIndex = (next + acMatches.length) % acMatches.length;
    var active = options[acIndex];
    active.setAttribute('aria-selected', 'true');
    cidade.setAttribute('aria-activedescendant', active.id);
    /* mantém a opção destacada visível quando a lista rola */
    if (active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function choose(index) {
    if (index < 0 || index >= acMatches.length) return;
    cidade.value = acMatches[index].nome;
    closeList();
  }

  cidade.addEventListener('focus', loadMunicipios);
  cidade.addEventListener('input', function () { renderMatches(cidade.value); });

  cidade.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(acIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(acIndex - 1); }
    else if (e.key === 'Enter' && acIndex >= 0) {
      /* Enter com opção destacada escolhe a cidade em vez de enviar o form */
      e.preventDefault();
      choose(acIndex);
    }
    else if (e.key === 'Escape' || e.key === 'Tab') closeList();
  });

  /* mousedown, não click: o blur do input dispara antes do click e fecharia a
     lista, cancelando a escolha. O preventDefault vale pra lista inteira —
     arrastar a barra de rolagem também tiraria o foco do input e fecharia. */
  acList.addEventListener('mousedown', function (e) {
    e.preventDefault();
    var li = e.target.closest('.soon-ac-option');
    if (li) choose(Array.prototype.indexOf.call(acList.children, li));
  });

  cidade.addEventListener('blur', closeList);

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
      nome: nome.value, email: email.value,
      whatsapp: whatsapp.value, cidade: cidade.value,
      emailValid: email.validity && email.validity.valid,
      whatsappDigits: digits(whatsapp.value).length,
    });
    if (!nome.value.trim() || !cidade.value.trim()) {
      console.log('[waitlist-debug] bloqueado: nome/cidade vazio');
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

    var partesNome = splitNome(nome.value);

    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: partesNome.nome,
        sobrenome: partesNome.sobrenome,
        email: email.value.trim(),
        whatsapp: whatsapp.value.trim(),
        cidade: cidade.value.trim(),
        origem: 'coming-soon',
        utmSource: utms.utm_source || '',
        utmMedium: utms.utm_medium || '',
        utmCampaign: utms.utm_campaign || '',
        utmContent: utms.utm_content || '',
        utmTerm: utms.utm_term || ''
      })
    })
      .then(function (res) {
        console.log('[waitlist-debug] resposta recebida', res.status);
        if (!res.ok) throw new Error('request_failed');

        /* conversão pro GTM — sem PII, só o sinal do evento */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'waitlist_signup', form_id: 'soon-form', lgpd_consent: true });

        nome.value = '';
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
