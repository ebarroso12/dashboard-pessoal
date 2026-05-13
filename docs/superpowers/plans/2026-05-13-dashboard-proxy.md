# Dashboard Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `/api/dashboard-proxy` para que o frontend chame APIs autenticadas sem expor WEBHOOK_TOKEN no HTML.

**Architecture:** Proxy unico em `api/dashboard-proxy.js` com whitelist de 3 actions. Frontend envia `{action, payload}` sem token; proxy adiciona `WEBHOOK_TOKEN` internamente via env e chama `/api/assistente` ou `/api/supervisor` via HTTP. CORS restrito a `https://dashboard-pessoal-edson.vercel.app`.

**Tech Stack:** Node 20, Vercel Serverless, node:test (built-in), sem dependencias externas.

---

## File Map

| Arquivo | Operacao | Responsabilidade |
|---|---|---|
| `api/dashboard-proxy.js` | criar | proxy com whitelist, validacao de payload, CORS restrito |
| `tests/contract/api-dashboard-proxy.test.js` | criar | testes de contrato do proxy |
| `dashboard.html` | modificar | 5 call sites apontam para `/api/dashboard-proxy` |

`api/assistente.js` e `api/supervisor.js` nao mudam.

---

## Task 1: Escrever testes de contrato para api/dashboard-proxy.js

**Files:**
- Create: `tests/contract/api-dashboard-proxy.test.js`

- [ ] **Step 1: Criar o arquivo de teste**

```javascript
/**
 * tests/contract/api-dashboard-proxy.test.js
 *
 * Contract tests for api/dashboard-proxy.js
 * Run: node --test tests/contract/api-dashboard-proxy.test.js
 */

import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/dashboard-proxy.js';

const _nativeFetch = global.fetch;

function makeReq(method = 'POST', body = {}) {
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

// ── CORS ──────────────────────────────────────────────────────────────────────

describe('dashboard-proxy — CORS', () => {

  it('define Access-Control-Allow-Origin para o dominio do dashboard', async () => {
    process.env.WEBHOOK_TOKEN = 'test-token';
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    global.fetch = _nativeFetch;
    assert.equal(
      res._headers['Access-Control-Allow-Origin'],
      'https://dashboard-pessoal-edson.vercel.app'
    );
    delete process.env.WEBHOOK_TOKEN;
  });

  it('OPTIONS retorna 204', async () => {
    const res = makeRes();
    await handler(makeReq('OPTIONS'), res);
    assert.equal(res._status, 204);
  });

});

// ── Metodo ────────────────────────────────────────────────────────────────────

describe('dashboard-proxy — metodo', () => {

  it('GET retorna 405', async () => {
    const res = makeRes();
    await handler(makeReq('GET'), res);
    assert.equal(res._status, 405);
  });

  it('PUT retorna 405', async () => {
    const res = makeRes();
    await handler(makeReq('PUT'), res);
    assert.equal(res._status, 405);
  });

});

// ── WEBHOOK_TOKEN ausente ─────────────────────────────────────────────────────

describe('dashboard-proxy — fail-fast sem WEBHOOK_TOKEN', () => {

  before(() => { delete process.env.WEBHOOK_TOKEN; });

  it('retorna 500 quando WEBHOOK_TOKEN nao esta configurado', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    assert.equal(res._status, 500);
    assert.ok(res._body?.error, 'deve retornar campo error');
  });

});

// ── Whitelist de actions ──────────────────────────────────────────────────────

describe('dashboard-proxy — whitelist de actions', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('action ausente retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', {}), res);
    assert.equal(res._status, 400);
  });

  it('action desconhecida retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'delete-everything' }), res);
    assert.equal(res._status, 400);
  });

});

// ── Validacao de payload por action ──────────────────────────────────────────

describe('dashboard-proxy — validacao de payload', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('assistente sem q retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'assistente', payload: { origem: 'test' } }), res);
    assert.equal(res._status, 400);
  });

  it('assistente com q vazio retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'assistente', payload: { q: '' } }), res);
    assert.equal(res._status, 400);
  });

  it('supervisor-chat sem mensagem retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-chat', payload: {} }), res);
    assert.equal(res._status, 400);
  });

  it('supervisor-chat com mensagem vazia retorna 400', async () => {
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-chat', payload: { mensagem: '' } }), res);
    assert.equal(res._status, 400);
  });

});

// ── Strip de campos extras ────────────────────────────────────────────────────

describe('dashboard-proxy — strip de campos extras no payload', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('assistente: campos extras sao descartados antes de repassar ao target', async () => {
    let capturedBody = null;
    global.fetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ok: true, resposta: 'ok' }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', {
      action: 'assistente',
      payload: { q: 'oi', origem: 'test', campo_extra: 'injecao', outro: 99 },
    }), res);
    assert.ok(capturedBody, 'fetch deve ter sido chamado');
    assert.equal(capturedBody.q, 'oi');
    assert.equal(capturedBody.origem, 'test');
    assert.ok(!('campo_extra' in capturedBody), 'campo_extra nao deve ser repassado');
    assert.ok(!('outro' in capturedBody), 'outro nao deve ser repassado');
  });

  it('supervisor-chat: campos extras sao descartados', async () => {
    let capturedBody = null;
    global.fetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', {
      action: 'supervisor-chat',
      payload: { mensagem: 'teste', historico: [], injecao: true },
    }), res);
    assert.ok(capturedBody);
    assert.equal(capturedBody.mensagem, 'teste');
    assert.ok(!('injecao' in capturedBody), 'injecao nao deve ser repassada');
  });

});

// ── supervisor-status: GET sem body ──────────────────────────────────────────

describe('dashboard-proxy — supervisor-status', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'test-token'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('supervisor-status envia GET ao supervisor sem body', async () => {
    let calledMethod = null;
    let calledBody   = undefined;
    global.fetch = async (_url, opts) => {
      calledMethod = opts.method;
      calledBody   = opts.body;
      return { ok: true, status: 200, json: async () => ({ ok: true, saude: {} }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    assert.equal(calledMethod, 'GET');
    assert.equal(calledBody, undefined);
  });

  it('supervisor-status repassa status e body do target', async () => {
    global.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ ok: true, saude: { supabase: { ok: true } } }),
    });
    const res = makeRes();
    await handler(makeReq('POST', { action: 'supervisor-status' }), res);
    assert.equal(res._status, 200);
    assert.equal(res._body?.ok, true);
  });

});

// ── Token no header interno ───────────────────────────────────────────────────

describe('dashboard-proxy — WEBHOOK_TOKEN no header interno', () => {

  before(() => { process.env.WEBHOOK_TOKEN = 'meu-token-real'; });
  afterEach(() => { global.fetch = _nativeFetch; });

  it('repassa X-Webhook-Token no header da chamada interna', async () => {
    let capturedToken = null;
    global.fetch = async (_url, opts) => {
      capturedToken = opts.headers['X-Webhook-Token'];
      return { ok: true, status: 200, json: async () => ({ ok: true, resposta: 'ok' }) };
    };
    const res = makeRes();
    await handler(makeReq('POST', { action: 'assistente', payload: { q: 'teste' } }), res);
    assert.equal(capturedToken, 'meu-token-real');
    delete process.env.WEBHOOK_TOKEN;
  });

});
```

