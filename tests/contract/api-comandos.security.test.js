/**
 * tests/contract/api-comandos.security.test.js
 *
 * Security tests for api/comandos.js — fallback de token comprometido.
 *
 * Run: node --test tests/contract/api-comandos.security.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import handler from '../../api/comandos.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../../api/comandos.js'), 'utf8');

function makeReq(method, { headers = {}, body = {} } = {}) {
  return { method, headers, body };
}

function makeRes() {
  return {
    _status: null, _body: null, _headers: {},
    status(code)    { this._status = code; return this; },
    json(data)      { this._body   = data; return this; },
    end()           { return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
}

// ── Analise estatica ──────────────────────────────────────────────────────────

describe('api/comandos.js — sem fallback de token comprometido', () => {

  it('codigo fonte nao contem o token comprometido como string literal', () => {
    assert.ok(
      !src.includes("'oc_edson_2026_secure'"),
      'api/comandos.js contem fallback para token comprometido. Remova o hardcode.'
    );
  });

});

// ── Comportamento request-time ────────────────────────────────────────────────

describe('api/comandos.js — WEBHOOK_TOKEN lido no request, nao no modulo', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'token-rotacionado-seguro'; });
  after(() => { delete process.env.WEBHOOK_TOKEN; });

  it('token comprometido e rejeitado quando WEBHOOK_TOKEN esta configurado com outro valor', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': 'oc_edson_2026_secure' },
      body: { texto: 'ajuda' },
    }), res);
    assert.equal(res._status, 401,
      'oc_edson_2026_secure nao deve autenticar quando WEBHOOK_TOKEN foi rotacionado'
    );
  });

  it('token correto (novo valor) e aceito apos rotacao', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': 'token-rotacionado-seguro' },
      body: { texto: 'ajuda' },
    }), res);
    assert.equal(res._status, 200,
      'novo token deve ser aceito'
    );
  });

});

// ── Fail-fast sem WEBHOOK_TOKEN ───────────────────────────────────────────────

describe('api/comandos.js — fail-fast quando WEBHOOK_TOKEN ausente', () => {

  before(() => { delete process.env.WEBHOOK_TOKEN; });

  it('retorna 500 quando WEBHOOK_TOKEN nao esta configurado', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': 'qualquer-token' },
      body: { texto: 'ajuda' },
    }), res);
    assert.equal(res._status, 500,
      'deve falhar fechado quando WEBHOOK_TOKEN nao esta configurado'
    );
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

});
