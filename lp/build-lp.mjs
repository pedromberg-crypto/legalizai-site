/* ============================================================
   BUILD DA LP — lp/_lab (fonte)  →  lp/ (o que o Vercel serve)
   ============================================================

   COMO TRABALHAR
   --------------
   1. Você edita SEMPRE em `lp/_lab/`. Comentado, indentado, do jeito que dá
      pra ler daqui a seis meses. Nada aqui muda isso.
   2. Rode `node build-lp.mjs` quando quiser publicar.
   3. Commit + push. A Vercel serve `lp/`.

   O que o build faz, nessa ordem:
     · copia `_lab/` pra raiz de `lp/`
     · troca todo `/_lab/` por `/` (eram 99 caminhos — na mão, um só que
       escapasse viraria 404 silencioso em produção)
     · MINIFICA a saída: tira comentários, indentação e linhas em branco

   ⚠️ NÃO EDITE os arquivos gerados em `lp/` (index.html, styles.css,
   script.js, atendimento/, blog/, assets/). Eles são SAÍDA — o próximo build
   sobrescreve tudo. A fonte é `lp/_lab/`.

   Bandeiras:
     --raw    não minifica (saída idêntica ao fonte, só com o caminho trocado).
              Serve pra depurar um problema que só aparece em produção.

   REGRA DE SEGURANÇA DA MINIFICAÇÃO
   ---------------------------------
   Minificador quebrado é pior que arquivo grande. Então cada arquivo passa por
   duas travas antes de ser aceito:
     1. SINTAXE — o JS é parseado de verdade (vm.Script) e o CSS é reparseado
        pelo lightningcss. Se não parsear, o arquivo vai CRU e o build avisa.
     2. TAMANHO — se a saída encolher mais que o razoável (sinal de que o
        scanner comeu conteúdo), o arquivo também vai cru.
   O build NUNCA falha por causa disso e NUNCA publica arquivo quebrado: no
   pior caso ele publica o original e diz na tela qual foi.
   ============================================================ */

import {
  readFileSync, writeFileSync, mkdirSync, readdirSync,
  statSync, copyFileSync, rmSync, existsSync,
} from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { Script } from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const FONTE = '_lab';
const DESTINO = '.';
const MINIFICAR = !process.argv.includes('--raw');

/* o que sai do _lab e vira rota pública */
const COPIAR = ['index.html', 'styles.css', 'script.js', 'vidro-liquido.js',
                'atendimento', 'blog', 'assets'];

/* material de trabalho do sandbox: nunca vai junto */
const IGNORAR = new Set(['_inbox', 'arquivo-morto']);

/* arquivos cujo texto passa pelo reescritor de caminho */
const TEXTO = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);

/* ─── minificadores ──────────────────────────────────────────────────────── */

let lightningcss = null;
if (MINIFICAR) {
  try { lightningcss = require('lightningcss'); }
  catch { console.log('  (lightningcss não encontrado — o CSS vai cru)'); }
}

function minCss(codigo, arquivo) {
  if (!lightningcss) return null;
  const saida = lightningcss.transform({
    filename: arquivo,
    code: Buffer.from(codigo),
    minify: true,
  }).code.toString();
  // trava 1: a saída tem que reparsear
  lightningcss.transform({ filename: arquivo, code: Buffer.from(saida), minify: false });
  return saida;
}

/* Varre o JS como um scanner de verdade: sabe quando está dentro de string,
   template, expressão regular ou comentário. É isto que impede o acidente
   clássico — cortar a partir do `//` de um "https://..." e destruir o resto
   do arquivo.
   NÃO renomeia nada e NÃO reescreve expressão: só apaga comentário. O ganho
   quase todo vem daí, e o risco de mexer em `shapeShowcase` ou no shader do
   vidro líquido (que não têm teste) não se paga. */
function tiraComentariosJs(s) {
  let fora = '';
  let i = 0;
  let anterior = '';           // último caractere significativo (decide / = divisão ou regex)
  const n = s.length;

  while (i < n) {
    const c = s[i], d = s[i + 1];

    // comentário de linha
    if (c === '/' && d === '/') {
      while (i < n && s[i] !== '\n') i++;
      continue;
    }
    // comentário de bloco
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // string ou template
    if (c === '"' || c === "'" || c === '`') {
      const aspa = c;
      fora += c; i++;
      while (i < n) {
        if (s[i] === '\\') { fora += s[i] + s[i + 1]; i += 2; continue; }
        fora += s[i];
        if (s[i] === aspa) { i++; break; }
        i++;
      }
      anterior = aspa;
      continue;
    }
    // expressão regular: só é regex se o token anterior NÃO puder terminar
    // um valor (senão `a / b` viraria início de regex)
    if (c === '/' && !')]}'.includes(anterior) && !/[\w$]/.test(anterior)) {
      fora += c; i++;
      let emClasse = false;
      while (i < n) {
        if (s[i] === '\\') { fora += s[i] + s[i + 1]; i += 2; continue; }
        if (s[i] === '[') emClasse = true;
        else if (s[i] === ']') emClasse = false;
        else if (s[i] === '/' && !emClasse) { fora += s[i]; i++; break; }
        else if (s[i] === '\n') break;      // não era regex; deixa seguir
        fora += s[i]; i++;
      }
      anterior = '/';
      continue;
    }

    fora += c;
    if (!/\s/.test(c)) anterior = c;
    i++;
  }
  return fora;
}