- [ ] **Step 2: Rodar os testes — esperar FALHA porque o arquivo nao existe**

```
node --test tests/contract/api-dashboard-proxy.test.js
```

Esperado: erro `Cannot find module '../../api/dashboard-proxy.js'`. Se a falha for diferente disso, verifique o caminho do arquivo.

---

## Task 2: Criar api/dashboard-proxy.js

**Files:**
- Create: `api/dashboard-proxy.js`

- [ ] **Step 1: Criar o arquivo**

```javascript
/**
 * api/dashboard-proxy.js
 *
 * POST /api/dashboard-proxy
 * Body: { action, payload }
 *
 * Whitelist de actions:
 *   assistente       -> POST /api/assistente
 *   supervisor-chat  -> POST /api/supervisor
 *   supervisor-status -> GET /api/supervisor
 *
 * Adiciona WEBHOOK_TOKEN internamente. Nao exige token do frontend.
 * CORS restrito ao dominio do dashboard.
 */

const BASE_URL       = 'https://dashboard-pessoal-edson.vercel.app';
const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';

function cors() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req, res) {
  Object.entries(cors()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.WEBHOOK_TOKEN || '';
  if (!token) return res.status(500).json({ error: 'WEBHOOK_TOKEN nao configurado' });

  const { action, payload = {} } = req.body || {};

  if (!action) return res.status(400).json({ error: 'action obrigatoria' });

  let targetUrl, targetMethod, targetBody;

  switch (action) {

    case 'assistente': {
      const { q, origem } = payload;
      if (!q || typeof q !== 'string' || !q.trim()) {
        return res.status(400).json({ error: 'payload.q obrigatorio para action assistente' });
      }
      targetUrl    = `${BASE_URL}/api/assistente`;
      targetMethod = 'POST';
      targetBody   = { q, ...(origem ? { origem: String(origem) } : {}) };
      break;
    }

    case 'supervisor-chat': {
      const { mensagem, historico } = payload;
      if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
        return res.status(400).json({ error: 'payload.mensagem obrigatorio para action supervisor-chat' });
      }
      targetUrl    = `${BASE_URL}/api/supervisor`;
      targetMethod = 'POST';
      targetBody   = {
        mensagem,
        ...(Array.isArray(historico) ? { historico } : {}),
      };
      break;
    }

    case 'supervisor-status': {
      targetUrl    = `${BASE_URL}/api/supervisor`;
      targetMethod = 'GET';
      targetBody   = undefined;
      break;
    }

    default:
      return res.status(400).json({ error: `action desconhecida: ${action}` });
  }

  try {
    const fetchOpts = {
      method:  targetMethod,
      headers: {
        'Content-Type':    'application/json',
        'X-Webhook-Token': token,
      },
    };
    if (targetBody !== undefined) fetchOpts.body = JSON.stringify(targetBody);

    const r    = await fetch(targetUrl, fetchOpts);
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Erro ao contatar servico interno', detail: e.message });
  }
}
```

