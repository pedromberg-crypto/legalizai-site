
(function () {
  'use strict';
  var tela = document.getElementById('sim-screen');
  if (!tela) return;
  var TETO_ME_MENSAL = 30000;
  var TETO_MEI_ANUAL = 81000;
  var TETO_MEI_MENSAL = 6750;
  var ENDERECO_FISCAL = 60;
  var WHATSAPP = '5531999999999';
  var PILLS = [
    { id: 'tech',       label: 'Tecnologia e software',            curto: 'Tecnologia' },
    { id: 'design',     label: 'Design',                           curto: 'Design' },
    { id: 'foto',       label: 'Foto, vídeo e áudio',              curto: 'Foto e vídeo' },
    { id: 'mkt',        label: 'Marketing e publicidade',          curto: 'Marketing' },
    { id: 'edicao',     label: 'Edição e mídia',                   curto: 'Edição' },
    { id: 'consult',    label: 'Consultoria, pesquisa e tradução',  curto: 'Consultoria' },
    { id: 'cursos',     label: 'Ensino e cursos',                  curto: 'Ensino' },
    { id: 'arte',       label: 'Arte, cultura e patrimônio',       curto: 'Arte e cultura' },
    { id: 'eventos',    label: 'Eventos e entretenimento',         curto: 'Eventos' },
    { id: 'admin',      label: 'Apoio administrativo',             curto: 'Apoio admin.' },
    { id: 'aluguel',    label: 'Aluguel de equipamentos',          curto: 'Aluguel' },
    { id: 'reparos',    label: 'Reparos e manutenção',             curto: 'Reparos' },
    { id: 'salao',      label: 'Salão e beleza',                   curto: 'Salão' },
    { id: 'hospedagem', label: 'Hospedagem',                       curto: 'Hospedagem' }
  ];
  var FORA_LISTA = 'fora-lista';
  var CATEGORIAS_SEM_MEI = ['tech', 'design', 'consult'];
  var REGULAMENTADAS = [
    { v: 'comercio',      label: 'Comércio' },
    { v: 'engenharia',    label: 'Engenharia' },
    { v: 'medicina',      label: 'Medicina' },
    { v: 'odontologia',   label: 'Odontologia' },
    { v: 'advocacia',     label: 'Advocacia' },
    { v: 'contabilidade', label: 'Contabilidade' },
    { v: 'psicologia',    label: 'Psicologia' },
    { v: 'nutricao',      label: 'Nutrição' },
    { v: 'fisioterapia',  label: 'Fisioterapia' },
    { v: 'arquitetura',   label: 'Arquitetura' },
    { v: 'corretagem',    label: 'Corretagem de imóveis' },
    { v: 'outra',         label: 'É outra atividade' }
  ];
  var FAIXAS_ME = [
    { id: 'nao-sei', label: 'Não sei ainda', min: 0,     max: 30000, desconhecida: true, curto: 'Não sei' },
    { id: 'ate-5k',  label: 'Até R$ 5 mil',  min: 0,     max: 5000,  curto: 'Até 5 mil' },
    { id: '5-10k',   label: 'R$ 5 a 10 mil', min: 5000,  max: 10000, curto: '5 a 10 mil' },
    { id: '10-20k',  label: 'R$ 10 a 20 mil', min: 10000, max: 20000, curto: '10 a 20 mil' },
    { id: '20-30k',  label: 'R$ 20 a 30 mil', min: 20000, max: 30000, curto: '20 a 30 mil' }
  ];
  var FAIXAS_MEI = [
    { id: 'nao-sei',   label: 'Não sei ainda',   min: 0,    max: 30000, desconhecida: true, curto: 'Não sei' },
    { id: 'ate-2k',    label: 'Até R$ 2 mil',    min: 0,    max: 2000,  curto: 'Até 2 mil' },
    { id: '2-4k',      label: 'R$ 2 a 4 mil',    min: 2000, max: 4000,  curto: '2 a 4 mil' },
    { id: '4-teto',    label: 'R$ 4 a 6.750',     min: 4000, max: TETO_MEI_MENSAL, curto: '4 a 6.750' }
  ];
  function faixas() { return ehMei() ? FAIXAS_MEI : FAIXAS_ME; }
  var REGIME_CHECKS = {
    me: {
      nome: 'ME · Simples Nacional',
      checks: [
        'Fatura acima de ~R$6.750/mês, ou espera crescer rápido',
        'Só Belo Horizonte/MG, por enquanto',
        'Sem teto: cresce sem trocar de regime',
        'Pode ter sócio e quantos funcionários precisar'
      ]
    },
    mei: {
      nome: 'MEI',
      checks: [
        'Fatura até ~R$6.750/mês (R$81 mil/ano)',
        'Abre em qualquer cidade do Brasil',
        'Sem taxa da Junta · registro na hora',
        'Sem sócio · até 1 funcionário com carteira',
        'Certificado digital por sua conta (não vem no plano)'
      ]
    }
  };
  var PASSOS = [
    { id: 'regime',      rotulo: 'MEI ou ME' },
    { id: 'atividade',   rotulo: 'Sua atividade' },
    { id: 'local',       rotulo: 'Onde ela fica' },
    { id: 'imovel',      rotulo: 'O imóvel', so: function () {
      return !ehMei() && s.enderecoProprio !== false && !s.filaCidade;
    } },
    { id: 'socios',      rotulo: 'Sócios' },
    { id: 'faturamento', rotulo: 'Faturamento' },
    { id: 'resultado',   rotulo: 'Resultado' }
  ];
  function aplicavel(i) { return !PASSOS[i].so || PASSOS[i].so(); }
  function indicesVisiveis() {
    var v = [];
    for (var i = 0; i < PASSOS.length; i++) if (aplicavel(i)) v.push(i);
    return v;
  }
  function proximoPasso(i) {
    for (var j = i + 1; j < PASSOS.length; j++) if (aplicavel(j)) return j;
    return PASSOS.length - 1;
  }
  function passoAnterior(i) {
    for (var j = i - 1; j >= 0; j--) if (aplicavel(j)) return j;
    return 0;
  }
  var iRESULTADO = PASSOS.length - 1;
  function meta() {
    if (s.passo === iRESULTADO) return 'Resultado';
    var vis = indicesVisiveis().filter(function (i) { return i !== iRESULTADO; });
    return 'Passo ' + (vis.indexOf(s.passo) + 1) + ' de ' + vis.length;
  }
  function estadoInicial() { return {
    passo: 0,
    regime: null,
    categoria: null,
    regulamentada: null,
    outraAtividade: '',
    enderecoProprio: null,
    cep: '',
    cepInfo: null,
    numero: '',
    complemento: '',
    tipoImovel: '',
    reside: null,
    filaCidade: false,
    meiOutraEmpresa: null,
    meiServidor: null,
    socios: null,
    socioNaoAtende: false,
    valeSaber: false,
    socioResolvido: false,
    administracao: null,
    coorte: null,
    faixa: null,
    modoExato: false,
    exato: ''
  }; }
  var s = estadoInicial();
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }
  function mascaraCep(v) {
    var d = digitos(v).slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }
  function ehCepBh(cep) {
    var d = digitos(cep);
    if (d.length !== 8) return false;
    var n = Number(d);
    return n >= 30000000 && n <= 31999999;
  }
  function brl(v) {
    return 'R$ ' + Number(v).toLocaleString('pt-BR');
  }
  function valorExato() { return Number(digitos(s.exato)) || 0; }
  function faixaDoValor(v) {
    if (v <= 0) return null;
    var lista = faixas();
    for (var i = 0; i < lista.length; i++) {
      var f = lista[i];
      if (!f.desconhecida && v > f.min && v <= f.max) return f.id;
    }
    return lista[lista.length - 1].id;
  }
  function faixaEscolhida() {
    var v = valorExato();
    var id = v > 0 ? faixaDoValor(v) : s.faixa;
    var lista = faixas();
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }
  function rotuloCategoria(id) {
    if (id === FORA_LISTA) return 'Não encontrei minha categoria';
    for (var i = 0; i < PILLS.length; i++) if (PILLS[i].id === id) return PILLS[i].label;
    return 'não informada';
  }
  function categoriaTemMei(id) { return CATEGORIAS_SEM_MEI.indexOf(id) === -1; }
  function resumoPasso(id) {
    switch (id) {
      case 'regime':
        return ehMei() ? 'MEI' : 'ME';
      case 'atividade':
        if (s.categoria === FORA_LISTA) return 'Fora da lista';
        for (var i = 0; i < PILLS.length; i++) if (PILLS[i].id === s.categoria) return PILLS[i].curto;
        return '';
      case 'local':
        if (s.filaCidade) return 'Fora de BH';
        if (s.enderecoProprio === false) return 'Endereço fiscal';
        if (ehMei()) return (s.cepInfo && s.cepInfo.municipio) || 'Sede definida';
        return 'Belo Horizonte';
      case 'imovel':
        return s.tipoImovel === 'casa' ? 'Casa'
          : (s.tipoImovel === 'apartamento' ? 'Apartamento'
            : (s.tipoImovel === 'outro' ? 'Sala ou loja' : ''));
      case 'socios':
        if (ehMei()) return 'Sem impedimento';
        if (s.socios === 1) return 'Só eu';
        return s.socios ? 'Eu + ' + (s.socios - 1) : '';
      case 'faturamento':
        if (valorExato() > 0) return brl(valorExato());
        var f = faixaEscolhida();
        return f ? f.curto : '';
      default:
        return '';
    }
  }
  function ehMei() { return s.regime === 'mei'; }
  function linkWhats(msg) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg);
  }
  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5L20 7"/></svg>';
  var BANG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M12 6v8M12 18v.01"/></svg>';
  var INFO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M12 10v8M12 6v.01"/></svg>';
  var ALERTA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M12 4.2 2.6 20h18.8L12 4.2Z"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 10.2v4.1M12 17.4v.01"/></svg>';
  var CHEVRON_SVG = '<svg class="sim-exp-chevron" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';
  var NOTA_ICONE_3D = { ok: 'check-3d.webp?v=2', warn: 'alerta-3d.webp?v=2' };
  function nota(variante, titulo, texto) {
    var asset = NOTA_ICONE_3D[variante];
    var mark = asset
      ? '<img class="sim-note-mark is-3d" src="/assets/' + asset + '" alt="" aria-hidden="true">'
      : '<span class="sim-note-mark">' + INFO_SVG + '</span>';
    return '<div class="sim-note sim-note--' + variante + '">' +
      mark + '<div>' +
      (titulo ? '<p class="sim-note-title">' + esc(titulo) + '</p>' : '') +
      '<p class="sim-note-text">' + texto + '</p></div></div>';
  }
  function listaChecks(itens) {
    return '<ul class="sim-checks">' + itens.map(function (t) {
      return '<li>' + CHECK_SVG + '<span>' + esc(t) + '</span></li>';
    }).join('') + '</ul>';
  }
  function cardIcone(valor, campo, label, base, selecionado) {
    var src = base.charAt(0) === '/'
      ? base
      : '/atendimento/icones/' + base + (selecionado ? '-creme' : '-coral') + '.webp';
    return '<button type="button" class="sim-card" aria-pressed="' + (selecionado ? 'true' : 'false') + '"' +
      ' data-set="' + campo + '" data-valor="' + valor + '">' +
      '<span class="sim-card-check">' + CHECK_SVG + '</span>' +
      '<img src="' + src + '" alt="" aria-hidden="true">' +
      '<span>' + esc(label) + '</span></button>';
  }
  function botoesLinha(campo, opcoes, atual) {
    return '<div class="sim-row">' + opcoes.map(function (o) {
      return '<button type="button" class="sim-pick" data-set="' + campo + '" data-valor="' + o.v +
        '" aria-pressed="' + (String(atual) === String(o.v) ? 'true' : 'false') + '">' + esc(o.label) + '</button>';
    }).join('') + '</div>';
  }
  function select(campo, valor, opcoes, placeholder, travado) {
    return '<select class="sim-select" data-change="' + campo + '"' + (travado ? ' disabled' : '') + '>' +
      '<option value=""' + (!valor ? ' selected' : '') + '>' + esc(placeholder) + '</option>' +
      opcoes.map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (valor === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select>';
  }
  var cepBuscado = '';
  function buscarCep() {
    var d = digitos(s.cep);
    if (d.length !== 8 || cepBuscado === d) return;
    cepBuscado = d;
    s.cepInfo = null;
    var alvo = d;
    fetch('https://viacep.com.br/ws/' + d + '/json/')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (digitos(s.cep) !== alvo) return;
        if (!j || j.erro) { s.cepInfo = fallbackCep(alvo); }
        else {
          s.cepInfo = {
            municipio: j.localidade || '', uf: j.uf || '',
            logradouro: j.logradouro || '', bairro: j.bairro || ''
          };
        }
        render();
      })
      .catch(function () {
        if (digitos(s.cep) !== alvo) return;
        s.cepInfo = fallbackCep(alvo);
        render();
      });
  }
  function fallbackCep(d) {
    return ehCepBh(d)
      ? { municipio: 'Belo Horizonte', uf: 'MG', logradouro: '', bairro: '' }
      : { municipio: '', uf: '', logradouro: '', bairro: '' };
  }
  function cardRegime(valor, base, selecionado) {
    var d = REGIME_CHECKS[valor];
    return '<button type="button" class="sim-card sim-card--compara" aria-pressed="' + (selecionado ? 'true' : 'false') + '"' +
      ' data-set="regime" data-valor="' + valor + '">' +
      '<span class="sim-card-check">' + CHECK_SVG + '</span>' +
      '<span class="sim-card-topo">' +
        '<img src="/atendimento/icones/' + base + (selecionado ? '-creme' : '-coral') + '.webp" alt="" aria-hidden="true">' +
        '<span class="sim-card-nome">' + esc(d.nome) + '</span>' +
      '</span>' +
      '<span class="sim-checks">' + d.checks.map(function (t) {
        return '<span class="sim-checks-item">' + CHECK_SVG + '<span>' + esc(t) + '</span></span>';
      }).join('') + '</span>' +
      '</button>';
  }
  function telaRegime() {
    var r = s.regime;
    var corpo =
      '<div class="sim-cards sim-cards--compara">' +
        cardRegime('me', 'regime-me', r === 'me') +
        cardRegime('mei', 'regime-mei', r === 'mei') +
      '</div>';
    return {
      meta: meta(),
      titulo: 'Você será MEI ou ME?',
      sub: 'Compare os dois e toque no que se parece com o seu caso. A escolha define o resto da abertura.',
      corpo: corpo,
      rodapeLink: { label: 'Tirar dúvida no WhatsApp', href: linkWhats('Oi! Estou vendo no site se a Legalizaí me atende e travei na escolha entre MEI e ME. Podem me ajudar?') },
      cta: 'Continuar',
      pronto: !!r
    };
  }
  function telaAtividade() {
    var cat = s.categoria;
    var foraLista = cat === FORA_LISTA;
    var semMei = ehMei() && cat && !foraLista && !categoriaTemMei(cat);
    var cepCheio = digitos(s.cep).length === 8;
    var opcoes = PILLS.map(function (p) {
      return {
        v: p.id,
        label: (ehMei() && !categoriaTemMei(p.id)) ? p.label + ' (só como ME)' : p.label
      };
    });
    opcoes.push({ v: FORA_LISTA, label: 'Não encontrei minha categoria' });
    var corpo =
      '<div class="sim-field' + (foraLista ? '' : ' sim-full') + '">' +
        '<label class="sim-field-label" for="sim-cat">O que você faz?</label>' +
        (cat ? '' : '<p class="sim-field-hint">Escolha o que mais se parece. O código certo a gente encontra depois.</p>') +
        select('categoria', cat, opcoes, 'Escolha uma categoria') +
      '</div>';
    if (!semMei && !foraLista) {
      corpo += '<div class="sim-regra">' +
        '<p class="sim-regra-titulo">Como a gente lê essa resposta</p>' +
        '<ul class="sim-checks">' +
          [
            'A lista tem só o que a gente abre hoje, não o catálogo inteiro',
            'A categoria aponta o CNAE; quem confirma o código é o contador',
            'Não achou a sua? Tem opção pra isso no fim da lista'
          ].map(function (t) { return '<li>' + CHECK_SVG + '<span>' + esc(t) + '</span></li>'; }).join('') +
        '</ul></div>';
    }
    if (semMei) {
      corpo += '<div class="sim-full">' + nota('info', 'Essa atividade não pode ser MEI',
        'A lei não considera empresário quem exerce profissão intelectual (art. 966 do Código Civil), então tecnologia, design e consultoria não entram na lista do MEI. Não é escolha nossa, e não tem exceção.') + '</div>' +
        '<p class="sim-note-text sim-full">A boa notícia: a gente atende essa atividade como <strong>ME no Simples Nacional</strong>, que é o caminho certo pro seu caso.</p>';
    }
    if (foraLista) {
      var precisaDescrever = s.regulamentada === 'outra';
      var cepLiberado = s.regulamentada !== null &&
        (!precisaDescrever || s.outraAtividade.trim() !== '');
      corpo += '<div class="sim-campo-lado"><label class="sim-field-label">Qual é a sua atividade?</label>' +
        select('regulamentada', s.regulamentada, REGULAMENTADAS, 'Escolha a atividade') + '</div>';
      corpo += '<div class="sim-duo">' +
        '<div class="sim-field' + (precisaDescrever ? '' : ' is-travado') + '">' +
          '<label class="sim-field-label" for="sim-outra">Descreve com suas palavras</label>' +
          '<input class="sim-input" id="sim-outra" data-input="outraAtividade" value="' + esc(s.outraAtividade) + '"' +
            (precisaDescrever ? '' : ' disabled') +
            ' placeholder="' + (precisaDescrever ? 'Ex.: aulas particulares de violão' : 'Só pra quem marcar “É outra atividade”') + '">' +
        '</div>' +
        '<div class="sim-field' + (cepLiberado ? '' : ' is-travado') + '">' +
          '<label class="sim-field-label" for="sim-cep">CEP (a gente usa pra saber sua cidade)</label>' +
          '<input class="sim-input" id="sim-cep" data-input="cep" inputmode="numeric" value="' + esc(s.cep) + '"' +
            (cepLiberado ? '' : ' disabled') + ' placeholder="00000-000">' +
          ((cepCheio && s.cepInfo && s.cepInfo.municipio)
            ? '<span class="sim-field-hint"><strong>' + esc(s.cepInfo.municipio) + ' · ' + esc(s.cepInfo.uf) + '</strong> é a cidade que entra na fila.</span>'
            : '') +
        '</div>' +
      '</div>';
      if (cepCheio) {
        corpo += '<div class="sim-full">' + nota('ok', ehCepBh(s.cep) ? 'Ainda não atendemos essa categoria' : 'Ainda não atendemos sua categoria e cidade',
          'Confirma aqui embaixo e você garante condição especial quando a gente chegar.') + '</div>';
      }
    }
    var prontoFora = foraLista && s.regulamentada !== null &&
      (s.regulamentada !== 'outra' || s.outraAtividade.trim() !== '') && cepCheio;
    return {
      meta: meta(),
      titulo: 'Sobre a sua empresa',
      sub: 'A lista tem só o que a gente atende hoje. Se você se encontra nela, já passou por esse filtro.',
      corpo: corpo,
      cta: semMei ? 'Continuar como ME' : (foraLista ? 'Me inscrever e garantir condição' : 'Continuar'),
      acaoCta: semMei ? 'trocar-me' : 'avancar',
      pronto: semMei ? true : (foraLista ? prontoFora : !!cat)
    };
  }
  function telaLocal() {
    var mei = ehMei();
    var cepCheio = digitos(s.cep).length === 8;
    var cepOk = cepCheio && (mei || ehCepBh(s.cep));
    var foraDeBh = cepCheio && !mei && !ehCepBh(s.cep);
    var proprio = mei ? true : s.enderecoProprio === true;
    var fiscal = !mei && s.enderecoProprio === false;
    var corpo = '';
    if (!mei) {
      corpo += '<div class="sim-q">' +
        '<div class="sim-wide-duo">' +
        '<button type="button" class="sim-wide" data-set="enderecoProprio" data-valor="false" aria-pressed="' + (fiscal ? 'true' : 'false') + '">' +
          '<span class="sim-wide-head"><span class="sim-wide-title">Quero um endereço da Legalizaí</span>' +
          '<span class="sim-wide-pill">' + brl(ENDERECO_FISCAL) + '/mês</span></span>' +
          '<span class="sim-wide-sub">O endereço do nosso escritório em BH vira a sede da sua empresa.</span>' +
        '</button>' +
        '<button type="button" class="sim-wide" data-set="enderecoProprio" data-valor="true" aria-pressed="' + (proprio ? 'true' : 'false') + '">' +
          '<span class="sim-wide-head"><span class="sim-wide-title">Tenho um endereço em Belo Horizonte</span>' +
          '<span class="sim-wide-pill">Sem custo</span></span>' +
          '<span class="sim-wide-sub">Pode ser o endereço da sua casa.</span>' +
        '</button></div>';
      if (fiscal) {
        corpo += nota('ok', '', 'Cobrança recorrente, junto da mensalidade. O valor aparece somado na tela do plano.');
      }
      corpo += '</div>';
    } else {
      corpo += '<div class="sim-q"><p class="sim-q-hint" style="margin-top:0">É o endereço que vai ficar no seu CNPJ, e pode ser o da sua casa. Como MEI, você abre de qualquer cidade do Brasil.</p></div>';
    }
    if (proprio) {
      corpo += '<div class="sim-trio">' +
        '<div class="sim-field"><label class="sim-field-label" for="sim-cep">CEP da empresa</label>' +
        '<input class="sim-input" id="sim-cep" data-input="cep" inputmode="numeric" value="' + esc(s.cep) + '" placeholder="00000-000"></div>' +
        ((cepOk && s.cepInfo) ?
          '<div class="sim-field"><label class="sim-field-label" for="sim-numero">Número</label>' +
          '<input class="sim-input" id="sim-numero" data-input="numero" inputmode="numeric" value="' + esc(s.numero) + '" placeholder="123"></div>' +
          '<div class="sim-field"><label class="sim-field-label" for="sim-compl">Complemento</label>' +
          '<input class="sim-input" id="sim-compl" data-input="complemento" value="' + esc(s.complemento) + '" placeholder="Sala, andar"></div>'
          : '') +
        '</div>';
      if (foraDeBh) {
        if (s.filaCidade) {
          if (s.cepInfo && s.cepInfo.municipio) {
            corpo += '<div class="sim-endereco"><p class="sim-endereco-cidade">' + esc(s.cepInfo.municipio) + ' · ' + esc(s.cepInfo.uf) + '</p>' +
              '<p class="sim-endereco-nota">É essa cidade que entra na fila.</p></div>';
          }
          corpo += nota('ok', 'Falta só confirmar aqui embaixo',
            'Clicando abaixo, você garante oferta especial quando a gente conseguir te atender.');
        } else {
          corpo += '<div class="sim-inline"><p class="sim-inline-title">Ainda não chegamos na sua cidade</p>' +
            '<p class="sim-inline-text">Mas isso não te trava: clica em <strong>“Quero um endereço da Legalizaí”</strong> aqui em cima, e a empresa nasce em BH do mesmo jeito.</p>' +
            '<button type="button" class="sim-inline-link" data-acao="fila-cidade">Quero abrir na minha cidade mesmo assim</button></div>';
        }
      } else if (cepOk && s.cepInfo) {
        if (s.cepInfo.logradouro || s.cepInfo.municipio) {
          corpo += '<div class="sim-endereco">' +
            (s.cepInfo.logradouro ? '<p class="sim-endereco-rua">' + esc(s.cepInfo.logradouro) + (s.cepInfo.bairro ? ', ' + esc(s.cepInfo.bairro) : '') + '</p>' : '') +
            '<p class="sim-endereco-cidade">' + esc(s.cepInfo.municipio || 'Belo Horizonte') + ' · ' + esc(s.cepInfo.uf || 'MG') + '</p></div>';
        }
      }
      if (mei && cepOk) {
        corpo += '<div class="sim-full">' + nota('info', 'Pode ser o seu endereço de casa',
          'No MEI não existe consulta prévia de viabilidade, e em BH o alvará é dispensado pras atividades de baixo risco. Você declara o endereço e assume o compromisso de seguir as regras do município.') + '</div>';
      }
    }
    var pronto = mei
      ? (cepOk && s.numero.trim() !== '')
      : (s.filaCidade || fiscal || (proprio && cepOk && s.numero.trim() !== ''));
    return {
      meta: meta(),
      titulo: 'Onde a empresa vai ficar?',
      sub: mei
        ? 'É o endereço que fica no CNPJ, e o MEI abre de qualquer cidade do Brasil.'
        : 'Vale o endereço da SEDE, não onde você mora. Quem mora fora de BH também tem caminho.',
      corpo: corpo,
      cta: s.filaCidade ? 'Me inscrever e garantir condição' : 'Continuar',
      pronto: pronto
    };
  }
  function telaImovel() {
    var apeSemResidencia = s.tipoImovel === 'apartamento' && s.reside === false;
    var veredito = '';
    if (apeSemResidencia) {
      veredito = nota('warn', 'Esse apartamento não serve como sede',
        'Sem sócio morando nele, a Prefeitura indefere. Use outro endereço seu, ou o da Legalizaí.');
    } else if (s.tipoImovel !== '' && s.reside !== null) {
      veredito = nota('ok', '', 'Endereço aprovado pela regra da Prefeitura. É esse que vai no seu CNPJ.');
    }
    var corpo = '<div class="sim-duo">' +
      '<div class="sim-field"><label class="sim-field-label" for="sim-tipo">Esse endereço é casa ou apartamento?</label>' +
      select('tipoImovel', s.tipoImovel, [
        { v: 'casa', label: 'Casa' },
        { v: 'apartamento', label: 'Apartamento' },
        { v: 'outro', label: 'Outro (sala, loja, galpão)' }
      ], 'Escolha uma opção') + '</div>' +
      (s.tipoImovel !== ''
        ? '<div class="sim-q"><p class="sim-q-label">Você mora nesse endereço?</p>' +
          botoesLinha('reside', [{ v: 'false', label: 'Não' }, { v: 'true', label: 'Sim' }],
            s.reside === null ? '' : String(s.reside)) + '</div>'
        : '') +
      '</div>';
    if (veredito) corpo += '<div class="sim-full">' + veredito + '</div>';
    corpo += '<div class="sim-regra">' +
      '<p class="sim-regra-titulo">Por que a gente pergunta</p>' +
      '<ul class="sim-checks">' +
        [
          'Casa, sala, loja ou galpão: a Prefeitura aceita direto',
          'Apartamento só é aceito se um dos sócios morar nele',
          'Se não for o seu caso, o endereço da Legalizaí resolve por ' + brl(ENDERECO_FISCAL) + '/mês'
        ].map(function (t) { return '<li>' + CHECK_SVG + '<span>' + esc(t) + '</span></li>'; }).join('') +
      '</ul></div>';
    return {
      meta: meta(),
      titulo: 'Sobre o imóvel',
      sub: 'Melhor descobrir agora, não depois de pagar.',
      corpo: corpo,
      cta: apeSemResidencia ? 'Usar o endereço da Legalizaí' : 'Continuar',
      acaoCta: apeSemResidencia ? 'usar-fiscal' : 'avancar',
      pronto: apeSemResidencia || (s.tipoImovel !== '' && s.reside !== null)
    };
  }
  function telaSocios() {
    if (ehMei()) return telaImpedimentosMei();
    var solo = s.socios === 1;
    var temSocio = s.socios !== null && !solo;
    var corpo =
      '<div class="sim-q"><p class="sim-q-label">Quantas pessoas vão ser donas da empresa?</p>' +
      botoesLinha('socios', [
        { v: '1', label: 'Só eu' }, { v: '2', label: 'Eu + 1' },
        { v: '3', label: 'Eu + 2' }, { v: '4', label: 'Eu + 3' }
      ], s.socios) + '</div>';
    if (solo) {
      corpo += '<div class="sim-full">' + nota('ok', '', 'É o mais comum entre os prestadores de serviço. Se um dia você quiser ter sócio, dá pra incluir depois, já com a empresa em pé.') + '</div>';
    }
    if (temSocio) {
      var plural = s.socios === 2;
      corpo += '<div class="sim-panel sim-exp">' +
        '<button type="button" class="sim-exp-head" data-acao="vale-saber" aria-expanded="' + (s.valeSaber ? 'true' : 'false') + '">' +
          '<span class="sim-panel-title" style="margin:0">Vale saber</span>' +
          '<span class="sim-exp-meta">3 pontos sobre sócio' + CHEVRON_SVG + '</span>' +
        '</button>' +
        (s.valeSaber ? ('<ul class="sim-checks">' +
          [
            plural ? 'Seu sócio precisa morar no Brasil' : 'Seus sócios precisam morar no Brasil',
            plural ? 'Seu sócio entra só com CPF, não CNPJ' : 'Seus sócios entram só com CPF, não CNPJ',
            plural ? 'Seu sócio vai assinar (GOV.BR) na hora de constituir a empresa'
                   : 'Seus sócios vão assinar (GOV.BR) na hora de constituir a empresa'
          ].map(function (t) { return '<li>' + CHECK_SVG + '<span>' + esc(t) + '</span></li>'; }).join('') +
          (s.socioNaoAtende ? '' :
            '<li class="sim-check-acao"><button type="button" class="sim-btn-cinza" data-acao="socio-nao-atende">' +
            ALERTA_SVG + '<span>Meu sócio não atende um dos critérios</span></button></li>') +
        '</ul>') : '') +
        '</div>';
      var dicaAdmin = s.administracao === 'so-eu'
        ? (plural ? 'Você assina sozinho. Seu sócio continua sócio e participa dos resultados.'
                  : 'Você assina sozinho. Seus sócios continuam sócios e participam dos resultados.')
        : (s.administracao === 'com-socios'
          ? 'Cada um assina sozinho. Alguns bancos pedem todos juntos pra abrir a conta.'
          : 'Quem administra assina pela empresa: banco, cartório, contratos.');
      corpo += '<div class="sim-q"><p class="sim-q-label">Quem vai administrar a empresa?</p>' +
        '<p class="sim-q-hint">' + dicaAdmin + '</p>' +
        botoesLinha('administracao', [
          { v: 'so-eu', label: 'Só eu' },
          { v: 'com-socios', label: plural ? 'Eu e meu sócio' : 'Eu e meus sócios' }
        ], s.administracao) +
        '</div>';
      if (s.socioNaoAtende && !s.socioResolvido) {
        corpo += '<div class="sim-inline"><p class="sim-inline-text">Sem problema. Esse caso a Legalize Digital atende pela contabilidade tradicional, fora do produto automatizado.</p></div>';
      } else if (s.socioNaoAtende) {
        corpo += '<div class="sim-inline"><p class="sim-inline-title">Combinado, já anotamos</p>' +
          '<p class="sim-inline-text">Nosso time da Legalize Digital vai entrar em contato pra seguir pela contabilidade tradicional.</p></div>';
      }
    }
    var completo = s.socios !== null && (!temSocio || s.administracao !== null);
    if (s.socioNaoAtende && !s.socioResolvido) {
      return {
        meta: meta(), titulo: 'Perguntas rápidas', sub: '',
        corpo: corpo, cta: 'Falar com o time', pronto: true, acaoCta: 'resolver-socio', ctaEscuro: true
      };
    }
    return {
      meta: meta(),
      titulo: 'Perguntas rápidas',
      sub: '',
      corpo: corpo,
      cta: 'Continuar',
      pronto: completo
    };
  }
  function telaImpedimentosMei() {
    function cartaoImpedimento(campo, pergunta, dica, valor, aviso) {
      return '<div class="sim-q sim-q--cartao">' +
        '<p class="sim-q-label">' + pergunta + '</p>' +
        '<p class="sim-q-hint">' + dica + '</p>' +
        botoesLinha(campo, [{ v: 'false', label: 'Não' }, { v: 'true', label: 'Sim' }],
          valor === null ? '' : String(valor)) +
        (valor === true ? aviso : '') +
        '</div>';
    }
    var corpo = '<div class="sim-duo sim-duo--cartoes">' +
      cartaoImpedimento('meiOutraEmpresa',
        'Você já é sócio ou dono de outra empresa?',
        'Quem já tem CNPJ não pode abrir MEI. É impedimento da lei, não regra nossa.',
        s.meiOutraEmpresa,
        nota('warn', 'Com outra empresa no seu nome, o MEI não serve',
          'Se o que você quer é trazer pra Legalizaí a empresa que já existe, isso a gente atende.')) +
      cartaoImpedimento('meiServidor',
        'Você é servidor público federal na ativa?',
        'A lei proíbe servidor federal de ser MEI. Estadual e municipal depende do estatuto.',
        s.meiServidor,
        nota('warn', 'Servidor federal não pode ser MEI',
          'Nesse caso o caminho passa por uma conversa com o contador antes de abrir qualquer coisa. A gente te ajuda a achar a saída certa.')) +
      '</div>';
    if (s.meiOutraEmpresa === false && s.meiServidor === false) {
      corpo += '<div class="sim-full">' + nota('ok', 'Nenhum dos dois impedimentos te pega',
        'Pela lei, você pode ser MEI. Falta só conferir o faturamento.') + '</div>';
    }
    return {
      meta: meta(),
      titulo: 'Perguntas rápidas',
      sub: 'No MEI não existe sócio. O que a gente confere aqui são os dois impedimentos da lei.',
      corpo: corpo,
      cta: 'Continuar',
      pronto: s.meiOutraEmpresa !== null && s.meiServidor !== null
    };
  }
  function telaFaixa() {
    var v = valorExato();
    var f = faixaEscolhida();
    var mei = ehMei();
    var estoura = mei && (v > TETO_MEI_MENSAL || (v === 0 && !!f && f.min >= TETO_MEI_MENSAL));
    var incerto = mei && !estoura && v === 0 && !!f && f.max > TETO_MEI_MENSAL;
    var selecionada = v > 0 ? faixaDoValor(v) : s.faixa;
    var lista = faixas();
    var n = 0;
    var corpo = '<div class="sim-cards is-linha" style="--n:' + lista.length + '">' + lista.map(function (fx) {
      var icone = fx.desconhecida ? '/assets/faq-interrogacao.webp' : 'faixa-' + (++n);
      return cardIcone(fx.id, 'faixa', fx.label, icone, selecionada === fx.id);
    }).join('') + '</div>';
    corpo += '<div class="sim-valor">' +
      '<p class="sim-valor-titulo">Ou informe o valor exato</p>' +
      '<div class="sim-input-prefix"><span>R$</span>' +
      '<input class="sim-input" id="sim-exato" data-input="exato" inputmode="numeric" value="' + esc(s.exato) + '" placeholder="0"></div>' +
      (v > 0 && f
        ? '<p class="sim-valor-eco">Isso é a faixa <strong>' + esc(f.label) + '</strong>.</p>'
        : '<p class="sim-valor-eco is-vazio">A faixa acende sozinha aqui em cima.</p>') +
      (v >= TETO_ME_MENSAL
        ? '<p class="sim-valor-nota">Acima de ' + brl(TETO_ME_MENSAL) + ' por mês a empresa vira EPP com o tempo. Não trava a abertura: a gente acompanha e avisa quando chegar lá.</p>'
        : '') +
      '</div>';
    if (estoura) {
      corpo += '<div class="sim-full">' + nota('info', 'Com esse faturamento, o MEI não serve',
        'Não é impedimento: é sinal de que o seu caso agora é ME. O teto é ' + brl(TETO_MEI_MENSAL) + ' por mês (' + brl(TETO_MEI_ANUAL) + ' no ano), e é melhor saber disso agora do que depois da empresa aberta.') + '</div>';
    } else if (incerto) {
      corpo += '<div class="sim-full">' + nota('warn', 'Fica de olho no teto do MEI',
        'O limite do MEI é ' + brl(TETO_MEI_MENSAL) + ' por mês (' + brl(TETO_MEI_ANUAL) + ' no ano), e ele cai dentro dessa faixa. Se quiser ter certeza agora, informa o valor exato aqui embaixo.') + '</div>';
    }
    return {
      meta: meta(),
      titulo: 'Quanto você vai faturar por mês? <span class="sim-h1-soft">Pode ser estimativa!</span>',
      sub: '',
      corpo: corpo,
      cta: estoura ? 'Continuar como ME' : 'Ver o resultado',
      acaoCta: estoura ? 'trocar-me' : 'avancar',
      pronto: estoura ? true : !!selecionada
    };
  }
  var LISTA_ESPERA = '/em-breve';
  function ctaConsultor(msg) {
    return { label: 'Falar com um consultor', href: linkWhats(msg) };
  }
  function calcularVeredito() {
    if (s.socioNaoAtende) {
      return {
        tipo: 'humano',
        titulo: 'Seu caso é com um contador, não com o app',
        texto: 'Sócio fora dos critérios do Simples (mora fora do Brasil, entra por CNPJ) não cabe no fluxo automatizado, mas cabe na Legalize Digital, que é o escritório por trás da Legalizaí, pela contabilidade tradicional.',
        cta: ctaConsultor('Oi! Fiz a simulação no site e um dos meus sócios não atende os critérios do Simples. Vi que dá pra resolver pela contabilidade tradicional — como funciona?')
      };
    }
    if (s.categoria === FORA_LISTA) {
      var emBh = ehCepBh(s.cep);
      var cidade = (s.cepInfo && s.cepInfo.municipio) ? s.cepInfo.municipio : 'sua cidade';
      return {
        tipo: 'espera',
        titulo: 'Ainda não, mas você entrou na fila',
        texto: 'Sua atividade é regulamentada e precisa de responsável técnico registrado no conselho. Hoje isso fica fora do que o app resolve sozinho. A gente está em expansão' +
          (emBh ? ', e quando abrir pra sua área você tem condição especial.'
                : ', e quando chegar em ' + esc(cidade) + ' e na sua área você tem condição especial.'),
        cta: { label: 'Entrar na lista de espera', href: LISTA_ESPERA }
      };
    }
    if (s.filaCidade) {
      var c = (s.cepInfo && s.cepInfo.municipio) ? s.cepInfo.municipio : 'sua cidade';
      return {
        tipo: 'espera',
        titulo: 'A gente ainda não abriu em ' + esc(c),
        texto: 'Por enquanto o app só abre empresa com sede em Belo Horizonte. Você entrou na fila e garante oferta especial quando a gente chegar aí. E, se quiser antecipar, dá pra abrir hoje mesmo usando o endereço fiscal da Legalizaí em BH por ' + brl(ENDERECO_FISCAL) + '/mês.',
        cta: { label: 'Entrar na lista de espera', href: LISTA_ESPERA }
      };
    }
    if (ehMei() && s.meiOutraEmpresa === true) {
      return {
        tipo: 'humano',
        titulo: 'MEI não dá, mas a gente atende do mesmo jeito',
        texto: 'Quem já é sócio ou dono de outra empresa não pode abrir MEI. Se a ideia é trazer pra cá a empresa que já existe, essa parte a gente faz.',
        cta: ctaConsultor('Oi! Fiz a simulação no site e já tenho outra empresa no meu nome, então o MEI não serve. Queria entender o que dá pra fazer no meu caso.')
      };
    }
    if (ehMei() && s.meiServidor === true) {
      return {
        tipo: 'humano',
        titulo: 'Servidor federal não pode ser MEI',
        texto: 'É vedação da lei, não regra nossa. Dependendo do seu vínculo pode existir caminho como ME. Vale meia hora de conversa com o contador antes de abrir qualquer coisa.',
        cta: ctaConsultor('Oi! Fiz a simulação no site: sou servidor público federal e por isso não posso ser MEI. Queria conversar sobre o caminho como ME.')
      };
    }
    return {
      tipo: 'ok',
      titulo: 'Sim, a gente atende o seu caso',
      texto: ehMei()
        ? 'Seu MEI entra no que a Legalizaí abre hoje. O próximo passo é no app: a abertura sai da sua mão e vem pra nossa.'
        : 'Sua ME entra no que a Legalizaí abre hoje. O próximo passo é no app: a abertura sai da sua mão e vem pra nossa.',
      cta: { label: 'Baixar o app e começar', href: document.getElementById('rodape') ? '#rodape' : '/index.html#rodape' }
    };
  }
  function telaResultado() {
    var v = calcularVeredito();
    var MARCA_SVG = '<svg viewBox="0 0 121.44 121.44" aria-hidden="true">' +
      '<path fill="var(--coral-500)" d="M72.64,95.27c-6.56,6.56-17.21,6.56-23.77,0L13.91,60.32c7.6-7.6,19.93-7.6,27.54,0l19.31,19.31,60.67-60.67C121.28,8.46,112.74,0,102.21,0H19.23C8.61,0,0,8.61,0,19.23v82.98c0,10.62,8.61,19.23,19.23,19.23h82.98c10.62,0,19.23-8.61,19.23-19.23v-55.74l-48.8,48.8Z"/>' +
      '<path fill="#fff" d="M121.43,18.95l-60.67,60.67-19.33-19.33c-7.6-7.6-19.93-7.6-27.54,0h0s34.97,34.97,34.97,34.97c6.56,6.56,17.21,6.56,23.77,0l48.79-48.79v-27.54Z"/></svg>';
    var icone = v.tipo === 'ok'
      ? MARCA_SVG
      : (v.tipo === 'espera'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 7.6V12l3 2"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M20 20.5v-1.8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1.8"/><circle cx="12" cy="7.6" r="3.9" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>');
    var f = faixaEscolhida();
    var linhas = [
      ['Regime', ehMei() ? 'MEI' : 'ME · Simples Nacional'],
      ['Atividade', rotuloCategoria(s.categoria)]
    ];
    if (s.categoria === FORA_LISTA) {
      linhas.push(['Cidade', (s.cepInfo && s.cepInfo.municipio)
        ? s.cepInfo.municipio + (s.cepInfo.uf ? ' · ' + s.cepInfo.uf : '')
        : 'informada no CEP']);
      linhas.push(['Situação', 'Na fila · sem cobrança']);
    }
    if (s.categoria !== FORA_LISTA) {
      var ondeFica = s.filaCidade
        ? ((s.cepInfo && s.cepInfo.municipio ? s.cepInfo.municipio : 'Fora de BH') + ' · fila de espera')
        : (s.enderecoProprio === false
          ? 'Endereço fiscal · ' + brl(ENDERECO_FISCAL) + '/mês'
          : ((s.cepInfo && s.cepInfo.municipio ? s.cepInfo.municipio : 'Belo Horizonte') + (s.cepInfo && s.cepInfo.uf ? ' · ' + s.cepInfo.uf : ' · MG')));
      linhas.push(['Onde fica', ondeFica]);
      if (!ehMei() && s.socios) {
        linhas.push(['Donos', s.socios === 1 ? 'Só você' : s.socios + ' pessoas']);
      }
      if (f) linhas.push(['Faturamento', valorExato() > 0 ? brl(valorExato()) + '/mês' : f.label]);
    }
    var corpo =
      '<div class="sim-selo sim-selo--' + v.tipo + (v.tipo === 'ok' ? '' : ' is-larga') + '">' +
        '<div class="sim-selo-topo">' +
          '<span class="sim-selo-icon' + (v.tipo === 'ok' ? ' is-marca' : '') + '">' + icone + '</span>' +
          '<h2>' + v.titulo + '</h2>' +
        '</div>' +
        '<p>' + v.texto + '</p>' +
      '</div>' +
      '<div class="sim-resumo">' + linhas.map(function (l) {
        return '<div class="sim-resumo-row"><span class="sim-resumo-k">' + esc(l[0]) + '</span><span class="sim-resumo-v">' + esc(l[1]) + '</span></div>';
      }).join('') +
      '<div class="sim-resumo-nota">' +
        (v.tipo === 'ok'
          ? '<span class="sim-resumo-nota-ico">' + CHECK_SVG + '</span><span>Triagem, não contrato: quem confirma o CNAE é o contador, no app, antes de qualquer cobrança.</span>'
          : '<span class="sim-resumo-nota-ico is-info">' + INFO_SVG + '</span><span>Simulação com as regras de hoje. Elas mudam quando a gente expande.</span>') +
      '</div></div>' +
      (v.tipo === 'ok'
        ? '<div class="sim-q"><p class="sim-q-label">É a primeira empresa que você abre? ' +
          '<span class="sim-q-label-soft">Não muda o resultado. Toque de novo pra desmarcar.</span></p>' +
          '<div class="sim-cards sim-cards--regua sim-cards--coorte">' +
            cardIcone('primeira', 'coorte', 'É a primeira', 'coorte-primeira', s.coorte === 'primeira') +
            cardIcone('ja-abri', 'coorte', 'Já abri antes', 'coorte-ja-abri', s.coorte === 'ja-abri') +
          '</div></div>'
        : '');
    return { meta: 'Resultado', titulo: '', sub: '', corpo: corpo,
             cta: v.cta.label, ctaHref: v.cta.href, pronto: true,
             topoAcao: { label: 'Refazer', acao: 'refazer' } };
  }
  function telaAtual() {
    switch (PASSOS[s.passo].id) {
      case 'regime':      return telaRegime();
      case 'atividade':   return telaAtividade();
      case 'local':       return telaLocal();
      case 'imovel':      return telaImovel();
      case 'socios':      return telaSocios();
      case 'faturamento': return telaFaixa();
      default:            return telaResultado();
    }
  }
  function render(animar) {
    var t = telaAtual();
    var ativo = document.activeElement;
    var focoId = ativo && tela.contains(ativo) ? ativo.id : null;
    var caret = focoId && ativo.selectionStart != null ? ativo.selectionStart : null;
    var html = '<div class="sim-top">';
    if (s.passo > 0) {
      html += '<button type="button" class="sim-back" data-acao="voltar">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M14 6 8 12l6 6"/></svg>Voltar</button>';
    }
    html += '<span class="sim-meta">' + esc(t.meta) + '</span>';
    if (t.topoAcao) {
      html += '<button type="button" class="sim-top-acao" data-acao="' + t.topoAcao.acao + '">' + esc(t.topoAcao.label) + '</button>';
    }
    html += '</div>';
    if (t.titulo) html += '<h2 class="sim-h1">' + t.titulo + '</h2>';
    if (t.sub) html += '<p class="sim-sub">' + t.sub + '</p>';
    html += '<div class="sim-body-area">' + t.corpo + '</div>';
    if (!t.semRodape) {
      html += '<div class="sim-foot">';
      if (t.rodapeLink) {
        html += '<a class="sim-foot-link" href="' + t.rodapeLink.href + '" target="_blank" rel="noopener">' + esc(t.rodapeLink.label) + '</a>';
      }
      if (t.ctaHref) {
        html += '<a class="btn btn-primary" href="' + t.ctaHref + '"' +
          (t.ctaHref.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t.cta) + '</a></div>';
      } else {
        html += '<button type="button" class="btn ' + (t.ctaEscuro ? 'btn-dark' : 'btn-primary') + '" data-acao="' + (t.acaoCta || 'avancar') + '"' +
          (t.pronto ? '' : ' disabled') + '>' + esc(t.cta) + '</button></div>';
      }
    }
    tela.innerHTML = html;
    if (animar) {
      tela.setAttribute('data-anim', '1');
      void tela.offsetWidth;
    } else {
      tela.removeAttribute('data-anim');
    }
    if (focoId) {
      var novo = document.getElementById(focoId);
      if (novo) {
        novo.focus();
        if (caret != null && novo.setSelectionRange) {
          try { novo.setSelectionRange(caret, caret); } catch (e) {  }
        }
      }
    }
    var urgente = tela.querySelector('.sim-note--warn, [data-acao="usar-fiscal"], [data-acao="trocar-me"]');
    if (urgente && urgente.scrollIntoView) urgente.scrollIntoView({ block: 'nearest' });
    renderTrilha();
    var live = document.getElementById('sim-live');
    if (live) live.textContent = t.meta + '. ' + (t.titulo ? t.titulo.replace(/<[^>]+>/g, '') : PASSOS[s.passo].rotulo);
  }
  function renderTrilha() {
    var vis = indicesVisiveis();
    var pos = vis.indexOf(s.passo);
    var lista = document.getElementById('sim-rail-list');
    if (lista) {
      lista.innerHTML = vis.map(function (idx, n) {
        var cls = n === pos ? ' is-active' : (n < pos ? ' is-done' : '');
        var marca = n < pos ? CHECK_SVG : String(n + 1);
        var resp = n < pos ? resumoPasso(PASSOS[idx].id) : '';
        return '<li class="sim-rail-item' + cls + (resp ? ' is-resposta' : '') + '">' +
          '<span class="sim-rail-mark">' + marca + '</span>' +
          '<span>' + esc(resp || PASSOS[idx].rotulo) + '</span></li>';
      }).join('');
    }
    var fill = document.getElementById('sim-bar-fill');
    var label = document.getElementById('sim-bar-label');
    var pct = Math.round((pos / (vis.length - 1)) * 100);
    if (fill) fill.style.width = pct + '%';
    if (label) {
      label.textContent = PASSOS[s.passo].rotulo;
    }
  }
  function setCampo(campo, bruto) {
    var v = bruto;
    if (bruto === 'true') v = true;
    else if (bruto === 'false') v = false;
    else if (campo === 'socios') v = Number(bruto);
    if (campo === 'regime' && s.regime !== v) {
      s.regime = v;
      s.faixa = null;
      s.enderecoProprio = null; s.tipoImovel = ''; s.reside = null;
      s.meiOutraEmpresa = null; s.meiServidor = null;
      s.socios = null; s.administracao = null;
      return;
    }
    if (campo === 'categoria') {
      s.categoria = v || null;
      if (s.categoria !== FORA_LISTA) { s.regulamentada = null; s.outraAtividade = ''; }
      return;
    }
    if (campo === 'enderecoProprio') {
      s.enderecoProprio = v;
      if (v === false) { s.filaCidade = false; }
      return;
    }
    if (campo === 'coorte') {
      s.coorte = (s.coorte === v) ? null : v;
      return;
    }
    if (campo === 'faixa') {
      s.faixa = v; s.exato = ''; s.modoExato = false;
      return;
    }
    if (campo === 'socios') {
      s.socios = v;
      if (v === 1) { s.socioNaoAtende = false; s.socioResolvido = false; s.administracao = null; }
      return;
    }
    s[campo] = v;
  }
  function irParaOSimulador() {
    var alvo = document.getElementById('simulador') || tela;
    var y = alvo.getBoundingClientRect().top + window.scrollY - 80;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
  }
  tela.addEventListener('click', function (e) {
    var alvo = e.target.closest('[data-set],[data-acao]');
    if (!alvo) return;
    if (alvo.hasAttribute('data-set')) {
      setCampo(alvo.getAttribute('data-set'), alvo.getAttribute('data-valor'));
      render();
      return;
    }
    var acao = alvo.getAttribute('data-acao');
    if (acao === 'avancar') {
      if ((s.categoria === FORA_LISTA) || s.filaCidade) { s.passo = iRESULTADO; }
      else { s.passo = proximoPasso(s.passo); }
      irParaOSimulador();
      render(true);
    } else if (acao === 'voltar') {
      s.passo = passoAnterior(s.passo);
      render(true);
    } else if (acao === 'trocar-me') {
      s.regime = 'me'; s.faixa = null; s.enderecoProprio = null;
      s.meiOutraEmpresa = null; s.meiServidor = null;
      var iLocal = 2;
      if (s.passo > iLocal) { s.passo = iLocal; render(true); }
      else { render(); }
      return;
    } else if (acao === 'usar-fiscal') {
      s.enderecoProprio = false;
      if (!aplicavel(s.passo)) { s.passo = proximoPasso(s.passo); irParaOSimulador(); render(true); }
      else { render(); }
    } else if (acao === 'fila-cidade') {
      s.filaCidade = true;
      render();
    } else if (acao === 'vale-saber') {
      s.valeSaber = !s.valeSaber;
      render();
    } else if (acao === 'socio-nao-atende') {
      s.socioNaoAtende = true;
      render();
    } else if (acao === 'resolver-socio') {
      s.socioResolvido = true; s.passo = iRESULTADO;
      render(true);
    } else if (acao === 'modo-exato') {
      s.modoExato = true;
      render();
      var campo = document.getElementById('sim-exato');
      if (campo) campo.focus();
    } else if (acao === 'refazer') {
      s = estadoInicial();
      cepBuscado = '';
      render(true);
      irParaOSimulador();
    }
  });
  tela.addEventListener('input', function (e) {
    var campo = e.target.getAttribute && e.target.getAttribute('data-input');
    if (!campo) return;
    if (campo === 'cep') {
      s.cep = mascaraCep(e.target.value);
      if (digitos(s.cep).length < 8) { s.cepInfo = null; cepBuscado = ''; s.filaCidade = false; }
      render();
      buscarCep();
      return;
    }
    if (campo === 'exato') {
      var d = Number(digitos(e.target.value)) || 0;
      var preso = Math.min(d, TETO_ME_MENSAL);
      s.exato = preso ? preso.toLocaleString('pt-BR') : '';
      s.modoExato = true;
      render();
      return;
    }
    s[campo] = e.target.value;
    render();
  });
  tela.addEventListener('change', function (e) {
    var campo = e.target.getAttribute && e.target.getAttribute('data-change');
    if (!campo) return;
    setCampo(campo, e.target.value);
    render();
  });
  render();
})();
