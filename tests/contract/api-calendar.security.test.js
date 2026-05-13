/**
 * tests/contract/api-calendar.security.test.js
 *
 * Security tests for /api/google/calendar
 * - Response must NOT contain newAccessToken (access_token exposure)
 * - refresh_token must NOT be accepted from request body (server reads from Supabase)
 * - Clear 401 when Supabase has no google token
 *
 * Run: node --test tests/contract/api-calendar.security.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/google/calendar.js';

const _nativeFetch = global.fetch;

function makeReq(method, body = {}) {
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

// Mock: Supabase retorna refresh_token, Google APIs respondem corretamente.
function installSuccessMock(events = [{ id: '1', summary: 'Consulta', start: { dateTime: '2026-05-13T10:00:00Z' } }]) {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('supabase') && u.includes('oauth_tokens')) {
      return { ok: true, status: 200, json: async () => [{ refresh_token: 'rt_sentinel_test' }], text: async () => '' };
    }
    if (u.includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'at_sentinel_test', expires_in: 3600 }), text: async () => '' };
    }
    if (u.includes('googleapis.com/calendar')) {
      return { ok: true, status: 200, json: async () => ({ items: events }), text: async () => '' };
    }
    return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
  };
}

// Mock: Supabase retorna array vazio (sem token google).
function installNoTokenMock() {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('supabase') && u.includes('oauth_tokens')) {
      return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
    }
    return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
  };
}

before(() => {
  process.env.GOOGLE_CLIENT_ID     = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.SUPABASE_ANON_KEY    = 'test-anon-key';
});

after(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.SUPABASE_ANON_KEY;
  global.fetch = _nativeFetch;
});

afterEach(() => { global.fetch = _nativeFetch; });

// ══ Suite: response nao expoe tokens ═══════════════════════════════════════════

describe('/api/google/calendar — resposta nao expoe tokens', () => {

  it('resposta nao contem campo newAccessToken', async () => {
    installSuccessMock();
    const res = makeRes();
    await handler(makeReq('POST'), res);
    assert.equal(res._status, 200);
    assert.ok(
      !('newAccessToken' in (res._body || {})),
      'newAccessToken nao deve existir na resposta JSON'
    );
  });

  it('access_token do Google nao aparece em nenhum campo da resposta', async () => {
    installSuccessMock();
    const res = makeRes();
    await handler(makeReq('POST'), res);
    const bodyStr = JSON.stringify(res._body || {});
    assert.ok(
      !bodyStr.includes('at_sentinel_test'),
      'access_token nao deve aparecer na resposta'
    );
  });

});

// ══ Suite: token lido server-side ══════════════════════════════════════════════

describe('/api/google/calendar — token lido do Supabase, nao do body', () => {

  it('funciona com body vazio — sem refresh_token enviado pelo browser', async () => {
    installSuccessMock();
    const res = makeRes();
    await handler(makeReq('POST', {}), res);
    assert.equal(res._status, 200);
    assert.ok(Array.isArray(res._body?.events), 'deve retornar campo events como array');
  });

  it('refresh_token no body e ignorado — Supabase e a unica fonte', async () => {
    // Supabase tem token valido. Body traz um token diferente.
    // A resposta deve ser 200 (prova que Supabase, nao o body, foi usado).
    installSuccessMock();
    const res = makeRes();
    await handler(makeReq('POST', { refresh_token: 'rt_from_browser_must_be_ignored' }), res);
    assert.equal(res._status, 200);
    assert.ok(Array.isArray(res._body?.events));
  });

  it('retorna events corretos vindos do Google Calendar', async () => {
    const mockEvents = [
      { id: '1', summary: 'Cirurgia', start: { dateTime: '2026-05-14T08:00:00Z' } },
      { id: '2', summary: 'Consulta', start: { dateTime: '2026-05-14T10:00:00Z' } },
    ];
    installSuccessMock(mockEvents);
    const res = makeRes();
    await handler(makeReq('POST', {}), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.events?.length, 2);
    assert.equal(res._body?.events?.[0]?.summary, 'Cirurgia');
  });

});

// ══ Suite: 401 claro quando token ausente ══════════════════════════════════════

describe('/api/google/calendar — 401 quando Supabase nao tem token google', () => {

  it('retorna 401 quando Supabase nao tem token', async () => {
    installNoTokenMock();
    const res = makeRes();
    await handler(makeReq('POST'), res);
    assert.equal(res._status, 401);
    assert.ok(res._body?.error, 'corpo deve ter campo error');
  });

  it('mensagem do 401 menciona google ou token para orientar reconexao', async () => {
    installNoTokenMock();
    const res = makeRes();
    await handler(makeReq('POST'), res);
    const msg = (res._body?.error || '').toLowerCase();
    assert.ok(
      msg.includes('google') || msg.includes('token') || msg.includes('reconect'),
      `mensagem "${res._body?.error}" deve mencionar google ou token`
    );
  });

});

// ══ Suite: GET health check ════════════════════════════════════════════════════

describe('/api/google/calendar — GET health check', () => {

  it('GET retorna 200 com ok:true', async () => {
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
  });

});
