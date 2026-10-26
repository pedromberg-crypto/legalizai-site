// STORY-002-001 e STORY-002-002 · GGQPA-XXX-202610261605 — lista de espera na API e chat desligado.
// Sem rede e sem navegador: fetch falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const L = require('../lp/em-breve/lista-espera.js');
const LAB = require('../lp/_lab/em-breve/lista-espera.js');

const CAMPOS_DO_DTO = ['firstName', 'lastName', 'email', 'whatsapp', 'city', 'state', 'origin',
  'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'privacyAcceptedAt'];
const ACEITE = '2026-10-26T19:00:00.000Z';

test('corpo do contrato do REQ-032, só com campos do DTO', () => {
  const corpo = L.montarCorpo({
    nomeCompleto: ' Ana  Maria Souza ', email: ' ana@x.com ', whatsapp: '(31) 99999-0001',
    cidade: 'Belo Horizonte - MG', uf: 'MG', utms: { utm_source: 'meta', utm_medium: '' }, aceiteEm: ACEITE
  });
  assert.deepEqual(corpo, {
    firstName: 'Ana', lastName: 'Maria Souza', email: 'ana@x.com', whatsapp: '31999990001',
    city: 'Belo Horizonte', state: 'MG', origin: 'coming-soon', utmSource: 'meta', privacyAcceptedAt: ACEITE
  });
  for (const k of Object.keys(corpo)) assert.ok(CAMPOS_DO_DTO.includes(k), k);
});

test('só um nome, sem UF e sem UTM: os opcionais não vão', () => {
  const corpo = L.montarCorpo({ nomeCompleto: 'Ana', email: 'a@x.com', whatsapp: '3133334444', cidade: 'Contagem', uf: '', utms: {} });
  assert.deepEqual(Object.keys(corpo), ['firstName', 'email', 'whatsapp', 'city', 'origin']);
});

test('201 é ok; 400, 429, 500 e rede são erro', () => {
  assert.equal(L.ler({ status: 201 }).tipo, 'ok');
  for (const s of [400, 429, 500, 403]) assert.equal(L.ler({ status: s }).tipo, 'erro');
  assert.equal(L.ler({ rede: true }).tipo, 'erro');
});

test('enviar: POST JSON na rota nova, sem PII na URL', async () => {
  const vistos = [];
  const f = async (url, op) => { vistos.push({ url, op }); return { status: 201 }; };
  const corpo = L.montarCorpo({ nomeCompleto: 'Ana', email: 'ana@x.com', whatsapp: '31999990001', cidade: 'BH', aceiteEm: ACEITE });
  assert.deepEqual(await L.enviar(f, corpo), { tipo: 'ok' });
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0].url, 'https://cu2viedkfvwuiuauvvi4guzdnm0ktprm.lambda-url.sa-east-1.on.aws/api/v1/marketing/landing-leads');
  assert.equal(vistos[0].op.method, 'POST');
  assert.deepEqual(Object.keys(vistos[0].op.headers), ['Content-Type']);
  assert.deepEqual(JSON.parse(vistos[0].op.body), corpo);
  assert.doesNotMatch(vistos[0].url, /ana|@|\?/);
  assert.equal(LAB.LISTA_ESPERA_API, L.LISTA_ESPERA_API);
});

test('400 reenvia uma vez sem privacyAcceptedAt; 429 e rede não reenviam', async () => {
  const corpos = [];
  const resp = [400, 201];
  const f = async (url, op) => { corpos.push(JSON.parse(op.body)); return { status: resp.shift() }; };
  const corpo = L.montarCorpo({ nomeCompleto: 'Ana', email: 'a@x.com', whatsapp: '31999990001', cidade: 'BH', aceiteEm: ACEITE });
  assert.equal((await L.enviar(f, corpo)).tipo, 'ok');
  assert.equal(corpos.length, 2);
  assert.ok('privacyAcceptedAt' in corpos[0]);
  assert.ok(!('privacyAcceptedAt' in corpos[1]));

  let n = 0;
  assert.equal((await L.enviar(async () => { n++; return { status: 429 }; }, corpo)).tipo, 'erro');
  assert.equal((await L.enviar(async () => { n++; throw new TypeError('rede'); }, corpo)).tipo, 'erro');
  assert.equal((await L.enviar(() => { n++; throw new TypeError('sem fetch'); }, corpo)).tipo, 'erro');
  assert.equal(n, 3);
});

