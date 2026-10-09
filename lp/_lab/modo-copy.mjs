#!/usr/bin/env node
/**
 * COPY DO SITE — DOIS EIXOS INDEPENDENTES
 * ---------------------------------------------------------------------------
 *   node lp/_lab/modo-copy.mjs                 → diz em que estado o site está
 *   node lp/_lab/modo-copy.mjs preco 99        → 1ª leva (R$ 79) ⇄ 2ª leva (R$ 99)
 *   node lp/_lab/modo-copy.mjs loja app        → fila de espera ⇄ app publicado
 *
 * POR QUE DOIS EIXOS, e não os dois modos de antes:
 * A versão anterior tinha um interruptor só, `espera` × `app`, e o preço vinha
 * de carona: `espera` era R$ 79 + badge "Em breve na App Store", `app` era
 * R$ 99 + badge "Baixar na App Store". Enquanto a 1ª leva durou, os dois
 * andavam juntos e ninguém sentiu.
 *
 * Em 15/09/2026 a 1ª leva fechou e o preço precisou subir pra R$ 99 com a fila
 * de espera CONTINUANDO aberta — o app não está publicado. Nesse desenho antigo
 * não havia comando pra isso: rodar `app` pelo preço publicaria badge dizendo
 * "Baixar" num app que não existe, que é promessa falsa, e é exatamente o tipo
 * de coisa que só aparece depois de no ar.
 *
 * Então o que era um interruptor virou dois, que não se falam:
 *
 *   EIXO `preco`  ·  `data-preco` no <html>  ·  79 | 99
 *     Quanto custa o plano ME nos 3 primeiros meses. O MEI NÃO entra aqui:
 *     segue R$ 29 em qualquer combinação (16/09: era R$ 19).
 *
 *   EIXO `loja`   ·  `data-modo` no <html>   ·  espera | app
 *     Se o app já pode ser baixado. Manda nos badges das lojas, nos CTAs e no
 *     destino dos cliques. O nome do atributo continua `data-modo` porque o
 *     CSS depende dele (`.so-app` / `.so-espera`, ver styles.css).
 *
 *   As 4 combinações são válidas. A de hoje é preco=99 + loja=espera.
 *
 * A divisão de trabalho continua a mesma:
 *   · o que é BLOCO INTEIRO (badges das lojas × botão da fila) troca no CSS,
 *     pelas classes `.so-app` e `.so-espera`, guiadas pelo `data-modo`;
 *   · o que é FRASE ou HREF troca aqui, pelas tabelas de cada eixo.
 *
 * REGRA DURA: toda troca é um par exato. Se uma frase não for encontrada em
 * NENHUM dos dois lados, o script FALHA e não grava nada. É de propósito: a
 * página muda toda semana, e troca que falha em silêncio deixa o site meio
 * num estado e meio no outro, que é pior que não trocar.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ALVO = resolve(AQUI, 'index.html');

/**
 * Cada item é o MESMO ponto da página nos dois valores do eixo.
 * `nome` só aparece no relatório, pra você saber o que mudou.
 */