function minJs(codigo) {
  let s = tiraComentariosJs(codigo);
  s = s.split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n');
  s = s.replace(/\n\s*\n+/g, '\n');
  new Script(s);                      // trava 1: tem que parsear
  return s;
}

/* HTML: comentário fora de <script>/<style>. Dentro deles, `<!--` pode ser
   conteúdo legítimo (string em JS, por exemplo), então esses blocos ficam
   intocados — inclusive os três <script type="application/ld+json"> dos dados
   estruturados, que são conteúdo e não podem encolher. */
function minHtml(codigo) {
  const pedacos = codigo.split(/(<(?:script|style)\b[\s\S]*?<\/(?:script|style)>)/i);
  return pedacos.map((p, ix) => {
    if (ix % 2 === 1) return p;                       // é um <script>/<style>
    return p
      .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      .replace(/^[ \t]+$/gm, '')
      .replace(/\n\s*\n+/g, '\n');
  }).join('');
}

/* ─── travessia ──────────────────────────────────────────────────────────── */

const conta = { arquivos: 0, caminhos: 0, min: 0, crus: [] };
let antes = 0, depois = 0;

function anda(rel) {
  const de = join(FONTE, rel);
  const para = join(DESTINO, rel);

  if (statSync(de).isDirectory()) {
    if (IGNORAR.has(rel.split(/[\\/]/).pop())) return;
    mkdirSync(para, { recursive: true });
    for (const nome of readdirSync(de)) anda(join(rel, nome));
    return;
  }

  mkdirSync(dirname(para), { recursive: true });
  conta.arquivos++;

  const ext = extname(de).toLowerCase();
  if (!TEXTO.has(ext)) { copyFileSync(de, para); return; }

  let s = readFileSync(de, 'utf8');

  // 1 · o caminho do sandbox vira a raiz do site
  s = s.replace(/\/_lab\//g, () => { conta.caminhos++; return '/'; });
  // 2 · rede contra a tarja de sandbox voltar
  s = s.replace(/^.*lab-flag.*$\n?/gm, '');

  const bruto = s;
  antes += bruto.length;

  if (MINIFICAR && ['.css', '.js', '.html'].includes(ext)) {
    try {
      const out = ext === '.css' ? minCss(s, de)
                : ext === '.js'  ? minJs(s)
                :                  minHtml(s);
      // trava 2: encolheu demais? é sinal de que algo foi comido
      const piso = ext === '.css' ? 0.20 : 0.35;
      if (out == null) throw new Error('minificador indisponível');
      if (out.length < bruto.length * piso) {
        throw new Error(`encolheu ${(100 * (1 - out.length / bruto.length)).toFixed(0)}%, suspeito`);
      }
      s = out;
      conta.min++;
    } catch (e) {
      conta.crus.push(`${rel} — ${e.message}`);
    }
  }

  depois += s.length;
  writeFileSync(para, s, 'utf8');
}

/* diretórios gerados somem antes, pra não deixar órfão de build velho */
for (const d of ['blog']) {
  const alvo = join(DESTINO, d);
  if (existsSync(alvo)) rmSync(alvo, { recursive: true, force: true });
}

for (const alvo of COPIAR) {
  if (!existsSync(join(FONTE, alvo))) { console.log(`  (pulado, não existe) ${alvo}`); continue; }
  anda(alvo);
}

const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';
console.log(`\nBuild da LP concluído${MINIFICAR ? '' : '  (--raw: sem minificar)'}.`);
console.log(`  arquivos copiados        : ${conta.arquivos}`);
console.log(`  caminhos /_lab/ trocados : ${conta.caminhos}`);
if (MINIFICAR) {
  console.log(`  arquivos minificados     : ${conta.min}`);
  console.log(`  texto publicado          : ${kb(antes)} -> ${kb(depois)}   (-${(100 * (1 - depois / antes)).toFixed(1)}%)`);
  if (conta.crus.length) {
    console.log(`\n  ⚠️ foram CRUS (a página funciona, só não encolheu):`);
    for (const c of conta.crus) console.log(`     · ${c}`);
  }
}
