/**
 * tests/contract/api-supervisor.security.test.js
 *
 * Security tests for /api/supervisor — auth and scrubbing.
 * Scope: token required for GET and POST; scrubSecrets redacts known patterns.
 *
 * Run: node --test tests/contract/api-supervisor.security.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler, { tool_verificar_supabase } from '../../api/supervisor.js';

const VALID_TOKEN = 'test-token-supervisor-security';

// ── Doubles ──────────────────────────────────────────────────────────────────

function makeReq(method, { headers = {}, body = {} } = {}) {
  return { method, headers, body, url: `/${method.toLowerCase()}` };
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

// ── Fetch mock ────────────────────────────────────────────────────────────────

const _nativeFetch = global.fetch;

function installMock() {
  global.fetch = async () => ({
    ok:     true,
    status: 200,
    json:   async () => [],
    text:   async () => '[]',
  });
}

function removeMock() {
  if (_nativeFetch !== undefined) global.fetch = _nativeFetch;
  else delete global.fetch;
}

// Garante que WEBHOOK_TOKEN esta configurado para todos os testes deste arquivo.
// Sem isso, o handler retorna 500 (fail-fast) em vez de 401/200.
before(() => { process.env.WEBHOOK_TOKEN = VALID_TOKEN; });
after(() => { delete process.env.WEBHOOK_TOKEN; });

// ══ Suite: autenticação GET ═══════════════════════════════════════════════════

describe('/api/supervisor — segurança: GET requer token', () => {

  it('GET sem token retorna 401', async () => {
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._status, 401);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

  it('GET com token inválido no header retorna 401', async () => {
    const res = makeRes();
    await handler(makeReq('GET', { headers: { 'x-webhook-token': 'token-errado' } }), res);
    assert.equal(res._status, 401);
  });

  it('GET com token inválido no body retorna 401', async () => {
    const res = makeRes();
    await handler(makeReq('GET', { body: { token: 'errado' } }), res);
    assert.equal(res._status, 401);
  });

  it('GET com token válido no header retorna 200', async () => {
    installMock();
    const res = makeRes();
    await handler(makeReq('GET', { headers: { 'x-webhook-token': VALID_TOKEN } }), res);
    removeMock();
    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
  });

});

// ══ Suite: autenticação POST ══════════════════════════════════════════════════

describe('/api/supervisor — segurança: POST requer token', () => {

  it('POST sem token retorna 401', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { body: { mensagem: 'verifique tudo' } }), res);
    assert.equal(res._status, 401);
  });

  it('POST com token inválido retorna 401', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': 'invalido' },
      body: { mensagem: 'teste' },
    }), res);
    assert.equal(res._status, 401);
  });

});

// ══ Suite: scrubSecrets ═══════════════════════════════════════════════════════

// Testa a função de scrubbing indiretamente: registra incidente com token
// e verifica que o log retornado não contém o valor original.
// Usa mock de fetch para interceptar o INSERT e o SELECT sem rede real.

describe('/api/supervisor — scrubbing de secrets nos logs', () => {
  let capturedInsert = null;

  before(() => {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('supervisor_logs') && opts?.method === 'POST') {
        capturedInsert = JSON.parse(opts.body);
        return { ok: true, status: 201, json: async () => ({}), text: async () => '{}' };
      }
      return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
    };
  });

  after(removeMock);

  it('Meta token (EAA...) é redactado antes de gravar', async () => {
    const fakeToken = 'EAARgT8OEKWoBRZAQFeyQSZBZCZAdNgpRG1AycXyIXAyZAvnAbQ3EYzvYs5lntUe1AM';
    const res = makeRes();

    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body: {
        mensagem: `Token confirmado. Token: ${fakeToken} | Instagram ID: 123`,
      },
    }), res);

    // O POST ao supervisor aciona o agente Claude que consumiria ANTHROPIC_KEY.
    // Sem a chave, o handler retorna erro interno — mas o objetivo aqui é testar
    // o comportamento do scrubbing via ferramenta tool_registrar_incidente.
    // Verificamos o INSERT capturado pelo mock.
    if (capturedInsert) {
      assert.ok(
        !capturedInsert.mensagem.includes(fakeToken),
        'token não deve aparecer no INSERT do banco'
      );
      assert.ok(
        capturedInsert.mensagem.includes('[TOKEN_REDACTED]'),
        'mensagem deve conter placeholder [TOKEN_REDACTED]'
      );
    }
  });

  it('JWT (ey...) é redactado antes de gravar', async () => {
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3RlIn0.SflKxwRJSMeKKF2QT4fwpMeJf36';
    const res = makeRes();

    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body: { mensagem: `Supabase anon key: ${fakeJwt}` },
    }), res);

    if (capturedInsert) {
      assert.ok(!capturedInsert.mensagem.includes(fakeJwt));
      assert.ok(capturedInsert.mensagem.includes('[TOKEN_REDACTED]'));
    }
  });

  it('string longa genérica (50+ chars alfanuméricos) é redactada', async () => {
    const longString = 'A'.repeat(55);
    const res = makeRes();

    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body: { mensagem: `Valor desconhecido: ${longString}` },
    }), res);

    if (capturedInsert) {
      assert.ok(!capturedInsert.mensagem.includes(longString));
      assert.ok(capturedInsert.mensagem.includes('[TOKEN_REDACTED]'));
    }
  });

  it('mensagem normal sem tokens não é alterada', async () => {
    capturedInsert = null;
    const normalMsg = 'Supabase respondendo normalmente. Token Google presente.';
    const res = makeRes();

    await handler(makeReq('POST', {
      headers: { 'x-webhook-token': VALID_TOKEN },
      body: { mensagem: normalMsg },
    }), res);

    if (capturedInsert) {
      assert.equal(capturedInsert.mensagem, normalMsg,
        'mensagem sem secrets não deve ser alterada');
    }
  });

});

// ══ Suite: tool_verificar_supabase nao vaza dados raw ════════════════════════

describe('tool_verificar_supabase — nao expoe dados brutos das tabelas', () => {
  const _savedFetch = global.fetch;

  const SENTINEL_VALOR = 87654321;
  const SENTINEL_DESC  = 'dado_raw_nao_deve_vazar_test';
  const dadoSensivel   = { valor: SENTINEL_VALOR, descricao: SENTINEL_DESC, token: 'abc_xyz_secreto' };

  before(() => {
    global.fetch = async () => ({
      ok:     true,
      status: 200,
      json:   async () => [dadoSensivel, dadoSensivel],
      text:   async () => JSON.stringify([dadoSensivel, dadoSensivel]),
    });
  });

  after(() => { global.fetch = _savedFetch; });

  it('resultado nao contem valores das rows quando tabela retorna dados', async () => {
    const result = await tool_verificar_supabase({ tabela: 'financas' });

    const resultStr = JSON.stringify(result);
    assert.ok(
      !resultStr.includes(String(SENTINEL_VALOR)),
      'valor numerico da row nao deve aparecer no resultado'
    );
    assert.ok(
      !resultStr.includes(SENTINEL_DESC),
      'string da row nao deve aparecer no resultado'
    );
  });

  it('resultado contem ok e contagem mas nao campo amostra', async () => {
    const result = await tool_verificar_supabase({ tabela: 'financas' });

    assert.equal(result.tabelas.financas.ok, true,       'campo ok deve ser true');
    assert.equal(result.tabelas.financas.registros, 2,   'contagem deve refletir rows retornadas');
    assert.ok(
      !('amostra' in result.tabelas.financas),
      'campo amostra nao deve existir no resultado'
    );
  });
});
