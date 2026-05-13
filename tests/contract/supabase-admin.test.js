/**
 * tests/contract/supabase-admin.test.js
 *
 * Unit tests for api/_supabase-admin.js
 * Verifies that adminFetch uses SUPABASE_SERVICE_ROLE_KEY, never anon key.
 *
 * Run: node --test tests/contract/supabase-admin.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { adminFetch } from '../../api/_supabase-admin.js';

const SVC_KEY  = 'svc-key-SENTINEL-test';
const ANON_KEY = 'anon-key-SENTINEL-test';

const _nativeFetch = global.fetch;

before(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = SVC_KEY;
  process.env.SUPABASE_ANON_KEY         = ANON_KEY;
});

after(() => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  global.fetch = _nativeFetch;
});

afterEach(() => { global.fetch = _nativeFetch; });

// ── Suite: usa service role key nos headers ───────────────────────────────────

describe('adminFetch — usa SUPABASE_SERVICE_ROLE_KEY nos headers', () => {

  it('envia service role key como apikey', async () => {
    let capturedKey = null;
    global.fetch = async (url, opts = {}) => {
      capturedKey = opts?.headers?.apikey ?? null;
      return { ok: true, status: 200, json: async () => [] };
    };
    await adminFetch('/oauth_tokens?select=id&limit=1');
    assert.equal(capturedKey, SVC_KEY);
  });

  it('envia service role key como Authorization Bearer', async () => {
    let capturedAuth = null;
    global.fetch = async (url, opts = {}) => {
      capturedAuth = opts?.headers?.Authorization ?? null;
      return { ok: true, status: 200, json: async () => [] };
    };
    await adminFetch('/oauth_tokens?select=id&limit=1');
    assert.equal(capturedAuth, `Bearer ${SVC_KEY}`);
  });

  it('nao usa SUPABASE_ANON_KEY como apikey', async () => {
    let capturedKey = null;
    global.fetch = async (url, opts = {}) => {
      capturedKey = opts?.headers?.apikey ?? null;
      return { ok: true, status: 200, json: async () => [] };
    };
    await adminFetch('/oauth_tokens?select=id&limit=1');
    assert.notEqual(capturedKey, ANON_KEY);
  });

  it('constroi URL com o path passado', async () => {
    let capturedUrl = null;
    global.fetch = async (url, opts = {}) => {
      capturedUrl = String(url);
      return { ok: true, status: 200, json: async () => [] };
    };
    await adminFetch('/oauth_tokens?servico=eq.google&select=refresh_token&limit=1');
    assert.ok(capturedUrl.includes('oauth_tokens'), `URL deve conter oauth_tokens, got: ${capturedUrl}`);
    assert.ok(capturedUrl.includes('supabase.co'), `URL deve ser do Supabase, got: ${capturedUrl}`);
  });

  it('retorna array quando Supabase responde com dados', async () => {
    global.fetch = async () => ({
      ok: true, status: 200,
      json: async () => [{ id: 1, refresh_token: 'rt_test' }],
    });
    const result = await adminFetch('/oauth_tokens?select=id,refresh_token&limit=1');
    assert.ok(Array.isArray(result), 'deve retornar array');
    assert.equal(result[0].refresh_token, 'rt_test');
  });

  it('retorna null quando Supabase responde com erro', async () => {
    global.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'forbidden' }) });
    const result = await adminFetch('/oauth_tokens?select=id&limit=1');
    assert.equal(result, null);
  });

});

// ── Suite: falha clara se chave ausente ───────────────────────────────────────

describe('adminFetch — lanca Error se SUPABASE_SERVICE_ROLE_KEY nao configurado', () => {

  it('rejeita com Error mencionando SERVICE_ROLE_KEY', async () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await assert.rejects(
      () => adminFetch('/oauth_tokens?select=id&limit=1'),
      (err) => {
        assert.ok(err instanceof Error, 'deve ser instancia de Error');
        assert.ok(
          err.message.includes('SERVICE_ROLE_KEY'),
          `mensagem deve mencionar SERVICE_ROLE_KEY, got: "${err.message}"`
        );
        return true;
      }
    );

    process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  });

});
