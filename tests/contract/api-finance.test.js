/**
 * tests/contract/api-finance.test.js
 *
 * Testa integração financeira ponta-a-ponta:
 * categorias OCR, sync seguro, assistente financeiro.
 *
 * Run: node --test tests/contract/api-finance.test.js
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

const _nativeFetch = global.fetch;
afterEach(() => { global.fetch = _nativeFetch; });

// ── Suite 1: analisa-foto.js — categorias corretas ────────────────────────────

describe('analisa-foto.js — categorias compativeis com FIN_CATS', () => {

  it('CATEGORIAS_VALIDAS nao inclui "mercado" (nao existe no FIN_CATS)', async () => {
    const { default: handler } = await import('../../api/analisa-foto.js');
    // verificar via codigo fonte
    const src = readFileSync(path.join(__dirname, '../../api/analisa-foto.js'), 'utf8');
    // 'mercado' como categoria standalone nao deve existir — mapeado para 'alimentacao'
    const hasStandaloneMercado = /CATEGORIAS_VALIDAS\s*=\s*\[[\s\S]*?'mercado'[\s\S]*?\]/.test(src);
    assert.equal(hasStandaloneMercado, false,
      'CATEGORIAS_VALIDAS ainda tem "mercado" — categoria nao existe em FIN_CATS. Deve mapear para "alimentacao".');
  });

  it('CATEGORIAS_VALIDAS inclui todas as categorias do FIN_CATS', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/analisa-foto.js'), 'utf8');
    const finCatIds = ['moradia','comunicacao','alimentacao','transporte','saude','pessoais','educacao','lazer','financeiros','empresa','dependentes','diversos'];
    for (const id of finCatIds) {
      assert.ok(src.includes(`'${id}'`) || src.includes(`"${id}"`),
        `Categoria "${id}" do FIN_CATS nao encontrada em analisa-foto.js`);
    }
  });

  it('mensagem clara quando OPENAI_API_KEY ausente', async () => {
    const origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { default: handler } = await import('../../api/analisa-foto.js');
    const req = { method: 'POST', body: { image: 'data:image/jpeg;base64,/9j/fake' } };
    const res = {
      _body: null, _status: null,
      status(c){ this._status=c; return this; },
      json(d){ this._body=d; return this; },
      setHeader(){}
    };
    await handler(req, res);
    assert.ok(
      res._body?.motivo?.toLowerCase().includes('openai') || res._body?.motivo?.toLowerCase().includes('api_key') || res._body?.motivo?.toLowerCase().includes('configurad'),
      `Mensagem de erro nao menciona OPENAI_API_KEY: "${res._body?.motivo}"`
    );
    if (origKey) process.env.OPENAI_API_KEY = origKey;
  });

});

// ── Suite 2: api/finance/sync.js — sync seguro via service_role ───────────────

describe('api/finance/sync.js — sync financeiro com service_role', () => {

  before(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.WEBHOOK_TOKEN = 'test-token';
  });
  after(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.WEBHOOK_TOKEN;
  });

  it('endpoint /api/finance/sync existe e exporta handler', async () => {
    let handler;
    try {
      const mod = await import('../../api/finance/sync.js');
      handler = mod.default;
    } catch(e) {
      assert.fail(`api/finance/sync.js nao existe: ${e.message}`);
    }
    assert.equal(typeof handler, 'function', 'handler deve ser funcao');
  });

  it('POST com tipo e dados chama adminFetch para dados_assistente', async () => {
    let capturedPath, capturedBody;
    global.fetch = async (url, opts) => {
      if (String(url).includes('supabase') && String(url).includes('dados_assistente')) {
        capturedPath = url;
        capturedBody = opts?.body ? JSON.parse(opts.body) : null;
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    };
    const { default: handler } = await import('../../api/finance/sync.js');
    const req = {
      method: 'POST',
      headers: { 'x-webhook-token': 'test-token' },
      body: { tipo: 'financeiro', dados: { renda: 5000, despesas: 3000 } }
    };
    const res = { _status: null, _body: null, status(c){this._status=c;return this;}, json(d){this._body=d;return this;}, setHeader(){}, end(){} };
    await handler(req, res);
    assert.ok(capturedPath, 'adminFetch nao foi chamado para dados_assistente');
    assert.equal(capturedBody?.tipo, 'financeiro', 'tipo nao foi passado para Supabase');
  });

  it('GET retorna 405', async () => {
    const { default: handler } = await import('../../api/finance/sync.js');
    const req = { method: 'GET', headers: {}, body: {} };
    const res = { _status: null, status(c){this._status=c;return this;}, json(){return this;}, setHeader(){}, end(){} };
    await handler(req, res);
    assert.equal(res._status, 405);
  });

  it('usa SUPABASE_SERVICE_ROLE_KEY, nao anon key', async () => {
    let usedKey = null;
    global.fetch = async (url, opts) => {
      if (String(url).includes('supabase')) {
        usedKey = opts?.headers?.apikey || opts?.headers?.['apikey'];
      }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    };
    const { default: handler } = await import('../../api/finance/sync.js');
    const req = { method: 'POST', headers: { 'x-webhook-token': 'test-token' }, body: { tipo: 'tx', dados: {} } };
    const res = { _status: null, status(c){this._status=c;return this;}, json(){return this;}, setHeader(){}, end(){} };
    await handler(req, res);
    assert.equal(usedKey, 'test-service-role-key', 'Sync financeiro usando anon key em vez de service_role');
  });

});

// ── Suite 3: comandos.js — handleFinancas sem /financas ──────────────────────

describe('comandos.js — handleFinancas nao consulta tabelas inexistentes', () => {

  it('handleFinancas nao faz query em /financas', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/comandos.js'), 'utf8');
    const hasBrokenQuery = /sbFetch\(['"`]\/financas/.test(src) || /fetch\(.*\/financas/.test(src);
    assert.equal(hasBrokenQuery, false,
      'handleFinancas ainda consulta /financas — tabela nao existe. Usar dados_assistente.');
  });

  it('handleFinancas nao faz query em /transacoes', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/comandos.js'), 'utf8');
    const hasBrokenQuery = /sbFetch\(['"`]\/transacoes/.test(src) || /fetch\(.*\/transacoes/.test(src);
    assert.equal(hasBrokenQuery, false,
      'handleFinancas ainda consulta /transacoes — tabela nao existe. Usar dados_assistente.');
  });

  it('handleFinancas le de dados_assistente', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/comandos.js'), 'utf8');
    assert.ok(src.includes('dados_assistente'),
      'handleFinancas nao le de dados_assistente.');
  });

});

// ── Suite 4: dashboard.html — sync via endpoint seguro ───────────────────────

describe('dashboard.html — sbSyncFinanceiro usa /api/finance/sync', () => {

  it('sbSyncFinanceiro chama /api/finance/sync', () => {
    const idx = html.indexOf('async function sbSyncFinanceiro');
    const fnBody = idx >= 0 ? html.slice(idx, idx + 600) : '';
    assert.ok(fnBody.includes('/api/finance/sync'),
      'sbSyncFinanceiro ainda usa sbUpsert com anon key. Deve chamar /api/finance/sync.');
  });

  it('sbSyncFinanceiro mostra erro visivel se sync falhar', () => {
    const idx = html.indexOf('async function sbSyncFinanceiro');
    const fnBody = idx >= 0 ? html.slice(idx, idx + 1000) : '';
    assert.ok(fnBody.includes('showToast') || fnBody.includes('console.warn'),
      'sbSyncFinanceiro falha silenciosamente. Deve mostrar feedback ao usuario.');
  });

});
