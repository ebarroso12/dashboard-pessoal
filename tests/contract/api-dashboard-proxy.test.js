/**
 * tests/contract/api-dashboard-proxy.test.js
 *
 * Contract tests for api/dashboard-proxy.js
 * Run: node --test tests/contract/api-dashboard-proxy.test.js
 */

import { describe, it, before, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/dashboard-proxy.js';

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

// ── CORS ──────────────────────────────────────────────────────────────────────

describe('dashboard-proxy — CORS', () => {

  after(() => { delete process.env.WEBHOOK_TOKEN; });

  it('define Access-Control-Allow-Origin para o dominio do dashboard', async () => {
    process.env.WEBHOOK_TOKEN = 'test-token';
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    global.fetch = _nativeFetch;
    assert.equal(
      res._headers['Access-Control-Allow-Origin'],
      'https://dashboard-pessoal-edson.vercel.app'
    );
  });

  it('OPTIONS retorna 204', async () => {
    const res = makeRes();
    await handler(makeReq('OPTIONS'), res);
    assert.equal(res._status, 204);
  });

});

// ── Metodo ────────────────────────────────────────────────────────────────────

describe('dashboard-proxy — metodo', () => {

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

});

// ── WEBHOOK_TOKEN ausente ─────────────────────────────────────────────────────

describe('dashboard-proxy — fail-fast sem WEBHOOK_TOKEN', () => {

  before(() => { delete process.env.WEBHOOK_TOKEN; });

  it('retorna 500 quando WEBHOOK_TOKEN nao esta configurado', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    assert.equal(res._status, 500);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

});

// ── Whitelist de actions ──────────────────────────────────────────────────────

describe('dashboard-proxy — whitelist de actions', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('action ausente retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {}), res);
    assert.equal(res._status, 400);
  });

  it('action desconhecida retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'delete-everything' }), res);
    assert.equal(res._status, 400);
  });

});

// ── Validacao de payload por action ──────────────────────────────────────────

describe('dashboard-proxy — validacao de payload', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('assistente sem q retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'assistente', payload: { origem: 'test' } }), res);
    assert.equal(res._status, 400);
  });

  it('assistente com q vazio retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'assistente', payload: { q: '' } }), res);
    assert.equal(res._status, 400);
  });

  it('supervisor-chat sem mensagem retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-chat', payload: {} }), res);
    assert.equal(res._status, 400);
  });

  it('supervisor-chat com mensagem vazia retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-chat', payload: { mensagem: '' } }), res);
    assert.equal(res._status, 400);
  });

});

// ── Strip de campos extras ────────────────────────────────────────────────────

describe('dashboard-proxy — strip de campos extras no payload', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('assistente: campos extras sao descartados antes de repassar ao target', async () => {
    let capturedBody = null;
    global.fetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ok: true, resposta: 'ok' }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', {
      action: 'assistente',
      payload: { q: 'oi', origem: 'test', campo_extra: 'injecao', outro: 99 },
    }), res);
    assert.ok(capturedBody, 'fetch deve ter sido chamado');
    assert.equal(capturedBody.q, 'oi');
    assert.equal(capturedBody.origem, 'test');
    assert.ok(!('campo_extra' in capturedBody), 'campo_extra nao deve ser repassado');
    assert.ok(!('outro' in capturedBody), 'outro nao deve ser repassado');
  });

  it('supervisor-chat: campos extras sao descartados', async () => {
    let capturedBody = null;
    global.fetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', {
      action: 'supervisor-chat',
      payload: { mensagem: 'teste', historico: [], injecao: true },
    }), res);
    assert.ok(capturedBody);
    assert.equal(capturedBody.mensagem, 'teste');
    assert.ok(!('injecao' in capturedBody), 'injecao nao deve ser repassada');
  });

});

// ── supervisor-status: GET sem body ──────────────────────────────────────────

describe('dashboard-proxy — supervisor-status', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('supervisor-status envia GET ao supervisor sem body', async () => {
    let calledMethod = null;
    let calledBody   = undefined;
    global.fetch = async (_url, opts) => {
      calledMethod = opts.method;
      calledBody   = opts.body;
      return { ok: true, status: 200, json: async () => ({ ok: true, saude: {} }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    assert.equal(calledMethod, 'GET');
    assert.equal(calledBody, undefined);
  });

  it('supervisor-status repassa status e body do target', async () => {
    global.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, saude: { supabase: { ok: true } } }),
    });
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
  });

});

// ── Token no header interno ───────────────────────────────────────────────────

describe('dashboard-proxy — WEBHOOK_TOKEN no header interno', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'meu-token-real'; });
  after(() => { delete process.env.WEBHOOK_TOKEN; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('repassa X-Webhook-Token no header da chamada interna', async () => {
    let capturedToken = null;
    global.fetch = async (_url, opts) => {
      capturedToken = opts.headers['X-Webhook-Token'];
      return { ok: true, status: 200, json: async () => ({ ok: true, resposta: 'ok' }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', { action: 'assistente', payload: { q: 'teste' } }), res);
    assert.equal(capturedToken, 'meu-token-real');
  });

});
