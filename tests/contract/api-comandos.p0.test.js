/**
 * tests/contract/api-comandos.p0.test.js
 *
 * P0 contract tests for /api/comandos
 * Scope: auth, routing, response shape — no Supabase/Google calls triggered.
 *
 * Run: node --test tests/contract/api-comandos.p0.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/comandos.js';

// ── Test doubles ──────────────────────────────────────────────────────────────

function makeReq(method, { headers = {}, body = {} } = {}) {
  return { method, headers, body };
}

function makeRes() {
  const res = {
    _status: null,
    _body:   null,
    _headers: {},
    status(code)    { this._status = code; return this; },
    json(data)      { this._body   = data; return this; },
    end()           { return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
  return res;
}

// Token hardcoded em api/comandos.js como fallback quando WEBHOOK_TOKEN não está
// definido como env var — contrato: este valor sempre deve funcionar.
const VALID_TOKEN = process.env.WEBHOOK_TOKEN ?? 'oc_edson_2026_secure';

// ── Suite P0 ──────────────────────────────────────────────────────────────────

describe('/api/comandos — P0 contract', () => {

  // ── Healthcheck ────────────────────────────────────────────────────────────

  it('GET retorna 200 com ok:true e campo message (healthcheck)', async () => {
    const req = makeReq('GET');
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
    assert.ok(
      typeof res._body?.message === 'string' && res._body.message.length > 0,
      'message deve ser string não vazia'
    );
  });

  // ── CORS ───────────────────────────────────────────────────────────────────

  it('toda resposta inclui Access-Control-Allow-Origin: *', async () => {
    const req = makeReq('GET');
    const res = makeRes();
    await handler(req, res);

    assert.equal(
      res._headers['Access-Control-Allow-Origin'],
      '*',
      'CORS header obrigatório para OpenClaw'
    );
  });

  it('OPTIONS retorna 204 (preflight CORS)', async () => {
    const req = makeReq('OPTIONS');
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 204);
  });

  it('PUT retorna 405 method not allowed', async () => {
    const req = makeReq('PUT');
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 405);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

  // ── Autenticação ───────────────────────────────────────────────────────────

  it('POST sem token retorna 401', async () => {
    const req = makeReq('POST', { body: { texto: 'resumo' } });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 401);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

  it('POST com token inválido no header retorna 401', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': 'token-invalido-xyz' },
      body:    { texto: 'resumo' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 401);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

  it('POST com token inválido no body retorna 401', async () => {
    const req = makeReq('POST', {
      body: { token: 'errado', texto: 'resumo' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 401);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

  it('token válido pode ser passado no body.token (contrato OpenClaw legado)', async () => {
    const req = makeReq('POST', {
      body: { token: VALID_TOKEN, texto: 'xyzzy-nao-existe' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200, 'token no body deve ser aceito');
    assert.equal(res._body?.ok, true);
  });

  // ── Roteamento de comandos ─────────────────────────────────────────────────

  it('POST comando desconhecido retorna 200 com ❓ na resposta', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body:    { texto: 'xyzzy-comando-inexistente' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200, 'sempre HTTP 200 — contrato com OpenClaw');
    assert.equal(res._body?.ok, true);
    assert.ok(
      typeof res._body?.resposta === 'string',
      'resposta deve ser string'
    );
    assert.ok(
      res._body.resposta.includes('❓'),
      'resposta deve conter ❓ para comando desconhecido'
    );
  });

  it('POST campo "comando" (formato legado) também é aceito', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body:    { comando: 'xyzzy-legado' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
    assert.ok(typeof res._body?.resposta === 'string');
  });

  it('POST "ajuda" retorna 200 com menu completo (sem Supabase/Google)', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body:    { texto: 'ajuda' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
    assert.ok(
      res._body?.resposta.includes('Comandos disponíveis'),
      'ajuda deve listar comandos disponíveis'
    );
  });

  it('POST "help" (alias inglês) também retorna menu', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body:    { texto: 'help' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
    assert.ok(res._body?.resposta.includes('Comandos disponíveis'));
  });

  // ── Shape da resposta ──────────────────────────────────────────────────────

  it('resposta de sucesso sempre contém campos { resposta, ok:true }', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body:    { texto: 'menu' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.ok('resposta' in res._body, 'campo resposta obrigatório');
    assert.ok('ok' in res._body, 'campo ok obrigatório');
    assert.equal(res._body.ok, true);
  });

  // ── Normalização de entrada ────────────────────────────────────────────────

  it('texto com maiúsculas é normalizado (AJUDA == ajuda)', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body:    { texto: 'AJUDA' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200);
    assert.ok(res._body?.resposta.includes('Comandos disponíveis'));
  });

  it('texto com espaços extras é normalizado ("  ajuda  " == "ajuda")', async () => {
    const req = makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body:    { texto: '  ajuda  ' },
    });
    const res = makeRes();
    await handler(req, res);

    assert.equal(res._status, 200);
    assert.ok(res._body?.resposta.includes('Comandos disponíveis'));
  });

});
