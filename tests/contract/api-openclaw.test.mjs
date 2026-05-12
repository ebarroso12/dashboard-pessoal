/**
 * tests/contract/api-openclaw.test.mjs
 *
 * Contract tests for api/lib/openclaw.js — sendWhatsApp via Meta WA API.
 * Sem deps externas, sem servidor real.
 *
 * Run: node --test tests/contract/api-openclaw.test.mjs
 */

import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath   = path.join(__dirname, '../../api/lib/openclaw.js');

// Importacao unica — sendWhatsApp le process.env em tempo de chamada
import { sendWhatsApp } from '../../api/lib/openclaw.js';

const _nativeFetch = global.fetch;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('sendWhatsApp — Meta WA API', () => {

  before(() => {
    process.env.WA_BUSINESS_PHONE_ID = '607518142444507';
  });

  afterEach(() => {
    global.fetch = _nativeFetch;
    delete process.env.WA_BUSINESS_TOKEN;
  });

  // ── Token ausente ──────────────────────────────────────────────────────────

  it('throws quando WA_BUSINESS_TOKEN esta vazio', async () => {
    process.env.WA_BUSINESS_TOKEN = '';
    await assert.rejects(
      () => sendWhatsApp('5511999999999', 'hello'),
      /WA_BUSINESS_TOKEN/
    );
  });

  // ── URL correta ────────────────────────────────────────────────────────────

  it('chama graph.facebook.com/v19.0/{phoneId}/messages', async () => {
    process.env.WA_BUSINESS_TOKEN = 'test-token';
    let calledUrl = '';
    global.fetch = async (url) => {
      calledUrl = String(url);
      return { ok: true, json: async () => ({ messages: [{ id: 'wamid.x' }] }) };
    };
    await sendWhatsApp('5511999999999', 'hello');
    assert.ok(
      calledUrl.includes('graph.facebook.com/v19.0/607518142444507/messages'),
      `URL incorreta: ${calledUrl}`
    );
  });

  // ── Authorization header ───────────────────────────────────────────────────

  it('envia Authorization: Bearer {token}', async () => {
    process.env.WA_BUSINESS_TOKEN = 'my-secret-token';
    let sentAuth = '';
    global.fetch = async (_url, opts) => {
      sentAuth = opts.headers['Authorization'] ?? opts.headers['authorization'] ?? '';
      return { ok: true, json: async () => ({ messages: [{ id: 'x' }] }) };
    };
    await sendWhatsApp('5511999999999', 'hello');
    assert.equal(sentAuth, 'Bearer my-secret-token');
  });

  // ── Normalizacao de numero ─────────────────────────────────────────────────

  it('remove nao-digitos do numero antes de enviar', async () => {
    process.env.WA_BUSINESS_TOKEN = 'test-token';
    let sentTo = '';
    global.fetch = async (_url, opts) => {
      sentTo = JSON.parse(opts.body).to;
      return { ok: true, json: async () => ({ messages: [{ id: 'x' }] }) };
    };
    await sendWhatsApp('+55 (11) 9 9999-9999', 'test');
    assert.equal(sentTo, '5511999999999'); // 55+11+9+9999+9999 = 13 digitos
  });

  // ── Retorno em sucesso ─────────────────────────────────────────────────────

  it('retorna dados da API em sucesso', async () => {
    process.env.WA_BUSINESS_TOKEN = 'test-token';
    global.fetch = async () => ({
      ok:   true,
      json: async () => ({ messages: [{ id: 'wamid.abc' }] }),
    });
    const result = await sendWhatsApp('5511999999999', 'hello');
    assert.equal(result.messages[0].id, 'wamid.abc');
  });

  // ── Erro da API ────────────────────────────────────────────────────────────

  it('throws quando API retorna erro com message', async () => {
    process.env.WA_BUSINESS_TOKEN = 'test-token';
    global.fetch = async () => ({
      ok:     false,
      status: 400,
      json:   async () => ({ error: { message: 'Invalid phone number' } }),
    });
    await assert.rejects(
      () => sendWhatsApp('invalid', 'hello'),
      /Invalid phone number/
    );
  });

  it('throws com status quando API retorna erro sem message', async () => {
    process.env.WA_BUSINESS_TOKEN = 'test-token';
    global.fetch = async () => ({
      ok:     false,
      status: 500,
      json:   async () => ({}),
    });
    await assert.rejects(
      () => sendWhatsApp('5511999999999', 'hello'),
      /500/
    );
  });

  // ── Sem WebSocket ──────────────────────────────────────────────────────────

  it('nao importa WebSocket nem ws (OpenClaw abandonado)', () => {
    const src = readFileSync(srcPath, 'utf8');
    assert.ok(!src.includes('WebSocket'),       'nao deve conter WebSocket');
    assert.ok(!src.includes("from 'ws'"),       "nao deve importar 'ws'");
    assert.ok(!src.includes("require('ws')"),   "nao deve usar require('ws')");
    assert.ok(!src.includes('wss://'),          'nao deve conter URL WebSocket');
  });

});
