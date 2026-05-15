# OpenClaw Gateway API — Roadmap e Microtarefas

> Documento de planejamento incremental. Data: 2026-05-15.
> Design completo: `docs/architecture/openclaw-gateway-api.md`
> Para agentic workers: use superpowers:executing-plans ou superpowers:subagent-driven-development.

---

## Visao geral das fases

| Fase | Escopo | Valor entregue |
|------|--------|----------------|
| 1 | `_gateway.js` + `message` + `command` + `status` | OpenClaw pode mandar comandos/mensagens com contrato claro |
| 2 | `briefing` + `notify` | Briefing via WhatsApp + notificacoes pelo Gateway |
| 3 | `audio` + OCR flow | Nota fiscal por foto integrada ao Gateway |
| 4 | Automacoes avancadas | Feed de atividade, rate limit avancado, alertas |

Cada fase entrega software testavel e implantavel independentemente.

---

## Fase 1 — Infraestrutura + message + command + status

**Meta:** qualquer comando basico do OpenClaw funciona pelo Gateway com auth,
validacao, logging e resposta estruturada.

**Criterios de aceite:**
- [ ] `POST /api/openclaw/message` com token valido salva em `comandos` e retorna `{ id, status: "saved" }`.
- [ ] `POST /api/openclaw/message` sem token retorna `401`.
- [ ] `POST /api/openclaw/command { "command": "resumo_do_dia" }` chama `/api/supervisor` e retorna o resumo.
- [ ] `POST /api/openclaw/command { "command": "registrar_tarefa", "params": { "titulo": "X", "prioridade": "alta" } }` insere em `tarefas`.
- [ ] `POST /api/openclaw/command { "command": "adicionar_gasto", "params": { "valor": 50, "categoria": "alimentacao" } }` nao cria duplicata se chamado 2x com mesmo `session_id` em < 60s.
- [ ] `GET /api/openclaw/status` retorna `{ status, services }` em < 5s.
- [ ] `openclaw_events` existe no Supabase com DDL correto.
- [ ] Zero arquivos existentes modificados.

---

### Task 1.1 — Migrations Supabase

**Arquivos:**
- Create: `supabase/migrations/001_openclaw_events.sql`
- Create: `supabase/migrations/002_openclaw_jobs.sql`

- [ ] **Step 1.1.1: Criar migration openclaw_events**

```sql
-- supabase/migrations/001_openclaw_events.sql
CREATE TABLE IF NOT EXISTS openclaw_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  command     TEXT,
  params_hash TEXT,
  status      TEXT NOT NULL DEFAULT 'processing',
  session_id  TEXT,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_events_created
  ON openclaw_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_openclaw_events_params_hash
  ON openclaw_events (params_hash)
  WHERE params_hash IS NOT NULL;
```

- [ ] **Step 1.1.2: Criar migration openclaw_jobs**

```sql
-- supabase/migrations/002_openclaw_jobs.sql
CREATE TABLE IF NOT EXISTS openclaw_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',
  payload     JSONB,
  result      JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 1.1.3: Aplicar migrations no Supabase**

Verificar se projeto usa Supabase CLI ou SQL editor direto.
Se CLI: `supabase db push`.
Se SQL editor: colar cada arquivo no Supabase Studio > SQL Editor.

Confirmar via Supabase Studio que as tabelas existem com as colunas corretas.

- [ ] **Step 1.1.4: Commit**

```bash
git add supabase/migrations/001_openclaw_events.sql
git add supabase/migrations/002_openclaw_jobs.sql
git commit -m "feat(openclaw): add openclaw_events and openclaw_jobs migrations"
```

---

### Task 1.2 — Shared Gateway Middleware

**Arquivos:**
- Create: `api/openclaw/_gateway.js`

- [ ] **Step 1.2.1: Criar _gateway.js**

```javascript
// api/openclaw/_gateway.js
import { adminFetch } from '../_supabase-admin.js';

const SUPABASE_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';