- [ ] **Step 2: Rodar os testes — todos devem passar**

```
node --test tests/contract/api-dashboard-proxy.test.js
```

Esperado: `pass N / fail 0`. Se algum falhar, corrija o handler antes de continuar.

- [ ] **Step 3: Commit**

```
git add api/dashboard-proxy.js tests/contract/api-dashboard-proxy.test.js
git commit -m "feat(proxy): dashboard-proxy com whitelist e CORS restrito"
```

---

## Task 3: Atualizar call sites em dashboard.html

**Files:**
- Modify: `dashboard.html`

Antes de cada edit, confirme o texto exato com `grep -n "X-Webhook-Token\|AST_TOKEN\|SV_TOKEN\|AI_TOKEN" dashboard.html`.

### 3a — Assistente Widget (linhas ~8479-8558)

- [ ] **Step 1: Substituir AST_URL, remover AST_TOKEN, atualizar fetch primario e remover fallback**

Localizar e substituir:

old:
```javascript
  const AST_URL   = 'https://dashboard-pessoal-edson.vercel.app/api/assistente';
  const AST_TOKEN = '';
```
new:
```javascript
  const AST_URL   = '/api/dashboard-proxy';
```

old (fetch primario + fallback, linhas ~8533-8558):
```javascript
    try {
      const res = await fetch(AST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Token': AST_TOKEN },
        body: JSON.stringify({ q: texto, origem: 'dashboard' }),
      });
      astRemoveLoading();
      if (!res.ok) throw new Error('status ' + res.status);
      const data = await res.json();
      astAddMsg('bot', data.resposta || '❓ Sem resposta');
      if (['add_receita','add_despesa'].includes(data.intencao)) sbSyncFinanceiro();
    } catch(e) {
      astRemoveLoading();
      // Fallback: servidor local
      try {
        const r2 = await fetch('/api/assistente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Token': AST_TOKEN },
          body: JSON.stringify({ q: texto, origem: 'dashboard' }),
        });
        const d2 = await r2.json();
        astAddMsg('bot', d2.resposta || '❓ Sem resposta');
      } catch {
        astAddMsg('bot', '❌ Publique o dashboard no Vercel para usar o assistente remotamente.');
      }
    }
```
new:
```javascript
    try {
      const res = await fetch(AST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assistente', payload: { q: texto, origem: 'dashboard' } }),
      });
      astRemoveLoading();
      if (!res.ok) throw new Error('status ' + res.status);
      const data = await res.json();
      astAddMsg('bot', data.resposta || '❓ Sem resposta');
      if (['add_receita','add_despesa'].includes(data.intencao)) sbSyncFinanceiro();
    } catch(e) {
      astRemoveLoading();
      astAddMsg('bot', '❌ Erro ao contatar o assistente: ' + e.message);
    }
```

### 3b — Supervisor IA Widget (linhas ~9265-9373)

- [ ] **Step 1: Substituir SV_URL, remover SV_TOKEN**