test('chat.js desligado não toca DOM nem rede', () => {
  for (const arq of ['../lp/em-breve/chat.js', '../lp/_lab/em-breve/chat.js']) {
    const codigo = readFileSync(new URL(arq, import.meta.url), 'utf8');
    const armadilha = new Proxy({}, { get(_, k) { throw new Error('tocou ' + String(k)); } });
    runInNewContext(codigo, { document: armadilha, fetch: armadilha, localStorage: armadilha, window: armadilha });
    assert.match(codigo, /var CHAT_ATIVO = false;/);
  }
  for (const pag of ['../lp/em-breve/index.html', '../lp/_lab/em-breve/index.html']) {
    const html = readFileSync(new URL(pag, import.meta.url), 'utf8');
    assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ''), /chat\.js/);
    assert.match(html, /em-breve\/lista-espera\.js\?v=2" defer><\/script>\n<script src="(\/_lab)?\/em-breve\/script\.js\?v=11"/);
  }
});

test('nenhuma referência ao backend antigo em lp/', () => {
  const raiz = new URL('../lp/', import.meta.url).pathname;
  const achados = [];
  const anda = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== 'node_modules') anda(p); continue; }
      if (!/\.(html|js|mjs|json|css|txt|xml|md)$/.test(n)) continue;
      if (readFileSync(p, 'utf8').includes('wygqjkfsc7qzc3chhzwztorula0kuzbw')) achados.push(p);
    }
  };
  anda(raiz);
  assert.deepEqual(achados, []);
});

// STORY-003-001 · GGQPA-XXX-202610261900 — tipo de negócio e clique do anúncio (REQ-058).
const CAMPOS_REQ058 = ['businessType', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'landingPage', 'referrer'];
const BASE = { nomeCompleto: 'Ana', email: 'a@x.com', whatsapp: '31999990001', cidade: 'BH', aceiteEm: ACEITE };

test('REQ-058 AC1: tipo de negócio e origem do clique no corpo, só campos do DTO', () => {
  for (const M of [L, LAB]) {
    const corpo = M.montarCorpo({
      ...BASE, tipoNegocio: 'MIGRATE_MEI',
      origem: { gclid: 'Cj0_a-1', fbclid: 'IwAR.x~y', landingPage: '/em-breve', referrer: 'https://www.google.com/search?q=abrir+empresa' }
    });
    assert.equal(corpo.businessType, 'MIGRATE_MEI');
    assert.equal(corpo.gclid, 'Cj0_a-1');
    assert.equal(corpo.fbclid, 'IwAR.x~y');
    assert.equal(corpo.landingPage, '/em-breve');
    assert.equal(corpo.referrer, 'https://www.google.com/search');
    assert.ok(!('gbraid' in corpo) && !('wbraid' in corpo));
    for (const k of Object.keys(corpo)) assert.ok(CAMPOS_DO_DTO.includes(k) || CAMPOS_REQ058.includes(k), k);
  }
});

