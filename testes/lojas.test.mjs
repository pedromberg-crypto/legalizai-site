// Links das lojas do app (16/11/2026). O link de verdade de cada loja mora SÓ
// no lp/vercel.json (redirects /app-store e /google-play); botões, rodapés e
// /baixar apontam pra essas rotas. Estes testes conferem que o desenho fecha:
// rota existe, aponta pra loja certa, /baixar escolhe pelo aparelho e nenhum
// botão ficou com link solto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LP = join(dirname(fileURLToPath(import.meta.url)), '..', 'lp');
const ler = (rel) => readFileSync(join(LP, rel), 'utf8');
const vercel = JSON.parse(ler('vercel.json'));

/* Vercel avalia os redirects em ordem e usa o primeiro que casa. Aqui só os
   formatos que o vercel.json usa: caminho fixo, grupo (a|b) e /:path*; `has`
   de header ou host com valor em regex. */
function casa(r, caminho, cab) {
  const fonte = '^' + r.source.replace('/:path*', '(?:/.*)?') + '$';
  if (!new RegExp(fonte).test(caminho)) return false;
  return (r.has || []).every((h) => {
    const valor = h.type === 'host' ? cab.host : cab[h.key.toLowerCase()];
    return valor != null && new RegExp('^' + h.value + '$').test(valor);
  });
}
function destino(caminho, cab = {}) {
  const c = { host: 'www.legalizai.com.br', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0)', ...cab };
  const r = vercel.redirects.find((x) => casa(x, caminho, c));
  return r && r.destination;
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36';

test('/app-store e /google-play levam à loja certa', () => {
  assert.match(destino('/app-store'), /^https:\/\/apps\.apple\.com\//);
  assert.match(destino('/google-play'), /^https:\/\/play\.google\.com\/store\/apps\/details\?id=/);
});

test('/baixar, /app e /download escolhem a loja pelo aparelho', () => {
  for (const p of ['/baixar', '/app', '/download']) {
    assert.equal(destino(p, { 'user-agent': IPHONE }), '/app-store', p);
    assert.equal(destino(p, { 'user-agent': ANDROID }), '/google-play', p);
    assert.equal(destino(p), '/#rodape', p); // computador: os dois badges
  }
  assert.equal(destino('/ios'), '/app-store');
  assert.equal(destino('/iphone'), '/app-store');
  assert.equal(destino('/android'), '/google-play');
});

test('subdomínios app., baixar. e download. caem no /baixar do www', () => {
  for (const h of ['app.legalizai.com.br', 'baixar.legalizai.com.br', 'download.legalizai.com.br']) {
    assert.equal(destino('/', { host: h }), 'https://www.legalizai.com.br/baixar', h);
    assert.equal(destino('/qualquer/coisa', { host: h }), 'https://www.legalizai.com.br/baixar', h);
  }
  // o www não pode cair na regra de host (seria redirect em loop)
  assert.equal(destino('/'), undefined);
});

test('os redirects das lojas são temporários (307), pra trocar o link sem cache preso', () => {
  for (const r of vercel.redirects.filter((x) => /app-store|google-play|baixar/.test(x.source + x.destination))) {
    assert.equal(r.permanent, false, r.source);
  }
});

test('nenhum botão de loja aponta pra outro lugar', () => {
  const paginas = ['_lab/index.html', '_lab/blog/index.html', '_lab/blog/fator-r.html',
    'cookies.html', 'privacidade.html', 'termos.html', '404.html', 'excluir-conta.html'];
  for (const p of paginas) {
    const html = ler(p);
    const apple = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*App Store/g)].map((m) => m[1]);
    const google = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>)[\s\S])*Google Play/g)].map((m) => m[1]);
    assert.ok(apple.length && google.length, `${p}: sem link das lojas`);
    apple.forEach((h) => assert.equal(h, '/app-store', `${p}: App Store → ${h}`));
    google.forEach((h) => assert.equal(h, '/google-play', `${p}: Google Play → ${h}`));
  }
});

test('a home está no modo app', () => {
  const html = ler('_lab/index.html');
  assert.match(html, /<html[^>]*data-modo="app"/);
  assert.doesNotMatch(html, /Em breve n[ao]<\/small>/);
});
