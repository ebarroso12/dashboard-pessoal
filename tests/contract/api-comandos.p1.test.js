/**
 * tests/contract/api-comandos.p1.test.js
 *
 * P1 handler tests for /api/comandos
 * Scope: ajuda (static), agenda (no Google token), resumo (all-empty mocks)
 * All Supabase and Google calls intercepted via global.fetch mock.
 *
 * Run: node --test tests/contract/api-comandos.p1.test.js
 * Requires: Node >= 18 (node:test), no external deps.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/comandos.js';

const VALID_TOKEN = process.env.WEBHOOK_TOKEN ?? 'oc_edson_2026_secure';

// ── Test doubles ──────────────────────────────────────────────────────────────

function makeReq(method, { headers = {}, body = {} } = {}) {
  return { method, headers, body };
}

function makeRes() {
  const res = {
    _status: null,
    _body:   null,
    _headers: {},
    status(code)    { this._status = code; return this; },
    json(data)      { this._body   = data; return this; },
    end()           { return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
  return res;
}

function postCmd(texto) {
  return makeReq('POST', {
    headers: { 'x-webhook-token': VALID_TOKEN },
    body: { texto },
  });
}

// ── Fetch mock ────────────────────────────────────────────────────────────────

const _nativeFetch = global.fetch;

/**
 * Instala mock de fetch.
 * overrides: array de [pattern, data] — primeiro match por substring de URL ganha.
 * Default (sem match): retorna [] simulando tabela Supabase vazia.
 */
function installMock(overrides = []) {
  global.fetch = async (url) => {
    const u = String(url);
    for (const [pattern, data] of overrides) {
      if (u.includes(pattern)) {
        return fakeOk(data);
      }
    }
    return fakeOk([]);
  };
}

function fakeOk(data) {
  return {
    ok:     true,
    status: 200,
    json:   async () => data,
    text:   async () => JSON.stringify(data),
  };
}

function removeMock() {
  if (_nativeFetch !== undefined) global.fetch = _nativeFetch;
  else delete global.fetch;
}

// ══ Suite P1: ajuda ═══════════════════════════════════════════════════════════

describe('/api/comandos — P1: ajuda', () => {

  it('lista todos os 9 grupos de comando na resposta', async () => {
    const res = makeRes();
    await handler(postCmd('ajuda'), res);
    const r = res._body.resposta;

    assert.equal(res._status, 200);
    assert.equal(res._body.ok, true);
    for (const cmd of ['agenda', 'emails', 'drive', 'tarefas', 'financas', 'metas', 'resumo', 'alertas', 'ajuda']) {
      assert.ok(r.includes(cmd), `menu deve listar "${cmd}"`);
    }
  });

  it('resposta começa com o emoji de bot 🤖', async () => {
    const res = makeRes();
    await handler(postCmd('ajuda'), res);
    assert.ok(res._body.resposta.startsWith('🤖'));
  });

  it('alias "menu" retorna o mesmo conteúdo que "ajuda"', async () => {
    const r1 = makeRes(); await handler(postCmd('ajuda'), r1);
    const r2 = makeRes(); await handler(postCmd('menu'),  r2);
    assert.equal(r1._body.resposta, r2._body.resposta);
  });

  it('alias "comandos" retorna o mesmo conteúdo que "ajuda"', async () => {
    const r1 = makeRes(); await handler(postCmd('ajuda'),    r1);
    const r2 = makeRes(); await handler(postCmd('comandos'), r2);
    assert.equal(r1._body.resposta, r2._body.resposta);
  });

  it('alias "help" retorna o mesmo conteúdo que "ajuda"', async () => {
    const r1 = makeRes(); await handler(postCmd('ajuda'), r1);
    const r2 = makeRes(); await handler(postCmd('help'),  r2);
    assert.equal(r1._body.resposta, r2._body.resposta);
  });

  it('ajuda não dispara nenhuma chamada fetch (função pura)', async () => {
    let called = false;
    global.fetch = async () => { called = true; return fakeOk([]); };

    const res = makeRes();
    await handler(postCmd('ajuda'), res);

    removeMock();
    assert.equal(called, false, 'handleAjuda() não deve chamar fetch');
  });

});

// ══ Suite P1: agenda — sem token Google ═══════════════════════════════════════