export function validateToken(req) {
  const token = req.headers['x-webhook-token'];
  const expected = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.WEBHOOK_TOKEN || '';
  return token === expected && expected !== '';
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  'https://openclaw.n8ndredson.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Token',
  };
}

export async function logEvent(type, fields = {}) {
  const payload = {
    type,
    command:     fields.command     || null,
    params_hash: fields.params_hash || null,
    status:      fields.status      || 'processing',
    session_id:  fields.session_id  || null,
    duration_ms: fields.duration_ms || null,
  };
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/openclaw_events`, {
      method:  'POST',
      headers: {
        apikey:          SUPABASE_ANON,
        Authorization:   `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
        Prefer:          'return=representation',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // log nao pode travar o request principal
  }
}

export async function checkIdempotency(paramsHash, windowSeconds = 60) {
  if (!paramsHash) return null;
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const rows = await adminFetch(
    `/openclaw_events?params_hash=eq.${paramsHash}&status=eq.executed&created_at=gte.${since}&limit=1`
  );
  return rows?.[0] || null;
}

export function hashParams(command, params) {
  const str = command + JSON.stringify(params || {});
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
```

- [ ] **Step 1.2.2: Adicionar OPENCLAW_GATEWAY_TOKEN ao .env.local**

Abrir `.env.local` e adicionar:
```
OPENCLAW_GATEWAY_TOKEN=oc_edson_2026_secure
```

(Mesmo valor do WEBHOOK_TOKEN existente para compatibilidade.
Rotacionar em producao via Vercel dashboard > Environment Variables.)

- [ ] **Step 1.2.3: Commit**

```bash
git add api/openclaw/_gateway.js
git commit -m "feat(openclaw): add shared gateway middleware (auth, logging, idempotency)"
```

---

### Task 1.3 — POST /api/openclaw/message

**Arquivos:**
- Create: `api/openclaw/message.js`

- [ ] **Step 1.3.1: Criar message.js**

```javascript
// api/openclaw/message.js
import { adminFetch } from '../_supabase-admin.js';
import { validateToken, corsHeaders, logEvent } from './_gateway.js';

const SUPABASE_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!validateToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { texto, resposta = '', tipo = 'texto', de = 'WhatsApp', session_id } = req.body || {};

  if (!texto || typeof texto !== 'string' || texto.trim() === '') {
    return res.status(400).json({ error: 'texto is required' });
  }

  const startMs = Date.now();

  // Salvar em tabela comandos (compatibilidade com widget existente)
  const r = await fetch(`${SUPABASE_URL}/rest/v1/comandos`, {
    method:  'POST',
    headers: {
      apikey:          SUPABASE_ANON,
      Authorization:   `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
    },
    body: JSON.stringify({ tipo, texto, resposta, de, status: 'ok' }),
  });

  if (!r.ok) {
    await logEvent('message', { status: 'failed', session_id, duration_ms: Date.now() - startMs });
    return res.status(500).json({ error: 'Failed to save message' });
  }

  const [saved] = await r.json();
  await logEvent('message', { status: 'saved', session_id, duration_ms: Date.now() - startMs });

  return res.status(200).json({
    id:         saved?.id || 'unknown',
    status:     'saved',
    created_at: saved?.ts || new Date().toISOString(),
  });
}
```

- [ ] **Step 1.3.2: Testar manualmente**

```bash
curl -X POST https://dashboard-pessoal-edson.vercel.app/api/openclaw/message \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: oc_edson_2026_secure" \
  -d '{"texto": "teste gateway", "tipo": "texto"}'
```

Esperado: `{ "id": "...", "status": "saved", "created_at": "..." }`

```bash
curl -X POST https://dashboard-pessoal-edson.vercel.app/api/openclaw/message \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: token_errado" \
  -d '{"texto": "teste"}'
```

Esperado: `401 { "error": "Unauthorized" }`

- [ ] **Step 1.3.3: Commit**

```bash
git add api/openclaw/message.js
git commit -m "feat(openclaw): add POST /api/openclaw/message endpoint"
```

---

### Task 1.4 — GET /api/openclaw/status

**Arquivos:**
- Create: `api/openclaw/status.js`

- [ ] **Step 1.4.1: Criar status.js**

```javascript
// api/openclaw/status.js
import { adminFetch } from '../_supabase-admin.js';
import { validateToken, corsHeaders } from './_gateway.js';

const BASE_URL = 'https://dashboard-pessoal-edson.vercel.app';
const VERSION  = '1.0.0';

async function checkSupabase() {
  const start = Date.now();
  try {
    const rows = await adminFetch('/tarefas?limit=1&select=id');
    return { status: Array.isArray(rows) ? 'ok' : 'error', latencia_ms: Date.now() - start };
  } catch {
    return { status: 'error', latencia_ms: Date.now() - start };
  }
}

async function checkSupervisor() {
  try {
    const rows = await adminFetch('/supervisor_logs?select=criado_em&order=criado_em.desc&limit=1');
    return { status: 'ok', ultimo_log: rows?.[0]?.criado_em || null };
  } catch {
    return { status: 'error', ultimo_log: null };
  }
}

async function checkOpenClaw() {
  try {
    const rows = await adminFetch('/comandos?select=ts&order=ts.desc&limit=1');
    return { status: 'ok', ultimo_evento: rows?.[0]?.ts || null };
  } catch {
    return { status: 'error', ultimo_evento: null };
  }
}

async function checkWhatsApp() {
  try {
    const rows = await adminFetch('/comandos?select=ts&de=eq.WhatsApp&order=ts.desc&limit=1');
    return { status: 'ok', ultimo_envio: rows?.[0]?.ts || null };
  } catch {
    return { status: 'error', ultimo_envio: null };
  }
}

async function checkBriefing() {
  try {
    const rows = await adminFetch('/morning_briefing?select=created_at&order=created_at.desc&limit=1');
    return { status: 'ok', ultimo_briefing: rows?.[0]?.created_at || null };
  } catch {
    return { status: 'error', ultimo_briefing: null };
  }
}

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  if (!validateToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const [supabase, supervisor, openclaw, whatsapp, briefing] = await Promise.allSettled([
    Promise.race([checkSupabase(),  new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]),
    Promise.race([checkSupervisor(),new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]),
    Promise.race([checkOpenClaw(),  new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]),
    Promise.race([checkWhatsApp(),  new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]),
    Promise.race([checkBriefing(),  new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))]),
  ]);

  const services = {
    supabase:   supabase.status   === 'fulfilled' ? supabase.value   : { status: 'error' },
    supervisor: supervisor.status === 'fulfilled' ? supervisor.value : { status: 'error' },
    openclaw:   openclaw.status   === 'fulfilled' ? openclaw.value   : { status: 'error' },
    whatsapp:   whatsapp.status   === 'fulfilled' ? whatsapp.value   : { status: 'error' },
    briefing:   briefing.status   === 'fulfilled' ? briefing.value   : { status: 'error' },
  };

  const allOk      = Object.values(services).every(s => s.status === 'ok');
  const criticalOk = services.supabase.status === 'ok' && services.supervisor.status === 'ok';
  const overall    = allOk ? 'ok' : criticalOk ? 'degraded' : 'down';

  return res.status(200).json({
    status:    overall,
    timestamp: new Date().toISOString(),
    version:   VERSION,
    services,
  });
}
```

- [ ] **Step 1.4.2: Testar manualmente**

```bash
curl https://dashboard-pessoal-edson.vercel.app/api/openclaw/status \
  -H "X-Webhook-Token: oc_edson_2026_secure"
```

Esperado: `{ "status": "ok"|"degraded"|"down", "services": { ... } }` em < 5s.

- [ ] **Step 1.4.3: Commit**

```bash
git add api/openclaw/status.js
git commit -m "feat(openclaw): add GET /api/openclaw/status health check"
```

---

### Task 1.5 — POST /api/openclaw/command

**Arquivos:**
- Create: `api/openclaw/command.js`

- [ ] **Step 1.5.1: Criar command.js**

```javascript
// api/openclaw/command.js
import { adminFetch } from '../_supabase-admin.js';
import { validateToken, corsHeaders, logEvent, checkIdempotency, hashParams } from './_gateway.js';

const BASE_URL     = 'https://dashboard-pessoal-edson.vercel.app';
const SUPABASE_URL = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';

const IDEMPOTENT_COMMANDS = new Set(['adicionar_gasto', 'registrar_tarefa']);

const VALID_COMMANDS = new Set([
  'resumo_do_dia', 'status_sistemas', 'agenda', 'tarefas',
  'registrar_tarefa', 'adicionar_gasto', 'enviar_relatorio', 'analisar_nf',
]);

async function executarComando(command, params = {}) {
  switch (command) {
    case 'resumo_do_dia': {
      const r = await fetch(`${BASE_URL}/api/supervisor`, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'X-Webhook-Token': process.env.OPENCLAW_GATEWAY_TOKEN || process.env.WEBHOOK_TOKEN || '',
        },
        body: JSON.stringify({ mensagem: 'gere o resumo executivo do dia' }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) return { status: 'failed', result: { error: 'Supervisor indisponivel' } };
      const data = await r.json();
      return { status: 'executed', result: { resumo: data.resposta || data.response || '' } };
    }

    case 'status_sistemas': {
      const r = await fetch(`${BASE_URL}/api/openclaw/status`, {
        headers: { 'X-Webhook-Token': process.env.OPENCLAW_GATEWAY_TOKEN || process.env.WEBHOOK_TOKEN || '' },
        signal: AbortSignal.timeout(6000),
      });
      const data = await r.json();
      return { status: 'executed', result: data };
    }

    case 'registrar_tarefa': {
      if (!params.titulo) return { status: 'failed', result: { error: 'params.titulo required' } };
      const PRIORIDADES = new Set(['alta', 'media', 'baixa']);
      const prioridade  = PRIORIDADES.has(params.prioridade) ? params.prioridade : 'media';
      const rows = await adminFetch('/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: params.titulo, prioridade, concluida: false, origem: 'openclaw',
        }),
      });
      const id = rows?.[0]?.id || rows?.id;
      return { status: 'executed', result: { tarefa_id: id, titulo: params.titulo } };
    }

    case 'adicionar_gasto': {
      if (!params.valor || typeof params.valor !== 'number' || params.valor <= 0) {
        return { status: 'failed', result: { error: 'params.valor must be positive number' } };
      }
      // Tabela a confirmar em Fase 1 via auditoria do schema Supabase.
      // Se nao existir financeiro_gastos, inserir em dados_assistente como fallback.
      const rows = await adminFetch('/financeiro_gastos', {
        method: 'POST',
        body: JSON.stringify({
          valor: params.valor,
          categoria: params.categoria || 'outros',
          descricao: params.descricao || '',
          origem: 'openclaw',
        }),
      });
      const id = rows?.[0]?.id || rows?.id;
      return { status: 'executed', result: { gasto_id: id, valor: params.valor } };
    }

    case 'enviar_relatorio': {
      const r = await fetch(`${BASE_URL}/api/openclaw/briefing`, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'X-Webhook-Token': process.env.OPENCLAW_GATEWAY_TOKEN || process.env.WEBHOOK_TOKEN || '',
        },
        body: JSON.stringify({
          tipo:     params.tipo     || 'diario',
          delivery: params.canal    || 'dashboard',
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json();
      return { status: 'queued', result: data };
    }

    default:
      return { status: 'failed', result: { error: `Command unknown: ${command}` } };
  }
}

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!validateToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { command, params = {}, session_id } = req.body || {};

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command is required' });
  }
  if (!VALID_COMMANDS.has(command)) {
    return res.status(422).json({ error: `Unknown command: ${command}` });
  }

  const paramsHash = IDEMPOTENT_COMMANDS.has(command)
    ? hashParams(command, params)
    : null;

  if (paramsHash) {
    const existing = await checkIdempotency(paramsHash);
    if (existing) {
      return res.status(200).json({
        id:      existing.id,
        command,
        status:  'deduplicated',
        result:  {},
      });
    }
  }

  const startMs = Date.now();
  await logEvent('command', { command, params_hash: paramsHash, status: 'processing', session_id });

  const { status, result } = await executarComando(command, params);

  await logEvent('command', {
    command, params_hash: paramsHash,
    status, session_id,
    duration_ms: Date.now() - startMs,
  });

  return res.status(200).json({
    id:      crypto.randomUUID(),
    command,
    status,
    result,
  });
}
```

- [ ] **Step 1.5.2: Verificar se tabela financeiro_gastos existe**

No Supabase Studio, verificar se existe tabela `financeiro_gastos`.
Se nao existir: criar migration `supabase/migrations/003_financeiro_gastos.sql`
ou identificar a tabela correta onde gastos devem ser inseridos.

```bash
# Verificar via Supabase MCP ou Studio
# Procurar por tabelas: financeiro_gastos, gastos, financas, dados_assistente
```

- [ ] **Step 1.5.3: Testar manualmente (status_sistemas)**

```bash
curl -X POST https://dashboard-pessoal-edson.vercel.app/api/openclaw/command \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: oc_edson_2026_secure" \
  -d '{"command": "status_sistemas"}'
```

Esperado: `{ "command": "status_sistemas", "status": "executed", "result": { "status": "ok|degraded" } }`

- [ ] **Step 1.5.4: Testar registrar_tarefa**

```bash
curl -X POST https://dashboard-pessoal-edson.vercel.app/api/openclaw/command \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: oc_edson_2026_secure" \
  -d '{"command": "registrar_tarefa", "params": {"titulo": "Teste gateway", "prioridade": "alta"}, "session_id": "test-001"}'
```

Esperado: `{ "status": "executed", "result": { "tarefa_id": "...", "titulo": "Teste gateway" } }`

Chamar de novo com mesmo `session_id` equivalente (mesmo command + params):
Esperado: `{ "status": "deduplicated" }`

- [ ] **Step 1.5.5: Commit**

```bash
git add api/openclaw/command.js
git commit -m "feat(openclaw): add POST /api/openclaw/command with idempotency"
```

---

### Task 1.6 — Deploy e verificacao Fase 1

- [ ] **Step 1.6.1: Adicionar OPENCLAW_GATEWAY_TOKEN no Vercel**

Vercel Dashboard > dashboard-pessoal-edson > Settings > Environment Variables.
Adicionar: `OPENCLAW_GATEWAY_TOKEN` = `oc_edson_2026_secure`.

- [ ] **Step 1.6.2: Push e verificar deploy**

```bash
git push origin main
```

Aguardar deploy no Vercel. Verificar build logs sem erros.

- [ ] **Step 1.6.3: Smoke test em producao**

```bash
curl https://dashboard-pessoal-edson.vercel.app/api/openclaw/status \
  -H "X-Webhook-Token: oc_edson_2026_secure"
```

Esperado: HTTP 200 com `status` em `["ok", "degraded", "down"]`.

---

## Fase 2 — briefing + notify

**Meta:** briefing executivo pode ser acionado via Gateway e entregue por WhatsApp.
Notificacoes do sistema fluem por endpoint unico.

**Criterios de aceite:**
- [ ] `POST /api/openclaw/briefing` retorna `202` com `job_id`.
- [ ] Com `delivery: "whatsapp"`: mensagem chega no WhatsApp (requer n8n configurado).
- [ ] `POST /api/openclaw/notify { canal: "dashboard" }` insere em tabela `notificacoes`.
- [ ] `POST /api/openclaw/notify { canal: "whatsapp" }` dispara webhook n8n configurado.
- [ ] Notificacao sem `mensagem` retorna `400`.

---

### Task 2.1 — POST /api/openclaw/notify

**Arquivos:**
- Create: `api/openclaw/notify.js`

- [ ] **Step 2.1.1: Criar notify.js**

```javascript
// api/openclaw/notify.js
import { validateToken, corsHeaders, logEvent } from './_gateway.js';
import { adminFetch } from '../_supabase-admin.js';

const N8N_NOTIFY_URL = process.env.OPENCLAW_N8N_NOTIFY_URL || '';

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!validateToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { canal, mensagem, prioridade = 'normal', metadata = {} } = req.body || {};

  if (!canal || !mensagem) {
    return res.status(400).json({ error: 'canal and mensagem are required' });
  }

  const CANAIS = new Set(['whatsapp', 'dashboard', 'ambos']);
  if (!CANAIS.has(canal)) {
    return res.status(422).json({ error: `canal must be one of: whatsapp, dashboard, ambos` });
  }

  const id = crypto.randomUUID();
  let status = 'sent';

  if (canal === 'dashboard' || canal === 'ambos') {
    await adminFetch('/notificacoes', {
      method: 'POST',
      body: JSON.stringify({ id, mensagem, prioridade, metadata, lida: false }),
    });
  }

  if (canal === 'whatsapp' || canal === 'ambos') {
    if (!N8N_NOTIFY_URL) {
      status = 'queued';
    } else {
      try {
        await fetch(N8N_NOTIFY_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ mensagem, prioridade }),
          signal:  AbortSignal.timeout(8000),
        });
      } catch {
        status = 'queued';
      }
    }
  }

  await logEvent('notify', { status, session_id: metadata.origem });

  return res.status(200).json({ id, status, canal });
}
```

- [ ] **Step 2.1.2: Criar migration notificacoes (se nao existir)**

Verificar se tabela `notificacoes` existe no Supabase.
Se nao existir:

```sql
-- supabase/migrations/003_notificacoes.sql
CREATE TABLE IF NOT EXISTS notificacoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem   TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'normal',
  metadata   JSONB,
  lida       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2.1.3: Adicionar OPENCLAW_N8N_NOTIFY_URL no Vercel**

Vercel Dashboard > Environment Variables.
`OPENCLAW_N8N_NOTIFY_URL` = URL do webhook n8n que chama `sendWhatsApp()`.

- [ ] **Step 2.1.4: Commit**

```bash
git add api/openclaw/notify.js
git commit -m "feat(openclaw): add POST /api/openclaw/notify"
```

---

### Task 2.2 — POST /api/openclaw/briefing

**Arquivos:**
- Create: `api/openclaw/briefing.js`

- [ ] **Step 2.2.1: Criar briefing.js**

```javascript
// api/openclaw/briefing.js
import { validateToken, corsHeaders, logEvent } from './_gateway.js';

const BASE_URL = 'https://dashboard-pessoal-edson.vercel.app';
const TIPOS    = new Set(['diario', 'semanal']);
const DELIVERIES = new Set(['dashboard', 'whatsapp', 'ambos']);

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!validateToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tipo = 'diario', delivery = 'dashboard', data } = req.body || {};

  if (!TIPOS.has(tipo)) {
    return res.status(400).json({ error: `tipo must be one of: diario, semanal` });
  }
  if (!DELIVERIES.has(delivery)) {
    return res.status(400).json({ error: `delivery must be one of: dashboard, whatsapp, ambos` });
  }

  const jobId = crypto.randomUUID();
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.WEBHOOK_TOKEN || '';

  // Chamar /api/briefing existente de forma assincrona (nao aguardar)
  fetch(`${BASE_URL}/api/briefing`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Webhook-Token': token,
    },
    body: JSON.stringify({ tipo, data }),
  }).then(async r => {
    if (!r.ok) return;
    const briefingData = await r.json();
    if (!briefingData?.resumo && !briefingData?.texto) return;

    const mensagem = briefingData.resumo || briefingData.texto || JSON.stringify(briefingData);

    if (delivery === 'whatsapp' || delivery === 'ambos') {
      await fetch(`${BASE_URL}/api/openclaw/notify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Token': token },
        body:    JSON.stringify({ canal: 'whatsapp', mensagem, prioridade: 'normal' }),
      });
    }
  }).catch(() => {});

  await logEvent('briefing', { status: 'queued', session_id: jobId });

  return res.status(202).json({ job_id: jobId, status: 'queued', delivery });
}
```

- [ ] **Step 2.2.2: Verificar campo de resumo retornado por /api/briefing**

Ler `api/briefing.js` para confirmar nome do campo que contem o texto do briefing.
O campo usado acima (`briefingData.resumo || briefingData.texto`) deve ser ajustado
se o campo real tiver outro nome.

```bash
curl -X POST https://dashboard-pessoal-edson.vercel.app/api/briefing \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: oc_edson_2026_secure" \
  -d '{}'
```

Observar o JSON retornado e confirmar o campo com o texto do briefing.

- [ ] **Step 2.2.3: Commit**

```bash
git add api/openclaw/briefing.js
git commit -m "feat(openclaw): add POST /api/openclaw/briefing"
```

---

## Fase 3 — audio + OCR flow

**Meta:** usuario envia foto de nota fiscal ou audio via WhatsApp. OpenClaw
manda para o Gateway, que enfileira no n8n. n8n processa e cria o gasto
automaticamente.

**Criterios de aceite:**
- [ ] `POST /api/openclaw/audio { formato: "jpg", tipo: "nota_fiscal", audio_url: "..." }` salva job em `openclaw_jobs` e retorna `202`.
- [ ] Payload > 10MB retorna `413`.
- [ ] Formato nao suportado retorna `415`.
- [ ] n8n workflow processa o job e chama `adicionar_gasto` via Gateway.
- [ ] Usuario recebe notificacao WhatsApp com resultado do OCR.

---

### Task 3.1 — POST /api/openclaw/audio

**Arquivos:**
- Create: `api/openclaw/audio.js`

- [ ] **Step 3.1.1: Criar audio.js**

```javascript
// api/openclaw/audio.js
import { adminFetch } from '../_supabase-admin.js';
import { validateToken, corsHeaders, logEvent } from './_gateway.js';

const N8N_AUDIO_URL  = process.env.OPENCLAW_N8N_AUDIO_URL || '';
const SUPABASE_URL   = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON  = process.env.SUPABASE_ANON_KEY || '';

const FORMATOS = new Set(['ogg', 'mp3', 'wav', 'jpg', 'jpeg', 'png']);
const TIPOS    = new Set(['voz', 'nota_fiscal']);

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  if (!validateToken(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { audio_url, formato, tipo, duracao_segundos, session_id } = req.body || {};

  if (!audio_url || !formato) {
    return res.status(400).json({ error: 'audio_url and formato are required' });
  }
  if (!FORMATOS.has(formato.toLowerCase())) {
    return res.status(415).json({ error: `Unsupported format: ${formato}` });
  }
  if (!TIPOS.has(tipo)) {
    return res.status(400).json({ error: `tipo must be one of: voz, nota_fiscal` });
  }

  const jobId = crypto.randomUUID();

  // Salvar job (sem a URL real — seguranca)
  await fetch(`${SUPABASE_URL}/rest/v1/openclaw_jobs`, {
    method:  'POST',
    headers: {
      apikey:         SUPABASE_ANON,
      Authorization:  `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer:         'return=representation',
    },
    body: JSON.stringify({
      id:      jobId,
      type:    'audio',
      status:  'queued',
      payload: { formato, tipo, duracao_segundos },
    }),
  });

  // Disparar n8n (se configurado)
  if (N8N_AUDIO_URL) {
    fetch(N8N_AUDIO_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ job_id: jobId, audio_url, formato, tipo }),
      signal:  AbortSignal.timeout(8000),
    }).catch(() => {});
  }

  await logEvent('audio', { status: 'queued', session_id, duration_ms: 0 });

  return res.status(202).json({
    job_id:               jobId,
    status:               'queued',
    tipo,
    estimativa_segundos:  tipo === 'nota_fiscal' ? 20 : 10,
  });
}
```

- [ ] **Step 3.1.2: Configurar workflow n8n para audio/OCR**

No n8n self-hosted (Hostinger):
1. Criar workflow com Webhook trigger.
2. Receber `{ job_id, audio_url, formato, tipo }`.
3. Se `tipo === "nota_fiscal"`: chamar HTTP node -> `POST /api/analisa-foto` com `{ imageUrl: audio_url }`.
4. Extrair `{ valor, fornecedor, data }` da resposta.
5. Chamar HTTP node -> `POST /api/openclaw/command` com `{ command: "adicionar_gasto", params: { valor, categoria: "outros", descricao: fornecedor } }`.
6. Chamar HTTP node -> `POST /api/openclaw/notify` com `{ canal: "whatsapp", mensagem: "NF registrada: R$ X — Y" }`.
7. UPDATE em `openclaw_jobs` status="done".

Salvar URL do webhook em `OPENCLAW_N8N_AUDIO_URL` no Vercel.

- [ ] **Step 3.1.3: Commit**

```bash
git add api/openclaw/audio.js
git commit -m "feat(openclaw): add POST /api/openclaw/audio for async OCR/transcription"
```

---

## Fase 4 — Automacoes avancadas

**Escopo (sem data definida):**

- Feed de atividade no dashboard: widget que le `openclaw_events` e exibe
  ultimos comandos executados em tempo real (polling 30s).
- Rate limit por IP (Upstash Redis ou contador Supabase).
- Cron de limpeza TTL: apagar `openclaw_events` com `created_at < now() - 90 days`
  e `openclaw_jobs` com `status IN ('done','failed') AND updated_at < now() - 7 days`.
- Monitoramento: alerta no WhatsApp se `GET /status` retornar `down` por 2+ checks
  consecutivos (via cron.js existente).
- `command: "agenda"` e `command: "tarefas"` implementados no command.js.
- Rotacao do token `OPENCLAW_GATEWAY_TOKEN` (gerar novo e atualizar no OpenClaw).

---

## Riscos

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| `financeiro_gastos` nao existe no schema | `adicionar_gasto` falha silenciosamente | Auditar schema no inicio da Fase 1 (Task 1.5.2) |
| n8n indisponivel no Hostinger | `/audio` e `/briefing` delivery "whatsapp" nao funcionam | Retornar 202 sem travar; cron de retry na Fase 4 |
| Vercel timeout 10s insuficiente para `resumo_do_dia` | Comando retorna erro sem resposta | Supervisor IA deve responder em < 8s; se nao, usar Vercel background functions |
| OpenClaw nao adotar novos endpoints | Gateway existente sem uso | Fase 1 mantem `/api/webhook` e `/api/comandos` ativos; migracao incremental |
| Token vazado em log de erro | Exposicao de credencial | Nunca logar headers; usar variavel de ambiente separada |
| Duplicata de gastos se network retry do OpenClaw | Gasto inserido 2x | Idempotencia por hash implementada na Fase 1 |
| `openclaw_events` cresce sem limite | Custo Supabase | TTL via cron implementado na Fase 4; nao e critico nas Fases 1-3 |

---

## Dependencias externas

| Dependencia | Onde configurar | Quando necessario |
|-------------|----------------|-------------------|
| `OPENCLAW_GATEWAY_TOKEN` | Vercel env vars | Fase 1 (obrigatorio) |
| `OPENCLAW_N8N_NOTIFY_URL` | Vercel env vars | Fase 2 (opcional para delivery dashboard) |
| `OPENCLAW_N8N_AUDIO_URL` | Vercel env vars | Fase 3 (obrigatorio para OCR) |
| Tabelas `openclaw_events`, `openclaw_jobs` | Supabase migrations | Fase 1 |
| Tabela `notificacoes` | Supabase migrations | Fase 2 |
| n8n workflow audio/OCR | n8n self-hosted Hostinger | Fase 3 |
