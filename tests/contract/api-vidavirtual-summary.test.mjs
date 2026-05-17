/**
 * tests/contract/api-vidavirtual-summary.test.mjs
 *
 * Contract tests for GET /api/vidavirtual/summary.
 * TDD: written before implementation.
 *
 * Run: node --test tests/contract/api-vidavirtual-summary.test.mjs
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.VIDAVIRTUAL_SUPABASE_URL     = 'https://gxavizwcpikvhrbwperg.supabase.co';
process.env.VIDAVIRTUAL_SERVICE_ROLE_KEY = 'test-service-role-key';

import handler from '../../api/vidavirtual/summary.js';

const _nativeFetch = global.fetch;

function mockRes() {
  const r = { _status: 200, _json: null };
  r.status = (s) => { r._status = s; return r; };
  r.json   = (b) => { r._json  = b; return r; };
  r.setHeader = () => r;
  r.end = () => r;
  return r;
}

const GET = { method: 'GET', headers: {}, body: {} };

function mockVVFetch(responses = {}) {
  global.fetch = async (url) => {
    const u = String(url);
    const key = u.includes('ordens_servico') ? 'os'
              : u.includes('aparelhos')      ? 'aparelhos'
              :                                'pagamentos';
    const r = responses[key];
    if (r === 'timeout') throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    if (r === '401') return { ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) };
    if (r === '404') return { ok: false, status: 404, json: async () => ({ error: 'table not found' }) };
    if (!r) return { ok: true, json: async () => [] };
    return { ok: true, json: async () => r };
  };
}

afterEach(() => { global.fetch = _nativeFetch; });

describe('GET /api/vidavirtual/summary — metodo errado', () => {

  it('retorna 405 para POST', async () => {
    const res = mockRes();
    await handler({ method: 'POST', headers: {}, body: {} }, res);
    assert.equal(res._status, 405);
  });

});

describe('GET /api/vidavirtual/summary — nao configurado', () => {

  it('retorna status nao_configurado quando VIDAVIRTUAL_SERVICE_ROLE_KEY ausente', async () => {
    const saved = process.env.VIDAVIRTUAL_SERVICE_ROLE_KEY;
    delete process.env.VIDAVIRTUAL_SERVICE_ROLE_KEY;
    const res = mockRes();
    await handler(GET, res);
    assert.equal(res._status, 200);
    assert.equal(res._json?.status, 'nao_configurado');
    assert.ok(res._json?.ts, 'deve retornar ts');
    process.env.VIDAVIRTUAL_SERVICE_ROLE_KEY = saved;
  });

});

describe('GET /api/vidavirtual/summary — online com dados', () => {

  it('retorna status ok com contagens corretas', async () => {
    mockVVFetch({
      os:        [{ count: '8' }],
      aparelhos: [{ count: '3' }],
      pagamentos:[{ count: '5' }],
    });
    const res = mockRes();
    await handler(GET, res);
    assert.equal(res._status, 200);
    assert.equal(res._json?.status, 'ok');
    assert.equal(res._json?.os_abertas, 8);
    assert.equal(res._json?.aparelhos_aguardando, 3);
    assert.equal(res._json?.pagamentos_pendentes, 5);
    assert.ok(res._json?.ts, 'deve retornar ts');
  });

  it('calcula os_atrasadas separadamente', async () => {
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('data_prometida')) return { ok: true, json: async () => [{ count: '2' }] };
      if (u.includes('ordens_servico')) return { ok: true, json: async () => [{ count: '6' }] };
      return { ok: true, json: async () => [{ count: '0' }] };
    };
    const res = mockRes();
    await handler(GET, res);
    assert.equal(res._json?.os_abertas, 6);
    assert.equal(res._json?.os_atrasadas, 2);
  });

});

describe('GET /api/vidavirtual/summary — sem dados', () => {

  it('retorna status sem_dados com zeros quando tabelas vazias', async () => {
    mockVVFetch({ os: [], aparelhos: [], pagamentos: [] });
    const res = mockRes();
    await handler(GET, res);
    assert.equal(res._json?.status, 'sem_dados');
    assert.equal(res._json?.os_abertas, 0);
    assert.equal(res._json?.os_atrasadas, 0);
    assert.equal(res._json?.aparelhos_aguardando, 0);
    assert.equal(res._json?.pagamentos_pendentes, 0);
  });

  it('retorna status sem_dados quando tabelas nao existem (404)', async () => {
    mockVVFetch({ os: '404' });
    const res = mockRes();
    await handler(GET, res);
    assert.equal(res._json?.status, 'sem_dados');
  });

});

describe('GET /api/vidavirtual/summary — offline', () => {

  it('retorna status offline quando fetch lanca timeout', async () => {
    mockVVFetch({ os: 'timeout' });
    const res = mockRes();
    await handler(GET, res);
    assert.equal(res._json?.status, 'offline');
  });

});

describe('GET /api/vidavirtual/summary — erro auth', () => {

  it('retorna status erro_auth quando Supabase retorna 401', async () => {
    mockVVFetch({ os: '401' });
    const res = mockRes();
    await handler(GET, res);
    assert.equal(res._json?.status, 'erro_auth');
  });

});