describe('/api/comandos — P1: agenda sem token Google', () => {

  // oauth_tokens retorna vazio — nenhum token Google cadastrado
  before(() => installMock([['oauth_tokens', []]]));
  after(removeMock);

  it('retorna HTTP 200 mesmo sem token Google', async () => {
    const res = makeRes();
    await handler(postCmd('agenda'), res);
    assert.equal(res._status, 200);
    assert.equal(res._body.ok, true);
  });

  it('resposta começa com emoji 📅', async () => {
    const res = makeRes();
    await handler(postCmd('agenda'), res);
    assert.ok(res._body.resposta.startsWith('📅'));
  });

  it('informa ausência de token de forma amigável', async () => {
    const res = makeRes();
    await handler(postCmd('agenda'), res);
    const r = res._body.resposta.toLowerCase();
    assert.ok(r.includes('token'), 'deve mencionar "token" na mensagem de fallback');
  });

  it('não vaza detalhes internos (TypeError, stack, undefined)', async () => {
    const res = makeRes();
    await handler(postCmd('agenda'), res);
    const r = res._body.resposta;
    assert.ok(!r.includes('TypeError'),  'não deve expor TypeError');
    assert.ok(!r.includes('at handler'), 'não deve expor stack trace');
    assert.ok(!r.includes('undefined'),  'não deve expor undefined');
  });

  it('alias "calendar" se comporta igual a "agenda"', async () => {
    const r1 = makeRes(); await handler(postCmd('agenda'),   r1);
    const r2 = makeRes(); await handler(postCmd('calendar'), r2);
    assert.equal(r1._body.resposta, r2._body.resposta);
  });

  it('alias "eventos" se comporta igual a "agenda"', async () => {
    const r1 = makeRes(); await handler(postCmd('agenda'),  r1);
    const r2 = makeRes(); await handler(postCmd('eventos'), r2);
    assert.equal(r1._body.resposta, r2._body.resposta);
  });

});

// ══ Suite P1: resumo — mocks mínimos (tudo vazio) ════════════════════════════

describe('/api/comandos — P1: resumo com mocks mínimos', () => {

  // Default mock: todas as chamadas Supabase retornam [] (tabelas vazias)
  before(() => installMock([]));
  after(removeMock);

  it('retorna HTTP 200', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    assert.equal(res._status, 200);
    assert.equal(res._body.ok, true);
  });

  it('resposta começa com emoji 📋', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    assert.ok(res._body.resposta.startsWith('📋'));
  });

  it('cabeçalho contém o ano atual', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    const ano = String(new Date().getFullYear());
    assert.ok(res._body.resposta.includes(ano), `deve conter o ano ${ano}`);
  });

  it('contém seção de agenda (emoji 📅)', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    assert.ok(res._body.resposta.includes('📅'));
  });

  it('contém seção de tarefas (emoji ✅)', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    assert.ok(res._body.resposta.includes('✅'));
  });

  it('contém seção de finanças (emoji 💰)', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    assert.ok(res._body.resposta.includes('💰'));
  });

  it('seções aparecem na ordem: agenda (📅) → tarefas (✅) → finanças (💰)', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    const r = res._body.resposta;
    const [pa, pt, pf] = [r.indexOf('📅'), r.indexOf('✅'), r.indexOf('💰')];
    assert.ok(pa >= 0, '📅 deve estar presente');
    assert.ok(pt >= 0, '✅ deve estar presente');
    assert.ok(pf >= 0, '💰 deve estar presente');
    assert.ok(pa < pt, 'agenda deve preceder tarefas');
    assert.ok(pt < pf, 'tarefas deve preceder finanças');
  });

  it('alias "hoje" se comporta igual a "resumo"', async () => {
    const r1 = makeRes(); await handler(postCmd('resumo'), r1);
    const r2 = makeRes(); await handler(postCmd('hoje'),   r2);
    assert.equal(r1._body.resposta, r2._body.resposta);
  });

  it('alias "dia" se comporta igual a "resumo"', async () => {
    const r1 = makeRes(); await handler(postCmd('resumo'), r1);
    const r2 = makeRes(); await handler(postCmd('dia'),    r2);
    assert.equal(r1._body.resposta, r2._body.resposta);
  });

  it('não vaza detalhes internos (TypeError, stack, undefined)', async () => {
    const res = makeRes();
    await handler(postCmd('resumo'), res);
    const r = res._body.resposta;
    assert.ok(!r.includes('TypeError'),  'não deve expor TypeError');
    assert.ok(!r.includes('at handler'), 'não deve expor stack trace');
    assert.ok(!r.includes('undefined'),  'não deve expor undefined');
  });

});