old:
```javascript
  const SV_URL     = '/api/supervisor';
  const SV_TOKEN   = '';
```
new:
```javascript
  const SV_URL     = '/api/dashboard-proxy';
```

- [ ] **Step 2: Atualizar fetch POST (svEnviar)**

old:
```javascript
      const r = await fetch(SV_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'X-Webhook-Token': SV_TOKEN },
        body: JSON.stringify({ mensagem: texto, historico: svHistorico.slice(-8) }),
      });
```
new:
```javascript
      const r = await fetch(SV_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ action: 'supervisor-chat', payload: { mensagem: texto, historico: svHistorico.slice(-8) } }),
      });
```

- [ ] **Step 3: Atualizar fetch GET (svInit)**

old:
```javascript
      const r = await fetch(SV_URL+'?t='+Date.now(), { headers:{ 'X-Webhook-Token': SV_TOKEN } });
```
new:
```javascript
      const r = await fetch(SV_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'supervisor-status', payload: {} }),
      });
```

### 3c — Categorizacao financeira inline (linha ~9586)

- [ ] **Step 1: Atualizar fetch inline de categorizacao**

old:
```javascript
    const res = await fetch('https://dashboard-pessoal-edson.vercel.app/api/assistente',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Webhook-Token':''},
      body: JSON.stringify({ q: prompt, origem:'fin-categorizar' })
    });
```
new:
```javascript
    const res = await fetch('/api/dashboard-proxy',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'assistente', payload: { q: prompt, origem:'fin-categorizar' } })
    });
```

### 3d — AI Widgets (chamarIA, linha ~10336)

- [ ] **Step 1: Substituir AI_URL, remover AI_TOKEN**

old:
```javascript
  const AI_URL   = 'https://dashboard-pessoal-edson.vercel.app/api/assistente';
  const AI_TOKEN = '';
```
new:
```javascript
  const AI_URL   = '/api/dashboard-proxy';
```

- [ ] **Step 2: Atualizar chamarIA**

old:
```javascript
      const res = await fetch(AI_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Webhook-Token':AI_TOKEN},
        body: JSON.stringify({ q: prompt, origem:'dashboard-ia-widget' })
      });
```
new:
```javascript
      const res = await fetch(AI_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'assistente', payload: { q: prompt, origem:'dashboard-ia-widget' } })
      });
```

### 3e — AI news widget inline (linha ~11173)

- [ ] **Step 1: Atualizar fetch inline de noticias IA**

old:
```javascript
  fetch('/api/assistente', {
    method:'POST', headers:{'Content-Type':'application/json','X-Webhook-Token':''},
    body: JSON.stringify({q: prompt, origem:'ia-news-widget'})
  })
```
new:
```javascript
  fetch('/api/dashboard-proxy', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action: 'assistente', payload: {q: prompt, origem:'ia-news-widget'} })
  })
```

---

## Task 4: Verificar, rodar testes e commit final

**Files:**
- Verify: `dashboard.html`

- [ ] **Step 1: Confirmar zero chamadas diretas sem token**

Rodar os dois greps abaixo. Ambos devem retornar zero resultados.

```
grep -n "X-Webhook-Token" dashboard.html
```
Esperado: nenhuma linha (a unica ocorrencia permitida e no texto instrutivo no painel de configuracao do OpenClaw, que nao e uma chamada JS).

```
grep -n "AST_TOKEN\|SV_TOKEN\|AI_TOKEN" dashboard.html
```
Esperado: nenhuma linha.

Se algum resultado aparecer, localize a linha e aplique o edit correto antes de continuar.

- [ ] **Step 2: Rodar todos os testes**

```
node --test tests/contract/dashboard-openclaw-widget.test.mjs tests/contract/api-openclaw.test.mjs tests/contract/api-dashboard-proxy.test.js
```

Esperado: `pass N / fail 0` em todos os suites.

- [ ] **Step 3: Commit e push**

```
git add dashboard.html
git commit -m "feat(frontend): dashboard chama proxy seguro em vez de APIs autenticadas diretamente"
git push origin main
```

---

## Nota sobre /api/morning-briefing

A chamada `fetch('/api/morning-briefing', ...)` na linha ~10110 ja retorna 404 antes desta implementacao porque o arquivo `api/morning-briefing.js` nao existe. Nao faz parte deste plano. Deve ser resolvida em tarefa separada quando o endpoint for criado.
