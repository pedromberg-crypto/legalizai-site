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

  // A grade termina EXATAMENTE no teto do regime. "Não sei ainda" cobre 0–30k
  // nas DUAS grades de propósito: o gate do MEI precisa ler "incerto", nunca
  // "seguro" — é o que faz o aviso do teto aparecer pra quem não sabe.
  var FAIXAS_ME = [
    { id: 'nao-sei', label: 'Não sei ainda', min: 0,     max: 30000, desconhecida: true },
    { id: '5-10k',   label: 'R$ 5 a 10 mil', min: 5000,  max: 10000 },
    { id: '10-20k',  label: 'R$ 10 a 20 mil', min: 10000, max: 20000 },
    { id: '20-30k',  label: 'R$ 20 a 30 mil', min: 20000, max: 30000 }
  ];

  // 🔴 Grade do MEI: mostrar 5–30 mil pra quem escolheu MEI era oferecer 3
  // faixas que estouram o teto dele. Aqui a escala é a do regime — começa
  // baixo e termina em R$6.750, o teto legal. Quem fatura acima disso digita o
  // valor exato, e aí o gate de teto dispara (ver `estoura` em telaFaixa).
  var FAIXAS_MEI = [
    { id: 'nao-sei',   label: 'Não sei ainda',   min: 0,    max: 30000, desconhecida: true },
    { id: 'ate-2k',    label: 'Até R$ 2 mil',    min: 0,    max: 2000 },
    { id: '2-4k',      label: 'R$ 2 a 4 mil',    min: 2000, max: 4000 },
    { id: '4-teto',    label: 'R$ 4 a 6.750',     min: 4000, max: TETO_MEI_MENSAL }
  ];

  // a grade certa pro regime escolhido. Trocar de regime zera a faixa marcada
  // (os ids não se correspondem) — ver `setCampo`.
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
  function ehMei() { return s.regime === 'mei'; }
  function linkWhats(msg) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg);
  }

  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5L20 7"/></svg>';
  var BANG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M12 6v8M12 18v.01"/></svg>';
  var INFO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" d="M12 10v8M12 6v.01"/></svg>';
  /* mesmo desenho dos checks (viewBox 24, traço, currentColor), símbolo de
     alerta: triângulo com "!". A cor vem do CSS, em danger. */
  var ALERTA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" d="M12 4.2 2.6 20h18.8L12 4.2Z"/><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 10.2v4.1M12 17.4v.01"/></svg>';
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
  // `travado` = o campo existe na tela mas ainda não é a vez dele: fica cinza e
  // sem interação, em vez de sumir. Some, a tela salta de altura e a pessoa
  // perde a noção de quantos campos faltam; travado, a ordem fica visível.
  function select(campo, valor, opcoes, placeholder, travado) {
    return '<select class="sim-select" data-change="' + campo + '"' + (travado ? ' disabled' : '') + '>' +
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

  // Cartão de comparação: ícone, nome e a lista do regime DENTRO do próprio
  // alvo de escolha. O botão inteiro é clicável, então a área de toque cresce
  // com a informação em vez de disputar com ela.
  function cardRegime(valor, base, selecionado) {
    var d = REGIME_CHECKS[valor];
    return '<button type="button" class="sim-card sim-card--compara" aria-pressed="' + (selecionado ? 'true' : 'false') + '"' +
      ' data-set="regime" data-valor="' + valor + '">' +
      '<span class="sim-card-check">' + CHECK_SVG + '</span>' +
      '<span class="sim-card-topo">' +
        '<img src="/atendimento/icones/' + base + (selecionado ? '-creme' : '-coral') + '.png" alt="" aria-hidden="true">' +
        '<span class="sim-card-nome">' + esc(d.nome) + '</span>' +
      '</span>' +
      '<span class="sim-checks">' + d.checks.map(function (t) {
        return '<span class="sim-checks-item">' + CHECK_SVG + '<span>' + esc(t) + '</span></span>';
      }).join('') + '</span>' +
      '</button>';
  }

  function telaRegime() {
    var r = s.regime;
    // 🔄 Antes: dois cartões só com o nome, e a lista do escolhido aparecendo
    // NUM PAINEL ABAIXO. Isso dava (a) meia tela vazia antes da escolha,
    // (b) salto de altura no clique e (c) comparação impossível — pra ver o
    // outro lado a pessoa tinha que trocar a resposta. Agora as duas listas
    // ficam lado a lado o tempo todo, e escolher só marca qual é o seu.
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

    // A dica só serve pra quem ainda não escolheu. Depois da escolha ela vira
    // ~34px de texto morto, e no galho "fora da lista" é justamente a altura
    // que faltava pra tela caber sem rolar.
    var corpo =
      // largura inteira, menos no galho "fora da lista": lá ele divide a linha
      // com a pergunta da atividade regulamentada.
      '<div class="sim-field' + (foraLista ? '' : ' sim-full') + '">' +
        '<label class="sim-field-label" for="sim-cat">O que você faz?</label>' +
        (cat ? '' : '<p class="sim-field-hint">Escolha o que mais se parece. O código certo a gente encontra depois.</p>') +
        select('categoria', cat, opcoes, 'Escolha uma categoria') +
      '</div>';

    // Enquanto nenhum galho abriu, o cartão explica o que a lista é (e o que
    // ela não é), na linha de baixo em largura inteira. Quando um galho abre,
    // ele sai: o espaço passa a ser do que a resposta destravou.
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

    // 🔴 A porta fechada que vira porta aberta. Só existe no MEI. O botão que
    // destrava saiu de dentro do corpo e virou o CTA do rodapé (ver `acaoCta`):
    // era o único caminho da tela, e como botão solto competia com o CTA morto
    // logo abaixo dele.
    if (semMei) {
      // aviso e saída em largura inteira, um embaixo do outro: em meia coluna
      // cada um o texto quebrava em 6 linhas e a frase que abre a porta ficava
      // ao LADO do "não", disputando a leitura com ele.
      corpo += '<div class="sim-full">' + nota('info', 'Essa atividade não pode ser MEI',
        'A lei não considera empresário quem exerce profissão intelectual (art. 966 do Código Civil), então tecnologia, design e consultoria não entram na lista do MEI. Não é escolha nossa, e não tem exceção.') + '</div>' +
        '<p class="sim-note-text sim-full">A boa notícia: a gente atende essa atividade como <strong>ME no Simples Nacional</strong>, que é o caminho certo pro seu caso.</p>';
    }

    // Fora da lista: pede a atividade regulamentada de verdade + a cidade.
    // Atividade e CEP dividem uma linha: são os dois campos que a fila precisa,
    // e cada um sozinho deixaria meia linha vazia.
    // 🔧 Empilhado (pergunta, atividade+CEP, campo livre, nota) esse galho
    // rolava: 4 blocos em 4 linhas. Agora ele é uma malha 2x2 — a atividade
    // sobe pra linha da categoria, e o campo livre divide a linha do CEP em
    // vez de gastar uma inteira sozinho.
    if (foraLista) {
      // 🔒 Ordem de preenchimento visível: os 4 campos nascem juntos, mas só o
      // da vez aceita toque. Cada resposta destrava o seguinte, e nada muda de
      // lugar no caminho — o layout fica parado, só a cor anda.
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
      // sem linha de dica: o título já pergunta onde a empresa vai ficar, e os
      // dois cartões dizem as duas respostas possíveis.
      corpo += '<div class="sim-q">' +
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
      // 🔄 sem o wrapper .sim-q: como bloco único, estes campos não tinham com
      // quem parear no grid de 2 colunas e a tela ficava tão alta quanto antes.
      // 🔄 CEP, número e complemento numa LINHA só (.sim-trio). Antes o CEP
      // ficava sozinho de um lado, o cartão da cidade do outro e o par
      // número/complemento numa terceira faixa: três alturas pra três campos
      // que são o mesmo endereço. Número e complemento só entram depois que o
      // CEP resolve, senão a linha nasceria com dois campos mortos.
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
            '<p class="sim-inline-text">Mas isso não te trava: clica em <strong>“Quero um endereço da Legalizai”</strong> aqui em cima, e a empresa nasce em BH do mesmo jeito.</p>' +
            '<button type="button" class="sim-inline-link" data-acao="fila-cidade">Quero abrir na minha cidade mesmo assim</button></div>';
        }
      } else if (cepOk && s.cepInfo) {
        if (s.cepInfo.logradouro || s.cepInfo.municipio) {
          corpo += '<div class="sim-endereco">' +
            (s.cepInfo.logradouro ? '<p class="sim-endereco-rua">' + esc(s.cepInfo.logradouro) + (s.cepInfo.bairro ? ', ' + esc(s.cepInfo.bairro) : '') + '</p>' : '') +
            '<p class="sim-endereco-cidade">' + esc(s.cepInfo.municipio || 'Belo Horizonte') + ' · ' + esc(s.cepInfo.uf || 'MG') + '</p></div>';
        }
        // 🔄 o bloco do imóvel (casa/apto + mora nele + regra da PBH) saiu daqui
        // e virou o passo próprio `telaImovel`. Ver o comentário em PASSOS.
      }

      if (mei && cepOk) {
        // largura inteira: é o fechamento da tela, não um comentário lateral.
        corpo += '<div class="sim-full">' + nota('info', 'Pode ser o seu endereço de casa',
          'No MEI não existe consulta prévia de viabilidade, e em BH o alvará é dispensado pras atividades de baixo risco. Você declara o endereço e assume o compromisso de seguir as regras do município.') + '</div>';
      }
      // (sem fechar wrapper: os campos acima são irmãos diretos do corpo)
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

    /* 🔄 DUAS COLUNAS: as perguntas à esquerda, a regra que as justifica à
       direita. Antes a regra da Prefeitura só aparecia DEPOIS de a pessoa cair
       nela (apartamento + não mora), como aviso de erro. Ela é o motivo da
       tela existir, então agora está na tela desde o começo, como informação,
       e o vão da direita deixa de ser vazio. */
    // 🔴 A saída honesta. No app ela morava no C4, pós-pagamento, e lá o campo
    // era travado em "Sim" — quem tinha apartamento onde não mora ficava sem
    // caminho depois de já ter pago. A regra já está explicada no cartão da
    // direita, então aqui fica só o que ela significa PRA ESTE caso; a saída
    // virou o próprio CTA do rodapé (ver `acaoCta` no retorno).
    var veredito = '';
    if (apeSemResidencia) {
      veredito = nota('warn', 'Esse apartamento não serve como sede',
        'Sem sócio morando nele, a Prefeitura indefere. Use outro endereço seu, ou o da Legalizai.');
    } else if (s.tipoImovel !== '' && s.reside !== null) {
      veredito = nota('ok', '', 'Endereço aprovado pela regra da Prefeitura. É esse que vai no seu CNPJ.');
    }

    // As duas perguntas dividem UMA linha: são curtas, e juntas ocupam a
    // largura toda sem sobrar vão. A segunda só nasce depois da primeira.
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

    // o cartão da regra fecha a tela, colado no CTA: é o que a pessoa lê
    // logo antes de decidir.
    corpo += '<div class="sim-regra">' +
      '<p class="sim-regra-titulo">Por que a gente pergunta</p>' +
      '<ul class="sim-checks">' +
        [
          'Casa, sala, loja ou galpão: a Prefeitura aceita direto',
          'Apartamento só é aceito se um dos sócios morar nele',
          'Se não for o seu caso, o endereço da Legalizai resolve por ' + brl(ENDERECO_FISCAL) + '/mês'
        ].map(function (t) { return '<li>' + CHECK_SVG + '<span>' + esc(t) + '</span></li>'; }).join('') +
      '</ul></div>';

    // O CTA é a única saída da tela, então ele MUDA com a resposta em vez de
    // ficar morto: no apê sem residência ele vira o endereço fiscal (que é o
    // que de fato destrava), e volta a ser "Continuar" assim que a pessoa
    // troca pra uma combinação que a Prefeitura aceita.
    return {
      meta: meta(),
      titulo: 'Sobre o imóvel',
      sub: 'Melhor descobrir agora, não depois de pagar.',
      corpo: corpo,
      cta: apeSemResidencia ? 'Usar o endereço da Legalizai' : 'Continuar',
      acaoCta: apeSemResidencia ? 'usar-fiscal' : 'avancar',
      pronto: apeSemResidencia || (s.tipoImovel !== '' && s.reside !== null)
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
      corpo += '<div class="sim-full">' + nota('ok', '', 'É o mais comum entre os prestadores de serviço. Se um dia você quiser ter sócio, dá pra incluir depois, já com a empresa em pé.') + '</div>';
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
        // 🔄 O ESCAPE ENTROU NO PAINEL, como 4ª célula da grade de checks, ao
        // lado do 3º item. E deixou de ser link: virou botão cinza claro, pra
        // separar na cara o que é INFORMAÇÃO (os 3 checks com visto verde) do
        // que é AÇÃO. Antes ele era um link solto embaixo do painel e lia como
        // mais uma frase.
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

      // 🔄 ORDEM DA TELA (pedido do Pedro): quantidade → Vale saber →
      // administração → recado verde, e cada bloco ocupando a linha inteira.
      // O recado desceu pra logo acima do CTA porque é ele que muda o que o
      // botão faz ("Falar com o time" em vez de "Continuar"): ler a mensagem e
      // apertar o botão viraram vizinhos.
      // 🔄 a consequência da escolha SUBIU pro subtítulo, no lugar da explicação
      // genérica: eram duas linhas dizendo coisas da mesma pergunta, uma acima
      // e outra abaixo dos botões. Agora é uma linha só, que troca de conteúdo
      // conforme a resposta. Copy cortada pra caber em 1 linha na largura do
      // cartão.
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

    // 🔄 a coorte ("é a primeira empresa?") SAIU desta tela e foi pro veredito.
    // Ela não é gate — é dado de marketing (o app já a realocou 3 vezes) — e
    // aqui era o 4º bloco independente da mesma tela, valendo ~200px de
    // rolagem interna. No resultado a pessoa já teve a resposta dela, então
    // responder não custa atenção nenhuma.
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
      // sem subtítulo: "rápido, só o essencial" repetia o título e custava
      // ~20px na tela mais cheia do wizard.
      sub: '',
      corpo: corpo,
      cta: 'Continuar',
      pronto: completo
    };
  }

  // M-T · impedimentos do MEI (ocupa o lugar da triagem de sócios no ramo MEI).
  function telaImpedimentosMei() {
    // 🔄 As duas perguntas eram empilhadas, cada uma numa linha inteira, com o
    // aviso de cada uma no meio: a tela crescia em degraus e sobrava vão à
    // direita. Como são a MESMA pergunta feita duas vezes (Não/Sim), dividem a
    // linha; os avisos e o veredito descem inteiros.
    var corpo = '<div class="sim-duo">' +
      '<div class="sim-q"><p class="sim-q-label">Você já é sócio ou dono de outra empresa?</p>' +
        '<p class="sim-q-hint">Quem já tem CNPJ não pode abrir MEI. É impedimento da lei, não regra nossa.</p>' +
        botoesLinha('meiOutraEmpresa', [{ v: 'false', label: 'Não' }, { v: 'true', label: 'Sim' }],
          s.meiOutraEmpresa === null ? '' : String(s.meiOutraEmpresa)) + '</div>' +
      '<div class="sim-q"><p class="sim-q-label">Você é servidor público federal na ativa?</p>' +
        '<p class="sim-q-hint">A lei proíbe servidor federal de ser MEI. Estadual e municipal depende do estatuto.</p>' +
        botoesLinha('meiServidor', [{ v: 'false', label: 'Não' }, { v: 'true', label: 'Sim' }],
          s.meiServidor === null ? '' : String(s.meiServidor)) + '</div>' +
      '</div>';

    if (s.meiOutraEmpresa === true) {
      corpo += '<div class="sim-full">' + nota('warn', 'Com outra empresa no seu nome, o MEI não serve',
        'Se o que você quer é trazer pra Legalizai a empresa que já existe, isso a gente atende.') + '</div>';
    }

    if (s.meiServidor === true) {
      corpo += '<div class="sim-full">' + nota('warn', 'Servidor federal não pode ser MEI',
        'Nesse caso o caminho passa por uma conversa com o contador antes de abrir qualquer coisa. A gente te ajuda a achar a saída certa.') + '</div>';
    }

    // Responder "Não" duas vezes não devolvia nada: a tela ficava igual à de
    // antes de responder. O veredito fecha o passo e ocupa a área livre.
    if (s.meiOutraEmpresa === false && s.meiServidor === false) {
      corpo += '<div class="sim-full">' + nota('ok', 'Nenhum dos dois impedimentos te pega',
        'Pela lei, você pode ser MEI. Falta só conferir o faturamento.') + '</div>';
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

    /* 🔄 A TELA VIROU DUAS COLUNAS, e o "Sei o valor exato" deixou de ser um
       link escondido embaixo da grade.

       Esquerda: as 4 faixas em 2×2, do jeito que sempre foram (a resposta
       rápida, que é o caminho da maioria).
       Direita: o campo do valor exato, sempre visível, dentro do próprio
       cartão. Quem já sabe o número não precisa descobrir que existe um link
       pra digitá-lo, e quem não sabe continua tocando numa faixa.

       Os dois caminhos conversam: digitar acende a faixa correspondente na
       grade, tocar numa faixa limpa o campo. Isso já era assim, só estava
       escondido atrás do link. */
    var corpo = '<div class="sim-cards is-metade">' + faixas().map(function (fx, i) {
      return cardIcone(fx.id, 'faixa', fx.label, 'faixa-' + (i + 1), selecionada === fx.id);
    }).join('') + '</div>';

    corpo += '<div class="sim-valor">' +
      '<p class="sim-valor-titulo">Ou informe o valor exato</p>' +
      '<div class="sim-input-prefix"><span>R$</span>' +
      '<input class="sim-input" id="sim-exato" data-input="exato" inputmode="numeric" value="' + esc(s.exato) + '" placeholder="0"></div>' +
      (v > 0 && f
        ? '<p class="sim-valor-eco">Isso é a faixa <strong>' + esc(f.label) + '</strong>.</p>'
        : '<p class="sim-valor-eco is-vazio">A faixa acende sozinha aqui do lado.</p>') +
      (v >= TETO_ME_MENSAL
        ? '<p class="sim-valor-nota">Teto do ME: ' + brl(TETO_ME_MENSAL) + ' por mês. Acima disso a empresa vira EPP, e aí a gente conversa antes de abrir.</p>'
        : '') +
      '</div>';

    if (estoura) {
      // o parágrafo solto virou a última frase do próprio aviso: eram duas
      // caixas em sequência dizendo a mesma coisa, e juntas custavam ~70px.
      // O botão que destrava saiu daqui e virou o CTA do rodapé (`acaoCta`):
      // como botão solto ele competia com um "Ver o resultado" morto logo
      // abaixo, e a saída da tela ficava no meio dela.
      corpo += '<div class="sim-full">' + nota('info', 'Com esse faturamento, o MEI não serve',
        'O teto é ' + brl(TETO_MEI_MENSAL) + ' por mês (' + brl(TETO_MEI_ANUAL) + ' no ano). Passar disso não impede ter empresa: só diz que o seu caso é ME. E melhor agora, porque quem estoura depois de aberto paga a diferença, com juros e multa acima de 20%.') + '</div>';
    } else if (incerto) {
      corpo += '<div class="sim-full">' + nota('warn', 'Fica de olho no teto do MEI',
        'O limite do MEI é ' + brl(TETO_MEI_MENSAL) + ' por mês (' + brl(TETO_MEI_ANUAL) + ' no ano), e ele cai dentro dessa faixa. Se quiser ter certeza agora, informa o valor exato aqui em cima.') + '</div>';
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
      // o resumo logo abaixo já lista regime, sede e faturamento: repetir em
      // prosa custava 2 linhas na tela mais alta do wizard.
      texto: ehMei()
        ? 'Seu MEI entra no que a Legalizai abre hoje. O próximo passo é no app: a abertura sai da sua mão e vem pra nossa.'
        : 'Sua ME entra no que a Legalizai abre hoje. O próximo passo é no app: a abertura sai da sua mão e vem pra nossa.',
      // embutido na home o #baixar está na própria página; na página
      // standalone precisa do caminho completo, senão a âncora não existe
      cta: { label: 'Baixar o app e começar', href: document.getElementById('baixar') ? '#baixar' : '/home#baixar' }
    };
  }

  function telaResultado() {
    var v = calcularVeredito();
    /* 🔄 O SÍMBOLO DA MARCA no lugar do check verde genérico (pedido do Pedro):
       quando a resposta é sim, quem assina o veredito é a Legalizai. É o mesmo
       SVG que já vive no header, no rodapé e no CTA final da página, inline e
       não como arquivo: o desenho é o mesmo do `Legalizai-Logo.png`, mas em
       vetor ele fica nítido em qualquer tamanho e não vira mais um asset pra
       versionar. A classe `is-marca` tira o círculo de fundo (o símbolo já tem
       o próprio quadrado coral). */
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
      // fora da lista não passa pelo gate de endereço, mas o CEP foi pedido
      // ali mesmo pra saber a cidade da fila — então ela entra no resumo.
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
      // ícone e título na MESMA linha (.sim-selo-topo); a frase desce inteira
      // por baixo dos dois, usando a largura toda da coluna.
      '<div class="sim-selo sim-selo--' + v.tipo + (v.tipo === 'ok' ? '' : ' is-larga') + '">' +
        '<div class="sim-selo-topo">' +
          '<span class="sim-selo-icon' + (v.tipo === 'ok' ? ' is-marca' : '') + '">' + icone + '</span>' +
          '<h2>' + v.titulo + '</h2>' +
        '</div>' +
        '<p>' + v.texto + '</p>' +
      '</div>' +
      // 🔄 a nota virou o RODAPÉ do próprio cartão de resumo, não um cartão
      // vizinho: ela fala sobre o que está listado logo acima (o enquadramento
      // ainda vai ser confirmado pelo contador), então pertence ao mesmo
      // objeto. Dois cartões lado a lado sugeriam dois assuntos.
      '<div class="sim-resumo">' + linhas.map(function (l) {
        return '<div class="sim-resumo-row"><span class="sim-resumo-k">' + esc(l[0]) + '</span><span class="sim-resumo-v">' + esc(l[1]) + '</span></div>';
      }).join('') +
      '<div class="sim-resumo-nota">' +
        (v.tipo === 'ok'
          ? '<span class="sim-resumo-nota-ico">' + CHECK_SVG + '</span><span>Triagem, não contrato: quem confirma o CNAE é o contador, no app, antes de qualquer cobrança.</span>'
          : '<span class="sim-resumo-nota-ico is-info">' + INFO_SVG + '</span><span>Simulação com as regras de hoje. Elas mudam quando a gente expande.</span>') +
      '</div></div>' +
      // 🔄 a coorte mora AQUI desde que saiu da triagem: dado de marketing,
      // nunca gate. Cartões com o ícone 3D (as pranchetas), e eles FICAM na
      // tela depois de respondidos: antes a resposta trocava os cartões por uma
      // linha de recibo, e aí não sobrava no que clicar pra desmarcar. Tocar no
      // cartão marcado desfaz a escolha (ver `setCampo`).
      (v.tipo === 'ok'
        ? '<div class="sim-q"><p class="sim-q-label">É a primeira empresa que você abre? ' +
          '<span class="sim-q-label-soft">Não muda o resultado. Toque de novo pra desmarcar.</span></p>' +
          '<div class="sim-cards sim-cards--regua sim-cards--coorte">' +
            cardIcone('primeira', 'coorte', 'É a primeira', 'coorte-primeira', s.coorte === 'primeira') +
            cardIcone('ja-abri', 'coorte', 'Já abri antes', 'coorte-ja-abri', s.coorte === 'ja-abri') +
          '</div></div>'
        : '');

    // "Refazer" saiu de baixo do CTA e virou ação de navegação, no topo: ela
    // desfaz o caminho, é irmã do "Voltar", e embaixo competia com o botão que
    // a tela existe pra empurrar.
    // 🔄 o CTA saiu do corpo e foi pro RODAPÉ FIXO do cartão, largura inteira,
    // igual ao "Continuar" das telas de pergunta. Assim o botão que fecha a
    // simulação mora no mesmo lugar em que a pessoa apertou botão seis vezes
    // seguidas, em vez de flutuar no meio do conteúdo.
    return { meta: 'Resultado', titulo: '', sub: '', corpo: corpo,
             cta: v.cta.label, ctaHref: v.cta.href, pronto: true,
             topoAcao: { label: 'Refazer', acao: 'refazer' } };
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
        // veredito: o CTA é link (loja, WhatsApp, âncora da página), não ação
        // do wizard, mas ocupa o mesmo lugar e tem o mesmo peso visual.
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
        return '<li class="sim-rail-item' + cls + '">' +
          '<span class="sim-rail-mark">' + marca + '</span>' +
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
      if (v === false) { s.filaCidade = false; }  // escolher o fiscal desfaz a fila
      return;
    }
    // 🐛 a coorte não tinha como ser desfeita: uma vez marcada, a pessoa ficava
    // presa na resposta. Como ela é opcional (dado de marketing, não gate),
    // tocar no cartão já marcado desmarca.
    if (campo === 'coorte') {
      s.coorte = (s.coorte === v) ? null : v;
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
      // a faixa marcada era da grade do MEI: some. O valor exato fica — ele é
      // um número, vale igual nas duas grades, e é justamente o que trouxe a
      // pessoa até aqui.
      s.regime = 'me'; s.faixa = null; s.enderecoProprio = null;
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
