/**
 * tests/contract/api-gmail.security.test.js
 *
 * Security tests for /api/google/gmail
 * - Response must NOT contain newAccessToken (access_token exposure)
 * - refresh_token must NOT be accepted from request body (server reads from Supabase)
 * - Clear 401 when Supabase has no google token
 *
 * Run: node --test tests/contract/api-gmail.security.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/google/gmail.js';

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

function installSuccessMock() {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('supabase') && u.includes('oauth_tokens')) {
      return { ok: true, status: 200, json: async () => [{ refresh_token: 'rt_sentinel_gmail' }], text: async () => '' };
    }
    if (u.includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'at_sentinel_gmail', expires_in: 3600 }), text: async () => '' };
    }
    if (u.includes('gmail.googleapis.com') && u.includes('messages') && !u.match(/messages\/[^?]+/)) {
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: 'msg1' }], resultSizeEstimate: 1 }), text: async () => '' };
    }
    if (u.includes('gmail.googleapis.com') && u.match(/messages\/[^?]+/)) {
      return {
        ok: true, status: 200, json: async () => ({
          id: 'msg1',
          snippet: 'Teste de email',
          payload: { headers: [
            { name: 'From',    value: 'fulano@example.com' },
            { name: 'Subject', value: 'Assunto teste' },
            { name: 'Date',    value: 'Wed, 14 May 2026 10:00:00 -0300' },
          ]},
        }), text: async () => '',
      };
    }
    return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
  };
}

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

// ══ Suite: resposta nao expoe tokens ══════════════════════════════════════════

describe('/api/google/gmail — resposta nao expoe tokens', () => {

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
      !bodyStr.includes('at_sentinel_gmail'),
      'access_token nao deve aparecer na resposta'
    );
  });

});

// ══ Suite: token lido server-side ═════════════════════════════════════════════

describe('/api/google/gmail — token lido do Supabase, nao do body', () => {

  it('funciona com body vazio — sem refresh_token enviado pelo browser', async () => {
    installSuccessMock();
    const res = makeRes();
    await handler(makeReq('POST', {}), res);
    assert.equal(res._status, 200);
    assert.ok(Array.isArray(res._body?.emails), 'deve retornar campo emails como array');
  });

  it('refresh_token no body e ignorado — Supabase e a unica fonte', async () => {
    installSuccessMock();
    const res = makeRes();
    await handler(makeReq('POST', { refresh_token: 'rt_from_browser_must_be_ignored' }), res);
    assert.equal(res._status, 200);
    assert.ok(Array.isArray(res._body?.emails));
  });

  it('retorna emails com campos from, subject, date, snippet, link', async () => {
    installSuccessMock();
    const res = makeRes();
    await handler(makeReq('POST', {}), res);
    assert.equal(res._status, 200);
    assert.ok(res._body?.emails?.length >= 1);
    const email = res._body.emails[0];
    assert.ok('from'    in email, 'campo from presente');
    assert.ok('subject' in email, 'campo subject presente');
    assert.ok('link'    in email, 'campo link presente');
  });

});

// ══ Suite: 401 claro quando token ausente ═════════════════════════════════════

describe('/api/google/gmail — 401 quando Supabase nao tem token google', () => {

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

// ══ Suite: GET health check ═══════════════════════════════════════════════════

describe('/api/google/gmail — GET health check', () => {

  it('GET retorna 200 com ok:true', async () => {
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
  });

});
