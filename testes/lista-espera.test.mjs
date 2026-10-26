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
    assert.match(html, /em-breve\/lista-espera\.js\?v=1" defer><\/script>\n<script src="(\/_lab)?\/em-breve\/script\.js\?v=10"/);
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
