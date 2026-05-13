/**
 * tests/contract/api-service-role.security.test.js
 *
 * Security contract: all backend reads of oauth_tokens must use
 * SUPABASE_SERVICE_ROLE_KEY, never SUPABASE_ANON_KEY.
 *
 * Run: node --test tests/contract/api-service-role.security.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import calendarHandler      from '../../api/google/calendar.js';
import driveHandler         from '../../api/google/drive.js';
import gmailHandler         from '../../api/google/gmail.js';
import calendarCreateHandler from '../../api/google/calendar-create.js';
import assistenteHandler    from '../../api/assistente.js';
import comandosHandler      from '../../api/comandos.js';
import supervisorHandler    from '../../api/supervisor.js';
import cronHandler          from '../../api/cron.js';

const SVC_KEY      = 'svc-key-SENTINEL-service-role';
const ANON_KEY     = 'anon-key-SENTINEL-must-not-appear';
const WEBHOOK_TOKEN = 'test-webhook-token-sr';

const _nativeFetch = global.fetch;

function makeReq(method, { body = {}, headers = {}, query = {} } = {}) {
  return { method, body, headers, query };
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

function makeMock(captureRef) {
  return async (url, opts = {}) => {
    const u = String(url);

    if (u.includes('oauth_tokens')) {
      captureRef.key = opts?.headers?.apikey ?? null;
      return {
        ok: true, status: 200, headers: mockHeaders,
        json:  async () => [{ refresh_token: 'rt_sentinel', access_token: 'at_sentinel' }],
        text:  async () => '[{"refresh_token":"rt_sentinel","access_token":"at_sentinel"}]',
      };
    }

    if (u.includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, headers: mockHeaders,
        json: async () => ({ access_token: 'at_new_test', expires_in: 3600 }),
        text: async () => '' };
    }

    if (u.includes('googleapis.com') || u.includes('mybusiness')) {
      return { ok: true, status: 200, headers: mockHeaders,
        json: async () => ({ items: [], files: [], messages: [], events: [], accounts: [], locations: [] }),
        text: async () => '[]' };
    }

    if (u.includes('anthropic.com')) {
      return { ok: false, status: 401, headers: mockHeaders,
        json: async () => ({ type: 'error', error: { type: 'authentication_error' } }),
        text: async () => 'unauthorized' };
    }

    // Default: Supabase table read returns empty array
    return { ok: true, status: 200, headers: mockHeaders,
      json:  async () => [],
      text:  async () => '[]' };
  };
}

before(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = SVC_KEY;
  process.env.SUPABASE_ANON_KEY         = ANON_KEY;
  process.env.GOOGLE_CLIENT_ID          = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET      = 'test-client-secret';
  process.env.WEBHOOK_TOKEN             = WEBHOOK_TOKEN;
  process.env.ANTHROPIC_API_KEY         = 'test-anthropic-key';
});

after(() => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.WEBHOOK_TOKEN;
  delete process.env.ANTHROPIC_API_KEY;
  global.fetch = _nativeFetch;
});

afterEach(() => { global.fetch = _nativeFetch; });

// ── api/google/calendar.js ────────────────────────────────────────────────────

describe('api/google/calendar — oauth_tokens usa service_role key', () => {
  it('POST: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY como apikey', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await calendarHandler(makeReq('POST'), makeRes());
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar fetchRefreshToken() para adminFetch.`);
  });
});

// ── api/google/drive.js ───────────────────────────────────────────────────────

describe('api/google/drive — oauth_tokens usa service_role key', () => {
  it('POST: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY como apikey', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await driveHandler(makeReq('POST'), makeRes());
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar fetchRefreshToken() para adminFetch.`);
  });
});

// ── api/google/gmail.js ───────────────────────────────────────────────────────

describe('api/google/gmail — oauth_tokens usa service_role key', () => {
  it('POST: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY como apikey', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await gmailHandler(makeReq('POST'), makeRes());
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar fetchRefreshToken() para adminFetch.`);
  });
});

// ── api/google/calendar-create.js ────────────────────────────────────────────

describe('api/google/calendar-create — oauth_tokens usa service_role key', () => {
  it('POST: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY como apikey', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await calendarCreateHandler(
      makeReq('POST', { body: { title: 'Reuniao', date: '2026-05-13', time: '14:00' } }),
      makeRes()
    );
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar fetchRefreshToken() para adminFetch.`);
  });
});

// ── api/assistente.js ─────────────────────────────────────────────────────────

describe('api/assistente — oauth_tokens usa service_role key', () => {
  it('lerCalendario: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await assistenteHandler(
      makeReq('POST', {
        body:    { q: 'agenda de hoje' },
        headers: { 'x-webhook-token': WEBHOOK_TOKEN },
      }),
      makeRes()
    );
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar lerCalendario() para adminFetch.`);
  });
});

// ── api/comandos.js ───────────────────────────────────────────────────────────

describe('api/comandos — oauth_tokens usa service_role key', () => {
  it('handleAgenda: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await comandosHandler(
      makeReq('POST', {
        body:    { comando: 'agenda' },
        headers: { 'x-webhook-token': WEBHOOK_TOKEN },
      }),
      makeRes()
    );
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar getGoogleRefreshToken() para adminFetch.`);
  });
});

// ── api/supervisor.js ─────────────────────────────────────────────────────────

describe('api/supervisor — oauth_tokens usa service_role key', () => {
  it('GET saude: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await supervisorHandler(
      makeReq('GET', {
        headers: { 'x-webhook-token': WEBHOOK_TOKEN },
      }),
      makeRes()
    );
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar tool_verificar_saude_servicos() e getRefreshToken() para adminFetch.`);
  });
});

// ── api/cron.js ───────────────────────────────────────────────────────────────

describe('api/cron — oauth_tokens usa service_role key', () => {
  it('reviews: fetch de oauth_tokens usa SUPABASE_SERVICE_ROLE_KEY', async () => {
    const cap = {};
    global.fetch = makeMock(cap);
    await cronHandler(makeReq('GET', { query: { tipo: 'reviews' } }), makeRes());
    assert.equal(cap.key, SVC_KEY,
      `esperado service key, got "${cap.key}". Migrar runReviews() para adminFetch.`);
  });
});