const EIXOS = {
  /* ══════════════════════════════════════════════════════════════════════
     EIXO PREÇO — quanto custa o ME nos 3 primeiros meses
     ══════════════════════════════════════════════════════════════════════
     ⚠️ São 7 lugares e eles TÊM que andar juntos: a etiqueta do hero, o preço
     grande do cartão, a linha da mensalidade dentro da conta, o TOTAL da
     conta, a resposta do FAQ, o espelho dela no JSON-LD e a meta description.
     Errar um deixa a página se contradizendo sozinha. */
  preco: {
    attr: 'data-preco',
    valores: ['79', '99'],
    rotulos: { 79: '1ª leva · R$ 79 (coorte fundador)', 99: '2ª leva · R$ 99' },
    trocas: [
      {
        // Só o NÚMERO. A frase que vem antes ("Lista de espera aberta:" ou
        // "Oferta de lançamento:") é do eixo `loja` e troca separado — era
        // justamente a colagem dos dois que impedia R$ 99 + fila de espera.
        nome: 'Etiqueta acima do título (hero) · só o preço',
        79: ' 79/mês nos 3 primeiros meses',
        99: ' 99/mês nos 3 primeiros meses',
      },
      {
        nome: 'Preço em destaque do cartão ME',
        79: '<p class="plano-preco"><strong>R$ 79</strong>',
        99: '<p class="plano-preco"><strong>R$ 99</strong>',
      },
      {
        nome: 'Linha da mensalidade em "A conta da abertura" (ME)',
        79: '<em>R$ 79<i>/mês</i></em>',
        99: '<em>R$ 99<i>/mês</i></em>',
      },
      {
        // mensalidade + 281,08 da Junta. Refazer a soma toda vez que o preço mudar.
        nome: 'Total de hoje do cartão ME',
        79: '<strong>R$ 360,08</strong>',
        99: '<strong>R$ 380,08</strong>',
      },
      {
        // pega o FAQ visível E o espelho dele no JSON-LD, que o Google exige
        // idêntico ao texto da tela
        nome: 'FAQ "Quanto custa?" + espelho no JSON-LD',
        79: 'R$ 79 no ME</strong> e <strong>R$ 29 no MEI',
        99: 'R$ 99 no ME</strong> e <strong>R$ 29 no MEI',
      },
      {
        nome: 'FAQ no JSON-LD (texto puro)',
        79: 'R$ 79 no ME e R$ 29 no MEI',
        99: 'R$ 99 no ME e R$ 29 no MEI',
      },
      {
        nome: 'Meta description (aparece no Google e no link compartilhado)',
        79: 'R$ 49/mês no MEI e R$ 79/mês no ME.',
        99: 'R$ 49/mês no MEI e R$ 99/mês no ME.',
      },
    ],
  },

  /* ══════════════════════════════════════════════════════════════════════
     EIXO LOJA — o app já pode ser baixado?
     ══════════════════════════════════════════════════════════════════════ */
  loja: {
    attr: 'data-modo',
    valores: ['espera', 'app'],
    rotulos: { espera: 'fila de espera (app não publicado)', app: 'app publicado' },
    trocas: [
      {
        nome: 'CTA do topo',
        espera: '<a class="header-cta" href="/em-breve">\n      Entrar na lista',
        app: '<a class="header-cta" href="#rodape">\n      Baixar o app',
      },
      {
        // A abertura da etiqueta e o destino do clique. O preço que vem logo
        // depois é do eixo `preco`: por isso este par termina no "R$".
        nome: 'Etiqueta acima do título (hero) · abertura + destino',
        espera: '<a class="hero-eyebrow reveal" href="/em-breve">\n      Lista de espera aberta: R$',
        app: '<a class="hero-eyebrow reveal" href="#rodape">\n      Oferta de lançamento: R$',
      },
      {
        // 2 ocorrências: hero e rodapé. A troca é global de propósito: badge que
        // diz "Baixar" num app que não existe é promessa falsa, e é o tipo de
        // coisa que passa despercebida se a troca for só no hero.
        nome: 'Badge · linha de cima da App Store (hero + rodapé)',
        espera: '<small>Em breve na</small><strong>App Store</strong>',
        app: '<small>Baixar na</small><strong>App Store</strong>',
      },
      {
        nome: 'Badge · linha de cima do Google Play (hero + rodapé)',
        espera: '<small>Em breve no</small><strong>Google Play</strong>',
        app: '<small>Disponível no</small><strong>Google Play</strong>',
      },
      {
        // 4 ocorrências, todas trocadas juntas. Enquanto não há app, clicar num
        // badge tem que levar pra fila, não pro rodapé.
        nome: 'Badge · destino do clique (4 badges)',
        espera: '<a class="store-badge store-badge-light" href="/em-breve">',
        app: '<a class="store-badge store-badge-light" href="#rodape">',
      },
      {
        nome: 'CTA depois do passo a passo',
        espera: '<a class="btn btn-primary" href="/em-breve">Quero entrar na lista</a>',
        app: '<a class="btn btn-primary" href="#rodape">Começar pelo passo 1</a>',
      },
      // ✂️ 09/10: saiu o par 'FAQ · "antes de baixar"'. A frase era o convite
      // pro validador, e o validador saiu da home (simulador de abertura, ver
      // a nota no index.html). A resposta nova do FAQ vale nos dois modos.
      {
        // 2 ocorrências: botão do cartão ME e o da dobra "crescer". Antes
        // levavam ao validador ("Ver se a gente atende você").
        nome: 'Botão do cartão ME + dobra "crescer"',
        espera: '<a class="btn btn-primary" href="/em-breve">Garantir minha condição</a>',
        app: '<a class="btn btn-primary" href="#rodape">Baixar o app</a>',
      },
      {
        // era "Ver se eu sou MEI", que levava ao validador
        nome: 'Botão do cartão MEI',
        espera: '<a class="btn plano-btn-2" href="/em-breve">Garantir minha condição</a>',
        app: '<a class="btn plano-btn-2" href="#rodape">Baixar o app</a>',
      },
      {
        nome: 'Comentário de rastreio no topo do arquivo',
        espera: '<!-- modo: lançamento, lista de espera aberta -->',
        app: '<!-- modo: app publicado -->',
      },
    ],
  },
};

/**
 * O arquivo é CRLF e as frases aqui são escritas com \n. Comparar literal
 * falharia em toda troca de mais de uma linha, e falharia em SILÊNCIO na
 * metade que não tem quebra. Então toda comparação passa por aqui: o \n do
 * padrão vira "\r?\n", e a quebra que o arquivo já usa é preservada na
 * gravação. Nenhuma linha do HTML muda de final por causa deste script.
 */
