/**
 * tests/contract/api-token-save.test.js
 *
 * Contract tests for POST /api/token/save
 * Security: no secret from browser, servico allowlist, field stripping,
 *           oauth_tokens written only via service_role key.
 *
 * Run: node --test tests/contract/api-token-save.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/token/save.js';

const SVC_KEY = 'svc-key-token-save-test';

const _nativeFetch = global.fetch;

function makeReq(method = 'POST', body = {}) {
  return { method, headers: {}, body };
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

const mockHeaders = { get: (name) => name === 'content-type' ? 'application/json' : null };

function successMock() {
  global.fetch = async () => ({
    ok: true, status: 200, headers: mockHeaders,
    json: async () => [{}],
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

describe('/api/token/save — metodo', () => {

  it('GET retorna 405', async () => {
    const res = makeRes();
    await handler(makeReq('GET'), res);
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

describe('/api/token/save — CORS', () => {

  it('define Access-Control-Allow-Origin para o dominio do dashboard', async () => {
    successMock();
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'google', refresh_token: 'rt', access_token: 'at' }), res);
    assert.equal(
      res._headers['Access-Control-Allow-Origin'],
      'https://dashboard-pessoal-edson.vercel.app'
    );
  });

});

// ── Allowlist de servico ──────────────────────────────────────────────────────

describe('/api/token/save — allowlist de servico', () => {

  it('servico ausente retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {}), res);
    assert.equal(res._status, 400);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

  it('servico desconhecido retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'instagram' }), res);
    assert.equal(res._status, 400);
  });

  it('servico "supabase" retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'supabase' }), res);
    assert.equal(res._status, 400);
  });

  it('servico vazio retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { servico: '' }), res);
    assert.equal(res._status, 400);
  });

});

// ── Validacao google ──────────────────────────────────────────────────────────

describe('/api/token/save — validacao google', () => {

  it('google sem refresh_token retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'google', access_token: 'at' }), res);
    assert.equal(res._status, 400);
    assert.ok(res._body?.error?.toLowerCase().includes('refresh_token'),
      `erro deve mencionar refresh_token, got: "${res._body?.error}"`);
  });

  it('google com refresh_token vazio retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'google', refresh_token: '', access_token: 'at' }), res);
    assert.equal(res._status, 400);
  });

  it('google com refresh_token valido retorna 200', async () => {
    successMock();
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'google', refresh_token: 'rt_valid', access_token: 'at_valid', scope: 'calendar' }), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
  });

});

// ── Validacao meta ────────────────────────────────────────────────────────────

describe('/api/token/save — validacao meta', () => {

  it('meta sem access_token retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'meta' }), res);
    assert.equal(res._status, 400);
    assert.ok(res._body?.error?.toLowerCase().includes('access_token'),
      `erro deve mencionar access_token, got: "${res._body?.error}"`);
  });

  it('meta com access_token vazio retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'meta', access_token: '' }), res);
    assert.equal(res._status, 400);
  });

  it('meta com access_token valido retorna 200', async () => {
    successMock();
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'meta', access_token: 'EAAxxx' }), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
  });

});

// ── Strip de campos extras ────────────────────────────────────────────────────

describe('/api/token/save — strip de campos nao permitidos', () => {

  it('google: campos extras nao sao gravados no Supabase', async () => {
    let capturedBody = null;
    global.fetch = async (_url, opts = {}) => {
      capturedBody = JSON.parse(opts?.body || '{}');
      return { ok: true, status: 200, headers: mockHeaders, json: async () => [{}] };
    };
    const res = makeRes();
    await handler(makeReq('POST', {
      servico: 'google',
      refresh_token: 'rt',
      access_token:  'at',
      scope:         'calendar',
      user_id:       'inject',
      admin:         true,
    }), res);
    assert.ok(capturedBody, 'fetch deve ter sido chamado');
    assert.ok(!('user_id' in capturedBody), 'user_id nao deve ser gravado');
    assert.ok(!('admin'   in capturedBody), 'admin nao deve ser gravado');
  });

  it('meta: campos extras nao sao gravados no Supabase', async () => {
    let capturedBody = null;
    global.fetch = async (_url, opts = {}) => {
      capturedBody = JSON.parse(opts?.body || '{}');
      return { ok: true, status: 200, headers: mockHeaders, json: async () => [{}] };
    };
    const res = makeRes();
    await handler(makeReq('POST', {
      servico: 'meta',
      access_token: 'EAAxxx',
      scope: 'pages_read',
      inject_sql: "'; DROP TABLE oauth_tokens;--",
    }), res);
    assert.ok(capturedBody);
    assert.ok(!('inject_sql' in capturedBody), 'inject_sql nao deve ser gravado');
  });

});

// ── Service role key ──────────────────────────────────────────────────────────

describe('/api/token/save — usa SUPABASE_SERVICE_ROLE_KEY', () => {

  it('UPSERT de google envia service role key como apikey', async () => {
    let capturedKey = null;
    global.fetch = async (_url, opts = {}) => {
      capturedKey = opts?.headers?.apikey ?? null;
      return { ok: true, status: 200, headers: mockHeaders, json: async () => [{}] };
    };
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'google', refresh_token: 'rt', access_token: 'at' }), res);
    assert.equal(capturedKey, SVC_KEY,
      `esperado service key, got "${capturedKey}"`);
  });

  it('UPSERT de meta envia service role key como apikey', async () => {
    let capturedKey = null;
    global.fetch = async (_url, opts = {}) => {
      capturedKey = opts?.headers?.apikey ?? null;
      return { ok: true, status: 200, headers: mockHeaders, json: async () => [{}] };
    };
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'meta', access_token: 'EAAxxx' }), res);
    assert.equal(capturedKey, SVC_KEY,
      `esperado service key, got "${capturedKey}"`);
  });

  it('falha clara quando SUPABASE_SERVICE_ROLE_KEY nao configurado', async () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    global.fetch = async () => ({ ok: true, status: 200, headers: mockHeaders, json: async () => [] });
    const res = makeRes();
    await handler(makeReq('POST', { servico: 'google', refresh_token: 'rt', access_token: 'at' }), res);
    assert.equal(res._status, 500);
    assert.ok(res._body?.error, 'deve retornar campo error');
    process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  });

});
