/**
 * tests/contract/api-briefing-send.test.mjs
 *
 * Contract tests for POST /api/openclaw/briefing/send.
 * TDD: written before implementation.
 *
 * Run: node --test tests/contract/api-briefing-send.test.mjs
 */

import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Set env vars BEFORE importing the handler
process.env.WA_BUSINESS_TOKEN        = 'test-wa-token';
process.env.WA_BUSINESS_PHONE_ID     = '607518142444507';
process.env.PHONE_BRIEFING           = '5514999999999';
process.env.WEBHOOK_TOKEN            = 'test-webhook-secret';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role';
process.env.RETRY_DELAY_MS           = '0';

import handler from '../../api/openclaw/briefing/send.js';

const _nativeFetch = global.fetch;

function mockRes() {
  const r = { _status: 200, _json: null };
  r.status = (s) => { r._status = s; return r; };
  r.json   = (b) => { r._json  = b; return r; };
  r.setHeader = () => r;
  r.end = () => r;
  return r;
}

function mockReq(overrides = {}) {
  return {
    method:  'POST',
    headers: { 'x-webhook-token': 'test-webhook-secret' },
    body:    {},
    url:     '/api/openclaw/briefing/send',
    ...overrides,
  };
}

function mockFetch({ briefingText = 'Briefing test', briefingOk = true, waOk = true, waFailFirst = false } = {}) {
  let waAttempt = 0;
  global.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/api/briefing')) {
      if (!briefingOk) throw new Error('briefing timeout');
      return { ok: true, json: async () => ({ briefing: briefingText, gerado_em: '2026-01-01T08:00:00Z', fontes: ['tarefas'] }) };
    }
    if (u.includes('graph.facebook.com')) {
      waAttempt++;
      if (!waOk || (waFailFirst && waAttempt === 1)) {
        return { ok: false, status: 503, json: async () => ({ error: { message: 'Service unavailable' } }) };
      }
      return { ok: true, json: async () => ({ messages: [{ id: 'wamid.TEST' + waAttempt }] }) };
    }
    if (u.includes('supabase.co')) {
      return { ok: true, json: async () => null, text: async () => '' };
    }
    throw new Error('Unexpected fetch URL: ' + u);
  };
}

afterEach(() => { global.fetch = _nativeFetch; });

describe('POST /api/openclaw/briefing/send — autenticacao', () => {

  it('retorna 405 para metodo GET', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {}, body: {} }, res);
    assert.equal(res._status, 405);
  });

  it('retorna 401 quando token ausente', async () => {
    const res = mockRes();
    await handler(mockReq({ headers: {} }), res);
    assert.equal(res._status, 401);
  });

  it('retorna 401 quando token errado', async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { 'x-webhook-token': 'wrong-token' } }), res);
    assert.equal(res._status, 401);
  });

});

describe('POST /api/openclaw/briefing/send — envio OK', () => {

  it('retorna ok:true e status "enviado" quando briefing e WA funcionam', async () => {
    mockFetch({ briefingText: 'Briefing do dia: agenda OK.' });
    const res = mockRes();
    await handler(mockReq(), res);
    assert.equal(res._status, 200);
    assert.equal(res._json?.ok, true);
    assert.equal(res._json?.status, 'enviado');
    assert.ok(res._json?.wa_id, 'deve retornar wa_id');
    assert.ok(res._json?.ts,    'deve retornar ts');
  });

  it('wa_id contem o id retornado pela Meta API', async () => {
    mockFetch({ briefingText: 'Briefing OK' });
    const res = mockRes();
    await handler(mockReq(), res);
    assert.equal(res._json?.wa_id, 'wamid.TEST1');
  });

});

describe('POST /api/openclaw/briefing/send — retry unico', () => {

  it('retorna status "enviado_retry" quando primeira tentativa WA falha mas retry OK', async () => {
    mockFetch({ waFailFirst: true });
    const res = mockRes();
    await handler(mockReq(), res);
    assert.equal(res._status, 200);
    assert.equal(res._json?.ok, true);
    assert.equal(res._json?.status, 'enviado_retry');
  });

  it('retorna ok:false e status "falhou" quando WA offline em ambas tentativas', async () => {
    mockFetch({ waOk: false });
    const res = mockRes();
    await handler(mockReq(), res);
    assert.equal(res._status, 502);
    assert.equal(res._json?.ok, false);
    assert.equal(res._json?.status, 'falhou');
    assert.ok(res._json?.erro, 'deve retornar mensagem de erro');
  });

  it('erro mascarado: nao expoe tokens no campo "erro"', async () => {
    global.fetch = async (url) => {
      if (String(url).includes('/api/briefing'))
        return { ok: true, json: async () => ({ briefing: 'texto', gerado_em: '', fontes: [] }) };
      if (String(url).includes('graph.facebook.com'))
        return { ok: false, status: 401, json: async () => ({ error: { message: 'Bearer abc123secret invalid' } }) };
      return { ok: true, json: async () => null, text: async () => '' };
    };
    const res = mockRes();
    await handler(mockReq(), res);
    assert.ok(!res._json?.erro?.includes('abc123secret'), 'token nao deve aparecer no erro retornado');
  });

});

describe('POST /api/openclaw/briefing/send — briefing vazio ou timeout', () => {

  it('retorna ok:false status "briefing_vazio" quando briefing retorna string vazia', async () => {
    mockFetch({ briefingText: '' });
    const res = mockRes();
    await handler(mockReq(), res);
    assert.equal(res._json?.ok, false);
    assert.equal(res._json?.status, 'briefing_vazio');
  });

  it('retorna 500 status "erro_briefing" quando /api/briefing lanca excecao', async () => {
    mockFetch({ briefingOk: false });
    const res = mockRes();
    await handler(mockReq(), res);
    assert.equal(res._status, 500);
    assert.equal(res._json?.status, 'erro_briefing');
  });

});
