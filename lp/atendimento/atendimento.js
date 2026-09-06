/* ============================================================================
   LEGALIZAI · /atendimento — simulador "a gente consegue te atender?"
   ============================================================================
   Espelha o trecho E3.2 → E5F do flow de ABRIR do app, mais um veredito no fim
   (a LP precisa FECHAR a resposta; no app o E5F emenda no cadastro/E6).

   FONTES (não inventar regra aqui — se divergir do app, o app é que manda):
     · telas e copy .......... legalize/app/src/components/gate-telas.tsx
                              legalize/app/src/components/entrada-lead.tsx
     · gate de BH ............ legalize/app/src/lib/endereco.ts  (ehCepBh)
     · categorias sem MEI .... legalize/app/src/lib/mei.ts       (art. 966 CC)
     · tetos e custos ........ legalize/app/src/lib/fiscal.ts / lib/mei.ts
     · grafo do flow ......... legalize/execucao/flow/versoes/v113-2026-09-05.mmd

   ⚠️ DIVERGÊNCIA ASSUMIDA vs app: o E3.4 é UMA tela lá (categoria + endereço
   rolando juntos) e são DOIS passos aqui. Ordem preservada — categoria antes
   do endereço, como no app desde 29/08. Ver comentário no index.html.

   Sem build, sem framework: estado num objeto, render por innerHTML, eventos
   por delegação. O foco/caret dos campos de texto é restaurado à mão depois de
   cada render (a alternativa seria patch cirúrgico do DOM, caro demais pro
   tamanho deste formulário).
   ========================================================================== */
