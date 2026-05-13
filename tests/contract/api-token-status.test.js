/**
 * tests/contract/api-token-status.test.js
 *
 * Contract tests for GET /api/token/status
 * Security: uses service_role, never returns token values,
 *           returns only connected boolean per servico.
 *
 * Run: node --test tests/contract/api-token-status.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/token/status.js';

const SVC_KEY = 'svc-key-token-status-test';

const _nativeFetch = global.fetch;

function makeReq(method = 'GET') {
  return { method, headers: {}, body: {} };
}

function makeRes() {
  return {
    _status: null,
    _body:   null,
    _headers: {},
    status(code)    { this._status = code; return this; },
    json(data)      { this._body   = data; return this; },
    end()           { return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
}

const mockHeaders = { get: (n) => n === 'content-type' ? 'application/json' : null };

function mockRows(rows) {
  global.fetch = async () => ({
    ok: true, status: 200, headers: mockHeaders,
    json: async () => rows,
  });
}

before(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = SVC_KEY;
});

after(() => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  global.fetch = _nativeFetch;
});

afterEach(() => { global.fetch = _nativeFetch; });

// ── Metodo ────────────────────────────────────────────────────────────────────

describe('/api/token/status — metodo', () => {

  it('POST retorna 405', async () => {
    const res = makeRes();
    await handler(makeReq('POST'), res);
    assert.equal(res._status, 405);
  });

  it('PUT retorna 405', async () => {
    const res = makeRes();
    await handler(makeReq('PUT'), res);
    assert.equal(res._status, 405);
  });

  it('OPTIONS retorna 204', async () => {
    const res = makeRes();
    await handler(makeReq('OPTIONS'), res);
    assert.equal(res._status, 204);
  });

});

// ── CORS ──────────────────────────────────────────────────────────────────────

describe('/api/token/status — CORS', () => {

  it('define Access-Control-Allow-Origin para o dominio do dashboard', async () => {
    mockRows([{ servico: 'google' }]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(
      res._headers['Access-Control-Allow-Origin'],
      'https://dashboard-pessoal-edson.vercel.app'
    );
  });

});

// ── Status conectado ──────────────────────────────────────────────────────────

describe('/api/token/status — status conectado', () => {

  it('google e meta conectados quando ambas as rows existem', async () => {
    mockRows([{ servico: 'google' }, { servico: 'meta' }]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.google?.connected, true);
    assert.equal(res._body?.meta?.connected, true);
  });

  it('google e meta desconectados quando sem rows', async () => {
    mockRows([]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.google?.connected, false);
    assert.equal(res._body?.meta?.connected, false);
  });

  it('somente google conectado quando apenas row google existe', async () => {
    mockRows([{ servico: 'google' }]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._body?.google?.connected, true);
    assert.equal(res._body?.meta?.connected, false);
  });

  it('somente meta conectado quando apenas row meta existe', async () => {
    mockRows([{ servico: 'meta' }]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._body?.google?.connected, false);
    assert.equal(res._body?.meta?.connected, true);
  });

  it('retorna campo google e campo meta sempre presentes', async () => {
    mockRows([]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.ok('google' in (res._body || {}), 'campo google deve estar presente');
    assert.ok('meta'   in (res._body || {}), 'campo meta deve estar presente');
  });

});

// ── Nunca retorna tokens ──────────────────────────────────────────────────────

describe('/api/token/status — nunca retorna valores de token', () => {

  it('resposta nao contem access_token', async () => {
    mockRows([{ servico: 'google', access_token: 'at_secret_sentinel' }]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    const bodyStr = JSON.stringify(res._body || {});
    assert.ok(
      !bodyStr.includes('at_secret_sentinel'),
      'access_token nao deve aparecer na resposta'
    );
    assert.ok(!('access_token' in (res._body || {})), 'campo access_token nao deve existir na raiz');
  });

  it('resposta nao contem refresh_token', async () => {
    mockRows([{ servico: 'google', refresh_token: 'rt_secret_sentinel' }]);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    const bodyStr = JSON.stringify(res._body || {});
    assert.ok(
      !bodyStr.includes('rt_secret_sentinel'),
      'refresh_token nao deve aparecer na resposta'
    );
  });

  it('query ao Supabase nao solicita colunas de token', async () => {
    let capturedUrl = null;
    global.fetch = async (url) => {
      capturedUrl = String(url);
      return { ok: true, status: 200, headers: mockHeaders, json: async () => [] };
    };
    await handler(makeReq('GET'), makeRes());
    assert.ok(capturedUrl, 'fetch deve ter sido chamado');
    assert.ok(
      !capturedUrl.includes('access_token') && !capturedUrl.includes('refresh_token'),
      `query nao deve pedir colunas de token. URL: ${capturedUrl}`
    );
  });

});

// ── Service role key ──────────────────────────────────────────────────────────

describe('/api/token/status — usa SUPABASE_SERVICE_ROLE_KEY', () => {

  it('query ao Supabase usa service role key como apikey', async () => {
    let capturedKey = null;
    global.fetch = async (_url, opts = {}) => {
      capturedKey = opts?.headers?.apikey ?? null;
      return { ok: true, status: 200, headers: mockHeaders, json: async () => [] };
    };
    await handler(makeReq('GET'), makeRes());
    assert.equal(capturedKey, SVC_KEY,
      `esperado service key, got "${capturedKey}"`);
  });

  it('falha clara quando SUPABASE_SERVICE_ROLE_KEY nao configurado', async () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._status, 500);
    assert.ok(res._body?.error, 'deve retornar campo error');
    process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  });

});