const comoRegex = (txt) =>
  new RegExp(txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n'), 'g');
const contem = (txt, alvo) => comoRegex(alvo).test(txt);
const trocar = (txt, alvo, novo) => {
  const quebra = txt.includes('\r\n') ? '\r\n' : '\n';
  return txt.replace(comoRegex(alvo), novo.split('\n').join(quebra));
};

/* o estado de cada eixo é o que está escrito no <html>, não um palpite */
const marcadorDe = (attr) =>
  new RegExp(`<html([^>]*?)\\s${attr}="([^"]*)"`);

function lerEstado(html, nomeEixo) {
  const eixo = EIXOS[nomeEixo];
  const achado = html.match(marcadorDe(eixo.attr));
  if (!achado) {
    console.error(`✗ O <html> não tem ${eixo.attr}. Coloque ${eixo.attr}="${eixo.valores[0]}" nele antes de rodar.`);
    process.exit(1);
  }
  if (!eixo.valores.includes(achado[2])) {
    console.error(`✗ ${eixo.attr}="${achado[2]}" não é um valor do eixo "${nomeEixo}" (${eixo.valores.join(' | ')}).`);
    process.exit(1);
  }
  return achado[2];
}

let html = readFileSync(ALVO, 'utf8');

const nomesEixos = Object.keys(EIXOS);
const estado = Object.fromEntries(nomesEixos.map((n) => [n, lerEstado(html, n)]));

const [nomeEixo, alvoValor] = process.argv.slice(2);

/* ── sem argumento: só relata ──────────────────────────────────────────── */
if (!nomeEixo) {
  console.log('estado do site:\n');
  for (const n of nomesEixos) {
    console.log(`   ${n.padEnd(6)} = ${estado[n].padEnd(7)} ${EIXOS[n].rotulos[estado[n]]}`);
  }
  console.log('\npara trocar:');
  for (const n of nomesEixos) {
    for (const v of EIXOS[n].valores.filter((v) => v !== estado[n])) {
      console.log(`   node lp/_lab/modo-copy.mjs ${n} ${v}   → ${EIXOS[n].rotulos[v]}`);
    }
  }
  process.exit(0);
}

if (!EIXOS[nomeEixo]) {
  console.error(`✗ eixo inválido: "${nomeEixo}". Use: ${nomesEixos.join(' | ')}`);
  process.exit(1);
}
const eixo = EIXOS[nomeEixo];

if (!alvoValor) {
  console.error(`✗ falta o valor. Use: node lp/_lab/modo-copy.mjs ${nomeEixo} ${eixo.valores.join(' | ')}`);
  process.exit(1);
}
if (!eixo.valores.includes(alvoValor)) {
  console.error(`✗ valor inválido pro eixo "${nomeEixo}": "${alvoValor}". Use: ${eixo.valores.join(' | ')}`);
  process.exit(1);
}

const de = estado[nomeEixo];
const para = alvoValor;

if (para === de) {
  console.log(`nada a fazer, ${nomeEixo} já está em "${de}".`);
  process.exit(0);
}

/* ── confere TUDO antes de gravar QUALQUER coisa ───────────────────────── */
const faltando = eixo.trocas.filter((t) => !contem(html, t[de]) && !contem(html, t[para]));

if (faltando.length) {
  console.error(`✗ ${faltando.length} troca(s) do eixo "${nomeEixo}" não bateram com a página. Nada foi gravado.\n`);
  for (const t of faltando) {
    console.error(`   · ${t.nome}`);
    console.error(`     esperava encontrar: ${JSON.stringify(t[de].slice(0, 70))}`);
  }
  console.error('\n   A página mudou desde que a tabela foi escrita.');
  console.error(`   Atualize o par correspondente em EIXOS.${nomeEixo}.trocas e rode de novo.`);
  process.exit(1);
}

/* ── aplica ────────────────────────────────────────────────────────────── */
const feitas = [];
const jaEstavam = [];
for (const t of eixo.trocas) {
  if (contem(html, t[de])) {
    html = trocar(html, t[de], t[para]);
    feitas.push(t.nome);
  } else {
    jaEstavam.push(t.nome);
  }
}

html = html.replace(marcadorDe(eixo.attr), `<html$1 ${eixo.attr}="${para}"`);
writeFileSync(ALVO, html, 'utf8');

estado[nomeEixo] = para;

console.log(`✓ ${nomeEixo} = "${para}"  (era "${de}")  ·  ${eixo.rotulos[para]}\n`);
for (const n of feitas) console.log(`   trocado  · ${n}`);
for (const n of jaEstavam) console.log(`   já estava · ${n}`);
console.log('\n   estado completo agora:');
for (const n of nomesEixos) console.log(`     ${n.padEnd(6)} = ${estado[n]}`);
if (nomeEixo === 'loja') {
  console.log(`\n   Os blocos inteiros (badges das lojas × botão da fila) seguem o`);
  console.log(`   data-modo pelo CSS, com as classes .so-app e .so-espera.`);
}
console.log(`\n   Voltar:  node lp/_lab/modo-copy.mjs ${nomeEixo} ${de}`);
console.log(`   Publicar: node lp/build-lp.mjs`);