(function () {
  'use strict';

  var tela = document.getElementById('sim-screen');
  if (!tela) return;

  /* ─── constantes de domínio (cópia fiel do app) ─────────────────────────── */

  var TETO_ME_MENSAL = 30000;    // LC 123 art. 3º II — R$360 mil/ano
  var TETO_MEI_ANUAL = 81000;    // LC 123 art. 18-A
  var TETO_MEI_MENSAL = 6750;
  var ENDERECO_FISCAL = 60;      // R$/mês, CUSTOS.ENDERECO_FISCAL

  // 🔴 PLACEHOLDER, igual ao app (lib/contato.ts): trocar quando existir o
  // número real de atendimento da Legalizai.
  var WHATSAPP = '5531999999999';

  // As 14 categorias derivadas dos 87 CNAEs "atendemos com certeza".
  // A lista SÓ tem o que a gente atende — escolher já é passar pelo gate.
  var PILLS = [
    { id: 'tech',       label: 'Tecnologia e software' },
    { id: 'design',     label: 'Design' },
    { id: 'foto',       label: 'Foto, vídeo e áudio' },
    { id: 'mkt',        label: 'Marketing e publicidade' },
    { id: 'edicao',     label: 'Edição e mídia' },
    { id: 'consult',    label: 'Consultoria, pesquisa e tradução' },
    { id: 'cursos',     label: 'Ensino e cursos' },
    { id: 'arte',       label: 'Arte, cultura e patrimônio' },
    { id: 'eventos',    label: 'Eventos e entretenimento' },
    { id: 'admin',      label: 'Apoio administrativo' },
    { id: 'aluguel',    label: 'Aluguel de equipamentos' },
    { id: 'reparos',    label: 'Reparos e manutenção' },
    { id: 'salao',      label: 'Salão e beleza' },
    { id: 'hospedagem', label: 'Hospedagem' }
  ];
  var FORA_LISTA = 'fora-lista';

  // Profissão intelectual não pode ser MEI (art. 966, § único, CC).
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

  // A grade termina EXATAMENTE no teto do ME. "Não sei ainda" cobre 0–30k de
  // propósito: o gate do MEI precisa ler "incerto", nunca "seguro".
  var FAIXAS = [
    { id: 'nao-sei', label: 'Não sei ainda', min: 0,     max: 30000, desconhecida: true },
    { id: '5-10k',   label: 'R$ 5 a 10 mil', min: 5000,  max: 10000 },
    { id: '10-20k',  label: 'R$ 10 a 20 mil', min: 10000, max: 20000 },
    { id: '20-30k',  label: 'R$ 20 a 30 mil', min: 20000, max: 30000 }
  ];

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

  /**
   * 🔄 O antigo passo "local" virou DOIS: endereço (escolha + CEP + número) e
   * imóvel (casa/apto + mora nele + a regra da PBH). Ele sozinho media 1707px
   * no mobile — duas telas de iPhone — e o aviso da Prefeitura nascia abaixo
   * da dobra, junto com a única saída que a pessoa tinha.
   *
   * `so` marca passo CONDICIONAL: ele existe no array (a ordem é fixa e
   * legível), mas some da trilha e da navegação quando não se aplica. Alguns
   * caminhos têm 6 perguntas, outros 5 — por isso o "Passo X de N" é contado
   * em cima dos passos VISÍVEIS, nunca do tamanho do array.
   */
  var PASSOS = [
    { id: 'regime',      rotulo: 'MEI ou ME' },
    { id: 'atividade',   rotulo: 'Sua atividade' },
    { id: 'local',       rotulo: 'Onde ela fica' },
    { id: 'imovel',      rotulo: 'O imóvel', so: function () {
      // Só o ME passa por análise da Prefeitura, e só quem usa endereço
      // próprio tem imóvel pra descrever. MEI declara e abre; quem escolheu o
      // endereço fiscal está usando o nosso, que já é aprovado.
      // ⚠️ `!== false`, não `=== true`: enquanto a pessoa não respondeu, o
      // passo CONTA. Com `=== true` o rodapé dizia "Passo 3 de 5" e virava
      // "Passo 4 de 6" no clique seguinte — o total crescia no meio do
      // caminho, que é a única direção que soa a armadilha. Assim o ME nasce
      // com 6 e só ENCOLHE pra 5 pra quem escolhe o endereço fiscal.
      return !ehMei() && s.enderecoProprio !== false && !s.filaCidade;
    } },
    { id: 'socios',      rotulo: 'Sócios' },
    { id: 'faturamento', rotulo: 'Faturamento' },
    { id: 'resultado',   rotulo: 'Resultado' }
  ];

  function aplicavel(i) { return !PASSOS[i].so || PASSOS[i].so(); }
  /** Índices dos passos que existem PRA ESTE caminho, na ordem. */
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
  /** "Passo 3 de 6" — conta só perguntas visíveis, sem o resultado. */
  function meta() {
    if (s.passo === iRESULTADO) return 'Resultado';
    var vis = indicesVisiveis().filter(function (i) { return i !== iRESULTADO; });
    return 'Passo ' + (vis.indexOf(s.passo) + 1) + ' de ' + vis.length;
  }

  /* ─── estado ───────────────────────────────────────────────────────────── */

  function estadoInicial() { return {
    passo: 0,
    regime: null,            // 'me' | 'mei'
    categoria: null,         // id de PILLS | FORA_LISTA
    regulamentada: null,
    outraAtividade: '',
    enderecoProprio: null,   // true = meu endereço · false = fiscal da Legalizai
    cep: '',
    cepInfo: null,           // { municipio, uf, logradouro, bairro }
    numero: '',
    complemento: '',
    tipoImovel: '',
    reside: null,
    filaCidade: false,
    // MEI: os 2 impedimentos do M-T, no lugar da triagem de sócios
    meiOutraEmpresa: null,
    meiServidor: null,
    socios: null,            // 1..4
    socioNaoAtende: false,
    valeSaber: false,       // expansível "Vale saber" (fechado por padrão)
    socioResolvido: false,
    administracao: null,     // 'so-eu' | 'com-socios'
    coorte: null,            // 'primeira' | 'ja-abri'
    faixa: null,
    modoExato: false,
    exato: ''
  }; }

  var s = estadoInicial();

  /* ─── utilitários ──────────────────────────────────────────────────────── */

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function digitos(v) { return String(v || '').replace(/\D/g, ''); }
  function mascaraCep(v) {
    var d = digitos(v).slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }
  // Faixa oficial de CEP de Belo Horizonte (Correios). Contagem começa em
  // 32000-000 e NÃO entra: mesma Junta, prefeitura/ISS diferentes.
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
    for (var i = 0; i < FAIXAS.length; i++) {
      var f = FAIXAS[i];
      if (!f.desconhecida && v > f.min && v <= f.max) return f.id;
    }
    return FAIXAS[FAIXAS.length - 1].id;
  }
  function faixaEscolhida() {
    var v = valorExato();
    var id = v > 0 ? faixaDoValor(v) : s.faixa;
    for (var i = 0; i < FAIXAS.length; i++) if (FAIXAS[i].id === id) return FAIXAS[i];
    return null;
  }
  function rotuloCategoria(id) {
    if (id === FORA_LISTA) return 'Não encontrei minha categoria';
    for (var i = 0; i < PILLS.length; i++) if (PILLS[i].id === id) return PILLS[i].label;
    return 'não informada';
  }
  function categoriaTemMei(id) { return CATEGORIAS_SEM_MEI.indexOf(id) === -1; }
  function ehMei() { return s.regime === 'mei'; }
  function linkWhats(msg) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg);
  }

  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5L20 7"/></svg>';
  var BANG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M12 6v8M12 18v.01"/></svg>';
  var INFO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M12 10v8M12 6v.01"/></svg>';
  var CHEVRON_SVG = '<svg class="sim-exp-chevron" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';

  function nota(variante, titulo, texto) {
    var mark = variante === 'ok' ? CHECK_SVG : (variante === 'warn' ? BANG_SVG : INFO_SVG);
    return '<div class="sim-note sim-note--' + variante + '">' +
      '<span class="sim-note-mark">' + mark + '</span><div>' +
      (titulo ? '<p class="sim-note-title">' + esc(titulo) + '</p>' : '') +
      '<p class="sim-note-text">' + texto + '</p></div></div>';
  }
  function listaChecks(itens) {
    return '<ul class="sim-checks">' + itens.map(function (t) {
      return '<li>' + CHECK_SVG + '<span>' + esc(t) + '</span></li>';
    }).join('') + '</ul>';
  }
  function cardIcone(valor, campo, label, base, selecionado) {
    return '<button type="button" class="sim-card" aria-pressed="' + (selecionado ? 'true' : 'false') + '"' +
      ' data-set="' + campo + '" data-valor="' + valor + '">' +
      '<span class="sim-card-check">' + CHECK_SVG + '</span>' +
      '<img src="/atendimento/icones/' + base + (selecionado ? '-creme' : '-coral') + '.png" alt="" aria-hidden="true">' +
      '<span>' + esc(label) + '</span></button>';
  }
  function botoesLinha(campo, opcoes, atual) {
    return '<div class="sim-row">' + opcoes.map(function (o) {
      return '<button type="button" class="sim-pick" data-set="' + campo + '" data-valor="' + o.v +
        '" aria-pressed="' + (String(atual) === String(o.v) ? 'true' : 'false') + '">' + esc(o.label) + '</button>';
    }).join('') + '</div>';
  }
  function select(campo, valor, opcoes, placeholder) {
    return '<select class="sim-select" data-change="' + campo + '">' +
      '<option value=""' + (!valor ? ' selected' : '') + '>' + esc(placeholder) + '</option>' +
      opcoes.map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (valor === o.v ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select>';
  }

  /* ─── busca de CEP ─────────────────────────────────────────────────────────
     ViaCEP é só pra mostrar rua/cidade (e nomear a cidade que entra na fila).
     O GATE nunca depende dela: quem decide se é BH é a faixa de CEP, offline.
     Falhou a rede? cai no fallback e a tela segue funcionando igual. */
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
        if (digitos(s.cep) !== alvo) return;          // pessoa já mudou o CEP
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

  /* ─── passo 1 · E3.2 — MEI × ME ────────────────────────────────────────── */

  function telaRegime() {
    var r = s.regime;
    var corpo =
      '<div class="sim-cards">' +
        cardIcone('me', 'regime', 'ME', 'regime-me', r === 'me') +
        cardIcone('mei', 'regime', 'MEI', 'regime-mei', r === 'mei') +
      '</div>';

    if (r) {
      corpo += '<div class="sim-panel"><p class="sim-panel-title">' + esc(REGIME_CHECKS[r].nome) + '</p>' +
        listaChecks(REGIME_CHECKS[r].checks) + '</div>';
    }

    return {
      meta: meta(),
      titulo: 'Você será MEI ou ME?',
      sub: 'Toque pra comparar. A escolha define o resto da abertura.',
      corpo: corpo,
      rodapeLink: { label: 'Tirar dúvida no WhatsApp', href: linkWhats('Oi! Estou vendo no site se a Legalizai me atende e travei na escolha entre MEI e ME. Podem me ajudar?') },
      cta: 'Continuar',
      pronto: !!r
    };
  }

  /* ─── passo 2 · E3.4 (gate 2) — o que você faz ─────────────────────────── */

  function telaAtividade() {
    var cat = s.categoria;
    var foraLista = cat === FORA_LISTA;
    var semMei = ehMei() && cat && !foraLista && !categoriaTemMei(cat);
    var cepCheio = digitos(s.cep).length === 8;

    var opcoes = PILLS.map(function (p) {
      return {
        v: p.id,
        // No MEI as 3 sem ocupação ganham o rótulo na própria lista: a pessoa
        // lê o limite antes de escolher, e quem escolhe assim mesmo encontra a
        // explicação completa logo abaixo.
        label: (ehMei() && !categoriaTemMei(p.id)) ? p.label + ' (só como ME)' : p.label
      };
    });
    opcoes.push({ v: FORA_LISTA, label: 'Não encontrei minha categoria' });

    var corpo =
      '<div class="sim-q">' +
        '<p class="sim-q-label">O que você faz?</p>' +
        '<p class="sim-q-hint">Escolha o que mais se parece. O código certo a gente encontra depois.</p>' +
        select('categoria', cat, opcoes, 'Escolha uma categoria') +
      '</div>';

    // 🔴 A porta fechada que vira porta aberta. Só existe no MEI.
    if (semMei) {
      corpo += nota('info', 'Essa atividade não pode ser MEI',
        'A lei não considera empresário quem exerce profissão intelectual (art. 966 do Código Civil), então tecnologia, design e consultoria não entram na lista do MEI. Não é escolha nossa, e não tem exceção.') +
        '<p class="sim-note-text">A boa notícia: a gente atende essa atividade como <strong>ME no Simples Nacional</strong>, que é o caminho certo pro seu caso.</p>' +
        '<button type="button" class="btn btn-primary" data-acao="trocar-me" style="width:100%;padding:14px">Continuar como ME</button>';
    }

    // Fora da lista: pede a atividade regulamentada de verdade + a cidade.
    if (foraLista) {
      corpo += '<div class="sim-q">' +
        select('regulamentada', s.regulamentada, REGULAMENTADAS, 'Qual é a sua atividade?');
      if (s.regulamentada === 'outra') {
        corpo += '<div class="sim-field"><label class="sim-field-label" for="sim-outra">Sua atividade</label>' +
          '<input class="sim-input" id="sim-outra" data-input="outraAtividade" value="' + esc(s.outraAtividade) + '" placeholder="Descreve com suas palavras"></div>';
      }
      corpo += '<div class="sim-field"><label class="sim-field-label" for="sim-cep">CEP</label>' +
        '<span class="sim-field-hint">A gente usa só pra identificar sua cidade.</span>' +
        '<input class="sim-input" id="sim-cep" data-input="cep" inputmode="numeric" value="' + esc(s.cep) + '" placeholder="00000-000"></div>';
      if (cepCheio && s.cepInfo && s.cepInfo.municipio) {
        corpo += '<div class="sim-endereco"><p class="sim-endereco-cidade">' + esc(s.cepInfo.municipio) + ' · ' + esc(s.cepInfo.uf) + '</p>' +
          '<p class="sim-endereco-nota">É essa cidade que entra na fila.</p></div>';
      }
      if (cepCheio) {
        corpo += nota('ok', ehCepBh(s.cep) ? 'Ainda não atendemos essa categoria' : 'Ainda não atendemos sua categoria e cidade',
          'A gente está em expansão. Confirma aqui embaixo e você garante condição especial quando a gente te atender.');
      }
      corpo += '</div>';
    }

    var prontoFora = foraLista && s.regulamentada !== null &&
      (s.regulamentada !== 'outra' || s.outraAtividade.trim() !== '') && cepCheio;

    return {
      meta: meta(),
      titulo: 'Sobre a sua empresa',
      sub: 'A lista tem só o que a gente atende hoje. Se você se encontra nela, já passou por esse filtro.',
      corpo: corpo,
      cta: foraLista ? 'Me inscrever e garantir condição' : 'Continuar',
      pronto: foraLista ? prontoFora : (!!cat && !semMei)
    };
  }

  /* ─── passo 3 · E3.4 (gate 1) — onde a empresa fica ────────────────────── */

  function telaLocal() {
    var mei = ehMei();
    var cepCheio = digitos(s.cep).length === 8;
    var cepOk = cepCheio && (mei || ehCepBh(s.cep));
    var foraDeBh = cepCheio && !mei && !ehCepBh(s.cep);
    var proprio = mei ? true : s.enderecoProprio === true;
    var fiscal = !mei && s.enderecoProprio === false;

    var corpo = '';

    if (!mei) {
      // sem rótulo próprio: o título da tela já faz a pergunta (no app este
      // bloco divide a tela com o de categoria, aqui ele é a tela inteira)
      // 🔄 os 2 cards de endereço agora dividem UMA linha (`.sim-wide-duo`).
      // Empilhados custavam ~190px de altura pra 2 opções curtas; lado a lado
      // custam ~110px, e a comparação fica no mesmo golpe de vista. A nota de
      // cobrança recorrente desceu pra DEPOIS da dupla — no meio dela agora
      // quebraria a linha e desfaria a economia.
      corpo += '<div class="sim-q">' +
        '<p class="sim-q-hint" style="margin-top:0">A empresa precisa ficar em Belo Horizonte. Se você mora fora, dá pra usar o nosso.</p>' +
        '<div class="sim-wide-duo">' +
        // ordem da tela do app: o endereço da Legalizai vem primeiro
        '<button type="button" class="sim-wide" data-set="enderecoProprio" data-valor="false" aria-pressed="' + (fiscal ? 'true' : 'false') + '">' +
          '<span class="sim-wide-head"><span class="sim-wide-title">Quero um endereço da Legalizai</span>' +
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
      corpo += '<div class="sim-q">' +
        '<div class="sim-field"><label class="sim-field-label" for="sim-cep">CEP da empresa</label>' +
        '<span class="sim-field-hint">A gente puxa o resto do endereço.</span>' +
        '<input class="sim-input" id="sim-cep" data-input="cep" inputmode="numeric" value="' + esc(s.cep) + '" placeholder="00000-000"></div>';

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
            '<p class="sim-inline-text">Mas isso não te trava: clica em <strong>“Quero um endereço da Legalizai”</strong> aqui em cima, e a empresa nasce em BH do mesmo jeito.</p>' +
            '<button type="button" class="sim-inline-link" data-acao="fila-cidade">Quero abrir na minha cidade mesmo assim</button></div>';
        }
      } else if (cepOk && s.cepInfo) {
        if (s.cepInfo.logradouro || s.cepInfo.municipio) {
          corpo += '<div class="sim-endereco">' +
            (s.cepInfo.logradouro ? '<p class="sim-endereco-rua">' + esc(s.cepInfo.logradouro) + (s.cepInfo.bairro ? ', ' + esc(s.cepInfo.bairro) : '') + '</p>' : '') +
            '<p class="sim-endereco-cidade">' + esc(s.cepInfo.municipio || 'Belo Horizonte') + ' · ' + esc(s.cepInfo.uf || 'MG') + '</p></div>';
        }
        corpo += '<div class="sim-duo">' +
          '<div class="sim-field"><label class="sim-field-label" for="sim-numero">Número</label>' +
          '<input class="sim-input" id="sim-numero" data-input="numero" inputmode="numeric" value="' + esc(s.numero) + '" placeholder="123"></div>' +
          '<div class="sim-field"><label class="sim-field-label" for="sim-compl">Complemento</label>' +
          '<input class="sim-input" id="sim-compl" data-input="complemento" value="' + esc(s.complemento) + '" placeholder="Complemento"></div>' +
        '</div>';

        // 🔄 o bloco do imóvel (casa/apto + mora nele + regra da PBH) saiu daqui
        // e virou o passo próprio `telaImovel`. Ver o comentário em PASSOS.
      }

      if (mei && cepOk) {
        corpo += nota('info', 'Pode ser o seu endereço de casa',
          'No MEI não existe consulta prévia de viabilidade, e em BH o alvará é dispensado pras atividades de baixo risco. Você declara o endereço e assume o compromisso de seguir as regras do município.');
      }
      corpo += '</div>';
    }

    // o imóvel deixou de pesar aqui: ele é o passo seguinte, e só existe pra
    // quem chega neste ponto com endereço próprio em BH.
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

  /* ─── passo 4 · E3.4 (parte 3) — o imóvel e a regra da Prefeitura ────────
     Só existe pro ME com endereço próprio. A regra é da PBH e decide
     deferimento: se a sede é apartamento, um sócio precisa morar nele. No app
     isso vivia dentro do E3.4; aqui é tela própria porque somado ao endereço
     dava 1707px de rolagem no mobile — e o aviso, que é a informação mais
     importante da tela, ficava embaixo de tudo. */

  function telaImovel() {
    var apeSemResidencia = s.tipoImovel === 'apartamento' && s.reside === false;

    var corpo = '<div class="sim-field"><label class="sim-field-label" for="sim-tipo">Esse endereço é casa ou apartamento?</label>' +
      select('tipoImovel', s.tipoImovel, [
        { v: 'casa', label: 'Casa' },
        { v: 'apartamento', label: 'Apartamento' },
        { v: 'outro', label: 'Outro (sala, loja, galpão)' }
      ], 'Escolha uma opção') + '</div>';

    if (s.tipoImovel !== '') {
      corpo += '<div class="sim-q"><p class="sim-q-label">Você mora nesse endereço?</p>' +
        botoesLinha('reside', [{ v: 'false', label: 'Não' }, { v: 'true', label: 'Sim' }],
          s.reside === null ? '' : String(s.reside)) + '</div>';
    }

    // 🔴 A saída honesta. No app ela morava no C4, pós-pagamento, e lá o campo
    // era travado em "Sim" — quem tinha apartamento onde não mora ficava sem
    // caminho depois de já ter pago.
    if (apeSemResidencia) {
      corpo += nota('warn', 'Apartamento só serve se você morar nele',
        'A Prefeitura de Belo Horizonte indefere empresa em apartamento quando nenhum sócio mora no endereço. Dá pra resolver usando outro endereço seu, ou o da Legalizai por ' + brl(ENDERECO_FISCAL) + '/mês.') +
        '<button type="button" class="btn btn-primary" data-acao="usar-fiscal" style="width:100%;padding:14px">Usar o endereço da Legalizai</button>';
    } else if (s.tipoImovel !== '' && s.reside !== null) {
      corpo += nota('ok', '', 'Endereço aprovado pela regra da Prefeitura. É esse que vai no seu CNPJ.');
    }

    return {
      meta: meta(),
      titulo: 'Sobre o imóvel',
      sub: 'Uma regra da Prefeitura de BH decide se o endereço é aceito. Melhor descobrir agora, não depois de pagar.',
      corpo: corpo,
      cta: 'Continuar',
      pronto: s.tipoImovel !== '' && s.reside !== null && !apeSemResidencia
    };
  }

  /* ─── passo 4 · E5T (triagem) — ou M-T (impedimentos, no MEI) ──────────── */

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
      corpo += nota('ok', '', 'É o mais comum entre os prestadores de serviço. Se um dia você quiser ter sócio, dá pra incluir depois, já com a empresa em pé.');
    }

    if (temSocio) {
      var plural = s.socios === 2;
      /* 🔄 "Vale saber" virou EXPANSÍVEL, fechado por padrão. Não é pergunta:
         são 3 consequências da escolha do Simples, que a pessoa lê uma vez e
         não decide nada com elas. Aberto, custava ~190px na tela mais cheia do
         flow. Fechado, vira uma linha e continua a um toque de distância.
         ⚠️ O link de escape ("meu sócio não atende um dos critérios") ficou de
         FORA do expansível, e é de propósito: ele é a única saída dessa tela
         pra quem não se encaixa, e esconder saída atrás de um toque é
         exatamente o que a doutrina do flow não faz. */
      corpo += '<div class="sim-panel sim-exp">' +
        '<button type="button" class="sim-exp-head" data-acao="vale-saber" aria-expanded="' + (s.valeSaber ? 'true' : 'false') + '">' +
          '<span class="sim-panel-title" style="margin:0">Vale saber</span>' +
          '<span class="sim-exp-meta">3 pontos sobre sócio' + CHEVRON_SVG + '</span>' +
        '</button>' +
        (s.valeSaber ? listaChecks([
          plural ? 'Seu sócio precisa morar no Brasil' : 'Seus sócios precisam morar no Brasil',
          plural ? 'Seu sócio entra só com CPF, não CNPJ' : 'Seus sócios entram só com CPF, não CNPJ',
          plural ? 'Seu sócio vai assinar (GOV.BR) na hora de constituir a empresa'
                 : 'Seus sócios vão assinar (GOV.BR) na hora de constituir a empresa'
        ]) : '') +
        '</div>';

      if (!s.socioNaoAtende) {
        corpo += '<button type="button" class="sim-link" data-acao="socio-nao-atende" style="margin-top:-10px">Meu sócio não atende um dos critérios</button>';
      } else if (!s.socioResolvido) {
        corpo += '<div class="sim-inline"><p class="sim-inline-text">Sem problema. Esse caso a Legalize Digital atende pela contabilidade tradicional, fora do produto automatizado.</p></div>';
      } else {
        corpo += '<div class="sim-inline"><p class="sim-inline-title">Combinado, já anotamos</p>' +
          '<p class="sim-inline-text">Nosso time da Legalize Digital vai entrar em contato pra seguir pela contabilidade tradicional.</p></div>';
      }

      corpo += '<div class="sim-q"><p class="sim-q-label">Quem vai administrar a empresa?</p>' +
        '<p class="sim-q-hint">Quem administra assina pela empresa: banco, cartório, contratos.</p>' +
        botoesLinha('administracao', [
          { v: 'so-eu', label: 'Só eu' },
          { v: 'com-socios', label: plural ? 'Eu e meu sócio' : 'Eu e meus sócios' }
        ], s.administracao) +
        (s.administracao === 'so-eu'
          ? '<p class="sim-endereco-nota">Você resolve tudo sozinho. ' + (plural ? 'Seu sócio continua sócio e participa dos resultados.' : 'Seus sócios continuam sócios e participam dos resultados.') + '</p>'
          : (s.administracao === 'com-socios'
            ? '<p class="sim-endereco-nota">Cada um pode assinar sozinho. Alguns bancos pedem todos juntos pra abrir a conta.</p>'
            : '')) +
        '</div>';
    }

    // 🔄 a coorte ("é a primeira empresa?") SAIU desta tela e foi pro veredito.
    // Ela não é gate — é dado de marketing (o app já a realocou 3 vezes) — e
    // aqui era o 4º bloco independente da mesma tela, valendo ~200px de
    // rolagem interna. No resultado a pessoa já teve a resposta dela, então
    // responder não custa atenção nenhuma.
    var completo = s.socios !== null && (!temSocio || s.administracao !== null);

    if (s.socioNaoAtende && !s.socioResolvido) {
      return {
        meta: meta(), titulo: 'Perguntas rápidas',
        sub: 'Rápido, só o essencial antes da gente continuar.',
        corpo: corpo, cta: 'Falar com o time', pronto: true, acaoCta: 'resolver-socio', ctaEscuro: true
      };
    }
    return {
      meta: meta(),
      titulo: 'Perguntas rápidas',
      sub: 'Rápido, só o essencial antes da gente continuar.',
      corpo: corpo,
      cta: 'Continuar',
      pronto: completo
    };
  }

  // M-T · impedimentos do MEI (ocupa o lugar da triagem de sócios no ramo MEI).
  function telaImpedimentosMei() {
    var corpo =
      '<div class="sim-q"><p class="sim-q-label">Você já é sócio ou dono de outra empresa?</p>' +
      '<p class="sim-q-hint">Quem já tem CNPJ não pode abrir MEI. É impedimento da lei, não regra nossa.</p>' +
      botoesLinha('meiOutraEmpresa', [{ v: 'false', label: 'Não' }, { v: 'true', label: 'Sim' }],
        s.meiOutraEmpresa === null ? '' : String(s.meiOutraEmpresa)) + '</div>';

    if (s.meiOutraEmpresa === true) {
      corpo += nota('warn', 'Com outra empresa no seu nome, o MEI não serve',
        'Se o que você quer é trazer pra Legalizai a empresa que já existe, isso a gente atende.');
    }

    corpo += '<div class="sim-q"><p class="sim-q-label">Você é servidor público federal na ativa?</p>' +
      '<p class="sim-q-hint">A lei proíbe servidor federal de ser MEI. Estadual e municipal depende do estatuto.</p>' +
      botoesLinha('meiServidor', [{ v: 'false', label: 'Não' }, { v: 'true', label: 'Sim' }],
        s.meiServidor === null ? '' : String(s.meiServidor)) + '</div>';

    if (s.meiServidor === true) {
      corpo += nota('warn', 'Servidor federal não pode ser MEI',
        'Nesse caso o caminho passa por uma conversa com o contador antes de abrir qualquer coisa. A gente te ajuda a achar a saída certa.');
    }

    // a coorte também saiu daqui — mesmo motivo do ramo ME, ver telaSocios.
    return {
      meta: meta(),
      titulo: 'Perguntas rápidas',
      sub: 'No MEI não existe sócio. O que a gente confere aqui são os dois impedimentos da lei.',
      corpo: corpo,
      cta: 'Continuar',
      pronto: s.meiOutraEmpresa !== null && s.meiServidor !== null
    };
  }

  /* ─── passo 5 · E5F — faixa de faturamento ─────────────────────────────── */

  function telaFaixa() {
    var v = valorExato();
    var f = faixaEscolhida();
    var mei = ehMei();
    // Gate de teto (só MEI): valor exato acima de 6.750 estoura; faixa que
    // COMEÇA acima do teto estoura; faixa que CONTÉM o teto vira aviso.
    var estoura = mei && (v > TETO_MEI_MENSAL || (v === 0 && !!f && f.min >= TETO_MEI_MENSAL));
    var incerto = mei && !estoura && v === 0 && !!f && f.max > TETO_MEI_MENSAL;

    var selecionada = v > 0 ? faixaDoValor(v) : s.faixa;
    // 🔄 No modo exato a grade encolhe (ícone menor, rótulo ao lado): ali ela
    // deixou de ser a resposta e virou RÉGUA — mostra em que faixa o número
    // digitado cai. Continua em 2 colunas, mas custa ~180px a menos, que é o
    // que fazia a tela do gate de teto do MEI passar de 1300px no mobile.
    var corpo = '<div class="sim-cards' + (s.modoExato ? ' sim-cards--regua' : '') + '">' + FAIXAS.map(function (fx, i) {
      return cardIcone(fx.id, 'faixa', fx.label, 'faixa-' + (i + 1), selecionada === fx.id);
    }).join('') + '</div>';

    if (s.modoExato) {
      corpo += '<div class="sim-field"><label class="sim-field-label" for="sim-exato">Valor exato por mês</label>' +
        '<div class="sim-input-prefix"><span>R$</span>' +
        '<input class="sim-input" id="sim-exato" data-input="exato" inputmode="numeric" value="' + esc(s.exato) + '" placeholder="0"></div>';
      if (v >= TETO_ME_MENSAL) {
        corpo += '<p class="sim-endereco-nota">Esse é o teto do ME: ' + brl(TETO_ME_MENSAL) + ' por mês (' + brl(TETO_ME_MENSAL * 12) + ' por ano). Acima disso a empresa vira EPP, e aí a gente conversa antes de abrir.</p>';
      }
      if (v > 0 && f) {
        corpo += '<p class="sim-field-hint">Isso te coloca na faixa <strong>' + esc(f.label) + '</strong>.</p>';
      }
      corpo += '</div>';
    } else {
      corpo += '<button type="button" class="sim-link" data-acao="modo-exato">Sei o valor exato</button>';
    }

    if (estoura) {
      corpo += nota('info', 'Com esse faturamento, o MEI não serve',
        'O MEI tem teto de ' + brl(TETO_MEI_ANUAL) + ' por ano, que dá ' + brl(TETO_MEI_MENSAL) + ' por mês. Passar disso não é impedimento pra abrir empresa: é só sinal de que o seu caso é ME no Simples Nacional.') +
        '<p class="sim-note-text">Melhor descobrir agora. Quem estoura o teto depois de aberto paga a diferença como ME, e acima de 20% ainda entra juros e multa.</p>' +
        '<button type="button" class="btn btn-primary" data-acao="trocar-me" style="width:100%;padding:14px">Continuar como ME</button>';
    } else if (incerto) {
      corpo += nota('warn', 'Fica de olho no teto do MEI',
        'O limite do MEI é ' + brl(TETO_MEI_MENSAL) + ' por mês (' + brl(TETO_MEI_ANUAL) + ' no ano), e ele cai dentro dessa faixa. Se quiser ter certeza agora, informa o valor exato aqui em cima.');
    }

    return {
      meta: meta(),
      titulo: 'Quanto você vai faturar por mês? <span class="sim-h1-soft">Pode ser estimativa!</span>',
      sub: 'Se você já sabe o valor, melhor ainda.',
      corpo: corpo,
      cta: 'Ver o resultado',
      pronto: !!(selecionada) && !estoura
    };
  }

  /* ─── veredito ─────────────────────────────────────────────────────────────
     Os "nãos" nunca são beco: cada um sai por uma porta de verdade (fila,
     contabilidade tradicional, migração). Ordem importa — o caso mais
     específico ganha do mais genérico. */

  function calcularVeredito() {
    if (s.socioNaoAtende) {
      return {
        tipo: 'humano',
        titulo: 'Seu caso é com um contador, não com o app',
        texto: 'Sócio fora dos critérios do Simples (mora fora do Brasil, entra por CNPJ) não cabe no fluxo automatizado, mas cabe na Legalize Digital, que é o escritório por trás da Legalizai, pela contabilidade tradicional.',
        cta: { label: 'Falar com o time no WhatsApp', href: linkWhats('Oi! Simulei no site e meu sócio não atende um dos critérios. Queria falar com o time sobre a contabilidade tradicional.') }
      };
    }
    if (s.categoria === FORA_LISTA) {
      // Quem já está em BH só esbarra na CATEGORIA — prometer "quando a gente
      // chegar na sua cidade" pra quem mora aqui soa a texto genérico.
      var emBh = ehCepBh(s.cep);
      var cidade = (s.cepInfo && s.cepInfo.municipio) ? s.cepInfo.municipio : 'sua cidade';
      return {
        tipo: 'espera',
        titulo: 'Ainda não, mas você entrou na fila',
        texto: 'Sua atividade é regulamentada e precisa de responsável técnico registrado no conselho. Hoje isso fica fora do que o app resolve sozinho. A gente está em expansão' +
          (emBh ? ', e quando abrir pra sua área você tem condição especial.'
                : ', e quando chegar em ' + esc(cidade) + ' e na sua área você tem condição especial.'),
        cta: { label: 'Falar com o time no WhatsApp', href: linkWhats('Oi! Simulei no site, minha atividade é regulamentada e entrei na fila. Queria entender as opções.') }
      };
    }
    if (s.filaCidade) {
      var c = (s.cepInfo && s.cepInfo.municipio) ? s.cepInfo.municipio : 'sua cidade';
      return {
        tipo: 'espera',
        titulo: 'A gente ainda não abriu em ' + esc(c),
        texto: 'Por enquanto o app só abre empresa com sede em Belo Horizonte. Você entrou na fila e garante oferta especial quando a gente chegar aí. E, se quiser antecipar, dá pra abrir hoje mesmo usando o endereço fiscal da Legalizai em BH por ' + brl(ENDERECO_FISCAL) + '/mês.',
        cta: { label: 'Quero saber do endereço em BH', href: linkWhats('Oi! Simulei no site, moro fora de BH e queria entender o endereço fiscal da Legalizai.') }
      };
    }
    if (ehMei() && s.meiOutraEmpresa === true) {
      return {
        tipo: 'humano',
        titulo: 'MEI não dá, mas a gente atende do mesmo jeito',
        texto: 'Quem já é sócio ou dono de outra empresa não pode abrir MEI. Se a ideia é trazer pra cá a empresa que já existe, essa parte a gente faz.',
        // UX-55: a copy pergunta pelo FATO ("já tenho empresa"), nunca pela
        // operação. "Migrar" é jargão, e quem não tem contador nem se
        // reconhece nela — e esse é justamente o melhor caso desse caminho.
        cta: { label: 'Falar sobre a empresa que já tenho', href: linkWhats('Oi! Simulei no site: já tenho uma empresa e queria trazer ela pra Legalizai.') }
      };
    }
    if (ehMei() && s.meiServidor === true) {
      return {
        tipo: 'humano',
        titulo: 'Servidor federal não pode ser MEI',
        texto: 'É vedação da lei, não regra nossa. Dependendo do seu vínculo pode existir caminho como ME. Vale meia hora de conversa com o contador antes de abrir qualquer coisa.',
        cta: { label: 'Falar com o contador', href: linkWhats('Oi! Simulei no site, sou servidor federal e queria entender que caminho tenho pra abrir empresa.') }
      };
    }
    return {
      tipo: 'ok',
      titulo: 'Sim, a gente atende o seu caso',
      texto: ehMei()
        ? 'Seu MEI entra no que a Legalizai abre hoje: atividade na lista, sem impedimento e dentro do teto. O próximo passo é no app. A abertura sai da sua mão e vem pra nossa.'
        : 'Sua ME entra no que a Legalizai abre hoje: atividade na lista, sede resolvida em BH e faturamento dentro do Simples. O próximo passo é no app. A abertura sai da sua mão e vem pra nossa.',
      // embutido na home o #baixar está na própria página; na página
      // standalone precisa do caminho completo, senão a âncora não existe
      cta: { label: 'Baixar o app e começar', href: document.getElementById('baixar') ? '#baixar' : '/home#baixar' }
    };
  }

  function telaResultado() {
    var v = calcularVeredito();
    var icone = v.tipo === 'ok'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m4 12.5 5.2 5.2L20 7"/></svg>'
      : (v.tipo === 'espera'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 7.6V12l3 2"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M20 20.5v-1.8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1.8"/><circle cx="12" cy="7.6" r="3.9" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>');

    var f = faixaEscolhida();
    var linhas = [
      ['Regime', ehMei() ? 'MEI' : 'ME · Simples Nacional'],
      ['Atividade', rotuloCategoria(s.categoria)]
    ];
    if (s.categoria !== FORA_LISTA) {
      var ondeFica = s.filaCidade
        ? ((s.cepInfo && s.cepInfo.municipio ? s.cepInfo.municipio : 'Fora de BH') + ' · fila de espera')
        : (s.enderecoProprio === false
          ? 'Endereço fiscal da Legalizai · ' + brl(ENDERECO_FISCAL) + '/mês'
          : ((s.cepInfo && s.cepInfo.municipio ? s.cepInfo.municipio : 'Belo Horizonte') + (s.cepInfo && s.cepInfo.uf ? ' · ' + s.cepInfo.uf : ' · MG')));
      linhas.push(['Onde fica', ondeFica]);
      if (!ehMei() && s.socios) {
        linhas.push(['Donos', s.socios === 1 ? 'Só você' : s.socios + ' pessoas']);
      }
      if (f) linhas.push(['Faturamento', valorExato() > 0 ? brl(valorExato()) + '/mês' : f.label]);
    }

    var corpo =
      '<div class="sim-selo sim-selo--' + v.tipo + '">' +
        '<span class="sim-selo-icon">' + icone + '</span>' +
        '<h2>' + v.titulo + '</h2>' +
        '<p>' + v.texto + '</p>' +
      '</div>' +
      '<div class="sim-resumo">' + linhas.map(function (l) {
        return '<div class="sim-resumo-row"><span class="sim-resumo-k">' + esc(l[0]) + '</span><span class="sim-resumo-v">' + esc(l[1]) + '</span></div>';
      }).join('') + '</div>' +
      (v.tipo === 'ok'
        ? nota('ok', '', 'Isso é uma triagem, não um contrato. Quem confirma o CNAE exato e o enquadramento é o contador, já dentro do app, e antes de qualquer cobrança.')
        : nota('info', '', 'Simulação com as regras de hoje. Elas mudam quando a gente expande, e por isso a fila existe.')) +
      // 🔄 a coorte mora AQUI desde que saiu da triagem: dado de marketing,
      // nunca gate. Depois do veredito ela não disputa atenção com nada — a
      // pessoa já tem a resposta que veio buscar. Respondida, encolhe pra uma
      // linha de recibo em vez de continuar ocupando os 2 cartões.
      (s.coorte
        ? nota('ok', '', 'Anotado: ' + (s.coorte === 'primeira' ? 'é a sua primeira empresa' : 'você já abriu empresa antes') + '.')
        : '<div class="sim-q"><p class="sim-q-label">É a primeira empresa que você abre?</p>' +
          '<p class="sim-q-hint">Só pra gente saber te acompanhar do jeito certo. Não muda em nada o resultado acima.</p>' +
          '<div class="sim-cards">' +
            cardIcone('primeira', 'coorte', 'É a primeira', 'coorte-primeira', false) +
            cardIcone('ja-abri', 'coorte', 'Já abri antes', 'coorte-ja-abri', false) +
          '</div></div>') +
      '<div class="sim-actions">' +
        '<a class="btn btn-primary" href="' + v.cta.href + '"' + (v.cta.href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' + esc(v.cta.label) + '</a>' +
        '<button type="button" class="btn btn-ghost-ink" data-acao="refazer">Refazer a simulação</button>' +
      '</div>';

    return { meta: 'Resultado', titulo: '', sub: '', corpo: corpo, semRodape: true };
  }

  /* ─── render ───────────────────────────────────────────────────────────── */

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

    // guarda foco/caret: o innerHTML abaixo destrói o campo que está sendo digitado
    var ativo = document.activeElement;
    var focoId = ativo && tela.contains(ativo) ? ativo.id : null;
    var caret = focoId && ativo.selectionStart != null ? ativo.selectionStart : null;

    var html = '<div class="sim-top">';
    if (s.passo > 0) {
      html += '<button type="button" class="sim-back" data-acao="voltar">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M14 6 8 12l6 6"/></svg>Voltar</button>';
    }
    html += '<span class="sim-meta">' + esc(t.meta) + '</span></div>';

    if (t.titulo) html += '<h2 class="sim-h1">' + t.titulo + '</h2>';
    if (t.sub) html += '<p class="sim-sub">' + t.sub + '</p>';
    html += '<div class="sim-body-area">' + t.corpo + '</div>';

    if (!t.semRodape) {
      html += '<div class="sim-foot">';
      if (t.rodapeLink) {
        html += '<a class="sim-foot-link" href="' + t.rodapeLink.href + '" target="_blank" rel="noopener">' + esc(t.rodapeLink.label) + '</a>';
      }
      html += '<button type="button" class="btn ' + (t.ctaEscuro ? 'btn-dark' : 'btn-primary') + '" data-acao="' + (t.acaoCta || 'avancar') + '"' +
        (t.pronto ? '' : ' disabled') + '>' + esc(t.cta) + '</button></div>';
    }

    tela.innerHTML = html;
    if (animar) {
      tela.setAttribute('data-anim', '1');
      // reinicia a animação (mesma classe, mesmo nó): força reflow
      void tela.offsetWidth;
    } else {
      tela.removeAttribute('data-anim');
    }

    if (focoId) {
      var novo = document.getElementById(focoId);
      if (novo) {
        novo.focus();
        if (caret != null && novo.setSelectionRange) {
          try { novo.setSelectionRange(caret, caret); } catch (e) { /* select não tem */ }
        }
      }
    }

    // Com o corpo rolando por dentro (desktop), um aviso que nasce embaixo
    // pode ficar fora de vista — e justamente os avisos carregam a saída
    // (trocar de regime, usar o endereço fiscal). Traz pra vista sem roubar o
    // foco de quem está digitando.
    var urgente = tela.querySelector('.sim-note--warn, [data-acao="usar-fiscal"], [data-acao="trocar-me"]');
    if (urgente && urgente.scrollIntoView) urgente.scrollIntoView({ block: 'nearest' });

    renderTrilha();
    var live = document.getElementById('sim-live');
    if (live) live.textContent = t.meta + '. ' + (t.titulo ? t.titulo.replace(/<[^>]+>/g, '') : PASSOS[s.passo].rotulo);
  }

  function renderTrilha() {
    // a trilha lista só os passos que existem PRA ESTE caminho (o do imóvel
    // some pro MEI e pra quem usa o endereço fiscal), e numera pela posição
    // visível — senão apareceria um buraco entre o 3 e o 5.
    var vis = indicesVisiveis();
    var pos = vis.indexOf(s.passo);
    var lista = document.getElementById('sim-rail-list');
    if (lista) {
      lista.innerHTML = vis.map(function (idx, n) {
        var cls = n === pos ? ' is-active' : (n < pos ? ' is-done' : '');
        var marca = n < pos ? CHECK_SVG : String(n + 1);
        return '<li class="sim-rail-item' + cls + '"><span class="sim-rail-mark">' + marca + '</span>' +
          '<span>' + esc(PASSOS[idx].rotulo) + '</span></li>';
      }).join('');
    }
    var fill = document.getElementById('sim-bar-fill');
    var label = document.getElementById('sim-bar-label');
    var pct = Math.round((pos / (vis.length - 1)) * 100);
    if (fill) fill.style.width = pct + '%';
    if (label) {
      // só o nome da etapa: a fração ("Passo 2 de 5") já está dentro do cartão,
      // e a barra mostra o quanto falta sem precisar de número.
      label.textContent = PASSOS[s.passo].rotulo;
    }
  }

  /* ─── eventos ──────────────────────────────────────────────────────────── */

  function setCampo(campo, bruto) {
    var v = bruto;
    if (bruto === 'true') v = true;
    else if (bruto === 'false') v = false;
    else if (campo === 'socios') v = Number(bruto);

    if (campo === 'regime' && s.regime !== v) {
      // trocar de regime invalida o que dependia dele
      s.regime = v;
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
      if (v === false) { s.filaCidade = false; }  // escolher o fiscal desfaz a fila
      return;
    }
    if (campo === 'faixa') {
      // tocar numa faixa desfaz o valor digitado: senão o número continuaria
      // mandando e a seleção visual mentiria
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

  // Sobe pro topo do simulador ao trocar de passo. Usa a posição REAL do nó
  // (getBoundingClientRect + scrollY): embutido na home ele não é filho direto
  // do body, então offsetTop mediria só o deslocamento dentro do pai.
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
      // atalhos de saída: quem entrou numa fila vai direto pro veredito
      if ((s.categoria === FORA_LISTA) || s.filaCidade) { s.passo = iRESULTADO; }
      else { s.passo = proximoPasso(s.passo); }
      irParaOSimulador();
      render(true);
    } else if (acao === 'voltar') {
      s.passo = passoAnterior(s.passo);
      render(true);
    } else if (acao === 'trocar-me') {
      s.regime = 'me'; s.enderecoProprio = null;
      s.meiOutraEmpresa = null; s.meiServidor = null;
      // 🔴 o MEI não tem gate de cidade e o ME tem: quem troca de regime LÁ NA
      // FRENTE (no gate de teto do faturamento) precisa refazer o endereço,
      // senão passaria batido com um CEP que o ME não aceita.
      var iLocal = 2;
      if (s.passo > iLocal) { s.passo = iLocal; render(true); }
      else { render(); }
      return;
    } else if (acao === 'usar-fiscal') {
      s.enderecoProprio = false;
      // o passo do imóvel deixa de existir com o endereço fiscal: quem clicou
      // DENTRO dele ficaria numa tela órfã, então segue pro próximo aplicável.
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
      // trava por CLAMP no teto do ME, não por rejeição: um campo que ignora a
      // tecla em silêncio faz a pessoa achar que travou
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
