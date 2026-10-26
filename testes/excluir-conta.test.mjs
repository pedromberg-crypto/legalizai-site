// STORY-001-001 · GGQPA-XXX-202610261520 — lógica da exclusão pela página.
// Sem rede e sem navegador: fetch falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const X = require('../lp/excluir-conta.js');

const resp = (status, corpo, retryAfter = null) => ({ status, corpo, retryAfter });

test('corpos levam só email, code e kind ACCOUNT', () => {
  assert.deepEqual(X.corpoDoCodigo(' ana@x.com '), { email: 'ana@x.com', kind: 'ACCOUNT' });
  assert.deepEqual(X.corpoDaConfirmacao('ana@x.com', '482913'), { email: 'ana@x.com', code: '482913', kind: 'ACCOUNT' });
});

test('só "conta" usa a API; base vazia manda tudo ao e-mail', () => {
  assert.equal(X.usaApi('conta'), true);
  for (const o of ['alguns', 'terceiro', 'lista']) assert.equal(X.usaApi(o), false);
  assert.equal(X.usaApi('conta', ''), false);
});

test('rotas públicas do REQ-056', () => {
  assert.equal(X.rota('codigo', 'https://api/x/api/v1'), 'https://api/x/api/v1/account-deletion/code');
  assert.equal(X.rota('confirmar', 'https://api/x/api/v1/'), 'https://api/x/api/v1/account-deletion');
  assert.match(X.EXCLUSAO_API, /^https:\/\/.+\/api\/v1\/$/);
});

test('pedido do código: neutro, espera, e-mail inválido e fallback', () => {
  assert.deepEqual(X.lerCodigo(resp(202, { message: 'qualquer' })), { tipo: 'codigo' });
  assert.deepEqual(X.lerCodigo(resp(429, {}, '120')), { tipo: 'espera', segundos: 120 });
  assert.deepEqual(X.lerCodigo(resp(400, { code: 'VALIDATION_ERROR' })), { tipo: 'emailInvalido' });
  assert.deepEqual(X.lerCodigo(resp(422, { code: 'DELETION_KIND_NOT_SUPPORTED' })), { tipo: 'manual' });
  assert.deepEqual(X.lerCodigo(resp(500, {})), { tipo: 'manual' });
  assert.deepEqual(X.lerCodigo({ rede: true }), { tipo: 'manual' });
});

test('confirmação: graceDays, código, espera e fallback', () => {
  assert.deepEqual(X.lerConfirmacao(resp(200, { status: 'SCHEDULED', graceDays: 45, hasCompany: true })), { tipo: 'recebido', graceDays: 45 });
  assert.deepEqual(X.lerConfirmacao(resp(200, {})), { tipo: 'recebido', graceDays: 30 });
  assert.equal(X.lerConfirmacao(resp(422, { code: 'VERIFICATION_CODE_INVALID' })).tipo, 'incorreto');
  assert.equal(X.lerConfirmacao(resp(422, { code: 'VERIFICATION_CODE_EXPIRED' })).tipo, 'vencido');
  assert.deepEqual(X.lerConfirmacao(resp(429, {}, '30')), { tipo: 'espera', segundos: 30 });
  assert.equal(X.lerConfirmacao(resp(403, { code: 'ACCOUNT_DELETION_PENDING' })).tipo, 'manual');
  assert.equal(X.lerConfirmacao({ rede: true }).tipo, 'manual');
});

test('Retry-After em segundos, data HTTP ou ausente', () => {
  assert.equal(X.segundosDeEspera('90'), 90);
  assert.equal(X.segundosDeEspera(null), 60);
  assert.equal(X.segundosDeEspera(new Date(1_000_000 + 45_000).toUTCString(), 1_000_000), 45);
  assert.equal(X.segundosDeEspera('lixo'), 60);
});

test('textos de espera e do recebido', () => {
  assert.equal(X.textoEspera(30), 'Muitas tentativas. Tente de novo em 30 segundos.');
  assert.equal(X.textoEspera(120), 'Muitas tentativas. Tente de novo em 2 minutos.');
  const t = X.textosRecebido(45, 'ana@x.com');
  assert.equal(t.principal, 'Sua conta foi desativada agora. A exclusão termina em 45 dias.');
  assert.equal(t.confirmacao, 'Enviamos a confirmação para an•••@x.com.');
  assert.equal(t.desfazer, 'Mudou de ideia? Entre de novo no app com seu e-mail e senha em até 45 dias e tudo volta como estava.');
  assert.doesNotMatch(JSON.stringify(t), /link/);
});

test('postar manda POST JSON sem PII na URL; falha vira rede', async () => {
  let visto;
  const ok = async (url, op) => { visto = { url, op }; return { status: 202, headers: { get: () => null }, json: async () => ({}) }; };
  const r = await X.postar(ok, X.rota('codigo'), X.corpoDoCodigo('ana@x.com'));
  assert.equal(r.status, 202);
  assert.equal(visto.op.method, 'POST');
  assert.deepEqual(Object.keys(visto.op.headers), ['Content-Type']);
  assert.doesNotMatch(visto.url, /ana|@|\?/);
  assert.deepEqual(await X.postar(async () => { throw new TypeError('CORS'); }, 'u', {}), { rede: true });
  assert.deepEqual(await X.postar(() => { throw new TypeError('sem fetch'); }, 'u', {}), { rede: true });
});

test('o script inline da página parseia e não usa console', () => {
  const html = readFileSync(new URL('../lp/excluir-conta.html', import.meta.url), 'utf8');
  const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(blocos.some((b) => b.includes('LzExclusao')));
  for (const b of blocos) new Script(b);
  assert.doesNotMatch(html, /console\./);
  assert.match(html, /<script src="\/excluir-conta\.js\?v=1"><\/script>/);
});