test('REQ-058 AC2: query, id inválido, URL estranha e tipo fora do enum não vão', () => {
  const corpo = L.montarCorpo({
    ...BASE, tipoNegocio: 'mei',
    origem: {
      landingPage: '/em-breve?email=a@b.com#x', gclid: 'abc def', gbraid: 'a'.repeat(501), wbraid: 'ok_1',
      fbclid: 'ana@x.com', referrer: 'javascript:alert(1)'
    }
  });
  assert.equal(corpo.landingPage, '/em-breve');
  assert.equal(corpo.wbraid, 'ok_1');
  for (const k of ['businessType', 'gclid', 'gbraid', 'fbclid', 'referrer']) assert.ok(!(k in corpo), k);
  assert.doesNotMatch(JSON.stringify(corpo), /\?|#|a@b\.com/);

  const semOrigem = L.montarCorpo({ ...BASE, origem: null, tipoNegocio: '' });
  for (const k of CAMPOS_REQ058) assert.ok(!(k in semOrigem), k);
  assert.equal(L.montarCorpo({ ...BASE, origem: { landingPage: 'em-breve', referrer: 'https://exemplo.com#a' } }).landingPage, undefined);
  assert.equal(L.montarCorpo({ ...BASE, origem: { referrer: 'https://exemplo.com#a' } }).referrer, 'https://exemplo.com');
  for (const t of L.TIPOS_NEGOCIO) assert.equal(L.montarCorpo({ ...BASE, tipoNegocio: t }).businessType, t);
});

test('REQ-058 AC3: 400 reenvia sem os campos novos (com o aceite); 400 de novo, sem o aceite', async () => {
  const corpo = L.montarCorpo({ ...BASE, tipoNegocio: 'NEW_COMPANY', origem: { gclid: 'g1', landingPage: '/em-breve' } });
  const rodar = async (resp) => {
    const corpos = [];
    const f = async (url, op) => { corpos.push(JSON.parse(op.body)); return { status: resp.shift() }; };
    return { r: await L.enviar(f, corpo), corpos };
  };

  let { r, corpos } = await rodar([400, 201]);
  assert.equal(r.tipo, 'ok');
  assert.equal(corpos.length, 2);
  assert.equal(corpos[0].businessType, 'NEW_COMPANY');
  for (const k of CAMPOS_REQ058) assert.ok(!(k in corpos[1]), k);
  assert.equal(corpos[1].privacyAcceptedAt, ACEITE);

  ({ r, corpos } = await rodar([400, 400, 201]));
  assert.equal(r.tipo, 'ok');
  assert.equal(corpos.length, 3);
  assert.ok(!('privacyAcceptedAt' in corpos[2]) && !('gclid' in corpos[2]));
  assert.equal(corpos[2].email, 'a@x.com');

  ({ r, corpos } = await rodar([400, 400, 400]));
  assert.equal(r.tipo, 'erro');
  assert.equal(corpos.length, 3);

  ({ r, corpos } = await rodar([429]));
  assert.equal(r.tipo, 'erro');
  assert.equal(corpos.length, 1);
});

test('REQ-058: cada opção do formulário tem o código da API', () => {
  // pelo id da opção: o rótulo do _lab já mudou ("Empresa nova, ainda sem CNPJ")
  const esperado = ['NEW_COMPANY', 'MIGRATE_MEI', 'MIGRATE_ME'];
  for (const pag of ['../lp/em-breve/index.html', '../lp/_lab/em-breve/index.html']) {
    const html = readFileSync(new URL(pag, import.meta.url), 'utf8');
    const opcoes = [...html.matchAll(/<li class="soon-ac-option" id="soon-tipo-opt-(\d)"[^>]*>/g)];
    assert.equal(opcoes.length, 3, pag);
    for (const [li, i] of opcoes) {
      assert.match(li, new RegExp('data-business-type="' + esperado[Number(i)] + '"'), pag + ' opção ' + i);
    }
  }
  for (const arq of ['../lp/em-breve/script.js', '../lp/_lab/em-breve/script.js']) {
    const js = readFileSync(new URL(arq, import.meta.url), 'utf8');
    assert.match(js, /data-business-type/);
    assert.match(js, /tipoNegocio:/);
    assert.match(js, /origem: lerOrigem\(\)/);
  }
});

