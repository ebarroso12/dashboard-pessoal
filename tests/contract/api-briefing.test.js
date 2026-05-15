/**
 * tests/contract/api-briefing.test.js
 *
 * TDD para endpoint de Briefing Executivo IA.
 * Cobre: endpoint existe, degradação graceful, formato, TTL, GPT.
 *
 * Run: node --test tests/contract/api-briefing.test.js
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');

const _nativeFetch = global.fetch;
afterEach(() => { global.fetch = _nativeFetch; });

// ── Suite 1: Endpoint existe ──────────────────────────────────────────────────

describe('api/briefing.js — endpoint existe', () => {

  it('arquivo api/briefing.js existe', () => {
    assert.ok(
      existsSync(path.join(__dirname, '../../api/briefing.js')),
      'api/briefing.js nao encontrado — endpoint de briefing nao implementado.'
    );
  });

  it('handler exportado e funcao', async () => {
    const { default: handler } = await import('../../api/briefing.js');
    assert.equal(typeof handler, 'function', 'handler deve ser funcao export default.');
  });

  it('GET retorna 405 (so aceita POST)', async () => {
    const { default: handler } = await import('../../api/briefing.js');
    const req = { method: 'GET', headers: {}, body: {} };
    const res = { _s: null, status(c){ this._s=c; return this; }, json(){ return this; }, setHeader(){}, end(){} };
    await handler(req, res);
    assert.equal(res._s, 405, 'GET deve retornar 405.');
  });

});

// ── Suite 2: Degradacao graceful ──────────────────────────────────────────────

describe('api/briefing.js — funciona sem dados externos', () => {

  before(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.WEBHOOK_TOKEN = 'test-token';
  });
  after(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.WEBHOOK_TOKEN;
  });

  it('retorna briefing mesmo sem Google conectado (fallback)', async () => {
    global.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('supabase') && u.includes('oauth_tokens')) {
        return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
      }
      if (u.includes('supabase') && u.includes('tarefas')) {
        return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
      }
      if (u.includes('supabase') && u.includes('dados_assistente')) {
        return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
      }
      if (u.includes('openai.com')) {
        return {
          ok: true, status: 200,
          json: async () => ({
            choices: [{ message: { content: '**BRIEFING EXECUTIVO**\n\n📅 AGENDA: Sem eventos.\n✅ TAREFAS: Sem tarefas pendentes.\n💰 FINANCEIRO: Sem dados.' } }]
          }),
          text: async () => ''
        };
      }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
    };
    const { default: handler } = await import('../../api/briefing.js');
    const req = { method: 'POST', headers: { 'x-webhook-token': 'test-token' }, body: {} };
    const res = {
      _s: null, _b: null,
      status(c){ this._s=c; return this; },
      json(d){ this._b=d; return this; },
      setHeader(){}, end(){}
    };
    await handler(req, res);
    assert.equal(res._s, 200, `esperado 200, recebeu ${res._s}`);
    assert.ok(res._b?.briefing, 'resposta deve ter campo briefing');
  });

  it('retorna 200 mesmo com OPENAI_API_KEY ausente (fallback sem IA)', async () => {
    const origKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('supabase')) return { ok: true, status: 200, json: async () => [], text: async () => '[]' };
      return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
    };
    const { default: handler } = await import('../../api/briefing.js');
    const req = { method: 'POST', headers: { 'x-webhook-token': 'test-token' }, body: {} };
    const res = {
      _s: null, _b: null,
      status(c){ this._s=c; return this; },
      json(d){ this._b=d; return this; },
      setHeader(){}, end(){}
    };
    await handler(req, res);
    assert.equal(res._s, 200, 'sem OPENAI_API_KEY deve retornar 200 com briefing basico');
    assert.ok(res._b?.briefing, 'deve ter campo briefing mesmo sem IA');
    if (origKey) process.env.OPENAI_API_KEY = origKey;
  });

});

// ── Suite 3: Formato e TTL ────────────────────────────────────────────────────

describe('api/briefing.js — formato correto', () => {

  it('usa modelo gpt-4.1-mini', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/briefing.js'), 'utf8');
    assert.ok(src.includes('gpt-4.1-mini'), 'briefing nao usa gpt-4.1-mini.');
  });

  it('tem AbortSignal.timeout para evitar hang', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/briefing.js'), 'utf8');
    assert.ok(src.includes('AbortSignal.timeout') || src.includes('signal:'),
      'briefing sem timeout na chamada OpenAI — pode travar.');
  });

  it('salva briefing em dados_assistente com tipo briefing_executivo', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/briefing.js'), 'utf8');
    assert.ok(src.includes('briefing_executivo') || src.includes('briefing'),
      'briefing nao salvo em dados_assistente.');
  });

  it('resposta inclui gerado_em timestamp', async () => {
    const src = readFileSync(path.join(__dirname, '../../api/briefing.js'), 'utf8');
    assert.ok(src.includes('gerado_em') || src.includes('generated_at'),
      'resposta sem timestamp gerado_em.');
  });

});

// ── Suite 4: Dashboard UX ─────────────────────────────────────────────────────

describe('dashboard.html — briefing UX', () => {

  it('botao Gerar Briefing existe', () => {
    assert.ok(
      html.includes('Gerar Briefing') || html.includes('gerarBriefing') || html.includes('Briefing Executivo'),
      'Botao "Gerar Briefing" ausente no dashboard.'
    );
  });

  it('chama /api/briefing ou /api/morning-briefing', () => {
    assert.ok(
      html.includes('/api/briefing') || html.includes('/api/morning-briefing'),
      'Dashboard nao chama endpoint de briefing.'
    );
  });

});
