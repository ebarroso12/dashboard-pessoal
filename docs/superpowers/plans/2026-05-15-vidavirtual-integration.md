# VidaVirtual Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o dashboard-pessoal com o VidaVirtual, exibindo OS abertas, alertas e status de manutencao em widget dedicado, com dados alimentando o Supervisor IA e o briefing executivo.

**Architecture:** O dashboard lê dados do Supabase do VidaVirtual via service_role (server-side), expondo endpoints `/api/vidavirtual/*` que nunca vazam credenciais para o browser. VidaVirtual adiciona tabelas de negocio (`ordens_servico`, `clientes`, `aparelhos`) como pre-requisito. Comunicacao cross-app usa token interno compartilhado.

**Tech Stack:** Node 20, Vercel API Routes (ES modules), Supabase (`gxavizwcpikvhrbwperg`), React/Vite (VidaVirtual frontend), dashboard.html existente.

---

## AVISO CRITICO — Divergencia entre spec e realidade

O VidaVirtual atual **nao tem** tabelas de negocio. A integracao completa depende de pre-requisito.

| O que o spec pede | Existe no VidaVirtual hoje? |
|-------------------|----------------------------|
| clientes          | NAO |
| ordens_servico    | NAO |
| aparelhos         | NAO |
| pagamentos        | NAO |
| garantias         | NAO |
| pecas             | NAO |
| agenda            | NAO |
| usage_logs        | SIM |
| audit_events      | SIM |
| status / ping     | SIM (via `/api/auth/status`) |

**Supabase VidaVirtual:** `https://gxavizwcpikvhrbwperg.supabase.co`
**Backend local:** `http://127.0.0.1:4317` — nao acessivel da nuvem. Irrelevante para integracao.
**Vercel endpoints existentes:** `/api/auth/*`, `/api/usage/report`, `/api/permissions` — apenas auth/users.

**A service_role colada anteriormente deve ser considerada comprometida.**
Rotacionar em: Supabase Dashboard > gxavizwcpikvhrbwperg > Settings > API > Reset service_role key.
Atualizar `VIDAVIRTUAL_SUPABASE_SERVICE_ROLE_KEY` no Vercel (dashboard-pessoal) apos rotacao.

---

## Escopo — 2 sub-planos independentes

Este plano cobre os dois. Cada um produz software testavel independentemente.

**Sub-plano A** (VidaVirtual repo) — Pre-requisito:
Adicionar tabelas de negocio ao Supabase do VidaVirtual + endpoint de ping com token interno.

**Sub-plano B** (dashboard-pessoal repo) — Integracao:
Endpoints Vercel que leem VidaVirtual + widget no dashboard + Supervisor IA.

Sub-plano A deve ser executado antes do Sub-plano B.
Sub-plano B pode comecar com dados reais (Sub-plano A concluido) ou dados mock (desenvolvimento paralelo).

---

## Variaveis de Ambiente Necessarias

### No Vercel do dashboard-pessoal

```
VIDAVIRTUAL_SUPABASE_URL=https://gxavizwcpikvhrbwperg.supabase.co
VIDAVIRTUAL_SUPABASE_SERVICE_ROLE_KEY=<rotacionar antes de usar>
VIDAVIRTUAL_APP_URL=https://vidavirtual-omega.vercel.app
VIDAVIRTUAL_INTEGRATION_TOKEN=<gerar: openssl rand -hex 32>
```

### No Vercel do VidaVirtual (vidavirtual-omega)

```
VIDAVIRTUAL_INTEGRATION_TOKEN=<mesmo valor acima>
```

Nenhuma variavel com prefixo `VIDAVIRTUAL_` deve aparecer em:
- `dashboard.html` (frontend)
- `App.tsx` / qualquer arquivo client-side
- Logs de erro (truncar antes de logar)
- Commits ou PRs

---

## Arquivos Afetados

### Sub-plano A — VidaVirtual (`C:\Users\Cliente\vidavirtual`)

| Arquivo | Acao | Responsabilidade |
|---------|------|-----------------|
| `supabase/migrations/003_business_tables.sql` | Criar | DDL de ordens_servico, clientes, aparelhos, pagamentos |
| `supabase/migrations/004_rls_business.sql` | Criar | RLS para tabelas de negocio (service_role full, anon nada) |
| `api/integration/ping.js` | Criar | GET /api/integration/ping — health check autenticado com token interno |
| `api/integration/summary.js` | Criar | GET /api/integration/summary — dados agregados para o dashboard |

### Sub-plano B — dashboard-pessoal (`C:\Users\Cliente\dashboard-pessoal`)

| Arquivo | Acao | Responsabilidade |
|---------|------|-----------------|
| `api/vidavirtual/_vv.js` | Criar | Cliente Supabase do VidaVirtual (service_role, server-side) |
| `api/vidavirtual/status.js` | Criar | GET /api/vidavirtual/status |
| `api/vidavirtual/os.js` | Criar | GET /api/vidavirtual/os/recentes |
| `api/vidavirtual/clientes.js` | Criar | GET /api/vidavirtual/clientes/recentes |
| `api/vidavirtual/sync.js` | Criar | POST /api/vidavirtual/sync (pull de dados para cache) |
| `api/vidavirtual/notify.js` | Criar | POST /api/vidavirtual/notify (alerta -> dashboard) |
| `api/supervisor.js` | Modificar | Adicionar ferramenta `vidavirtual_status` ao Supervisor IA |
| `api/briefing.js` | Modificar | Incluir dados do VidaVirtual no briefing |
| `dashboard.html` | Modificar | Adicionar widget VidaVirtual (OS abertas, alertas, link) |

---

## Sub-plano A — Tabelas de Negocio + Ping (VidaVirtual)

### Task A.1 — DDL das tabelas de negocio

**Arquivos:**
- Create: `supabase/migrations/003_business_tables.sql` (em `C:\Users\Cliente\vidavirtual`)
- Create: `supabase/migrations/004_rls_business.sql`

- [ ] **Step A.1.1: Criar migration das tabelas**

```sql
-- supabase/migrations/003_business_tables.sql
-- Projeto: gxavizwcpikvhrbwperg
-- Aplicar via: Supabase Studio > SQL Editor

CREATE TABLE IF NOT EXISTS clientes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL,
  telefone   TEXT,
  email      TEXT,
  cpf        TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aparelhos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,         -- 'notebook' | 'desktop' | 'celular' | 'tablet'
  marca       TEXT,
  modelo      TEXT,
  numero_serie TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES clientes(id),
  aparelho_id   UUID REFERENCES aparelhos(id),
  descricao     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'aberta',
  -- status: 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'entregue' | 'cancelada'
  prioridade    TEXT NOT NULL DEFAULT 'normal',  -- 'urgente' | 'normal' | 'baixa'
  valor_orcado  NUMERIC(10,2),
  valor_final   NUMERIC(10,2),
  data_entrada  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista DATE,
  data_saida    DATE,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id      UUID NOT NULL REFERENCES ordens_servico(id),
  valor      NUMERIC(10,2) NOT NULL,
  metodo     TEXT NOT NULL,   -- 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito'
  status     TEXT NOT NULL DEFAULT 'pendente',  -- 'pendente' | 'recebido'
  data       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_status ON ordens_servico (status);
CREATE INDEX IF NOT EXISTS idx_os_created ON ordens_servico (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos (status);
```

- [ ] **Step A.1.2: Criar RLS**

```sql
-- supabase/migrations/004_rls_business.sql
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aparelhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

-- Somente service_role acessa. Anon = sem acesso.
-- service_role bypassa RLS automaticamente no Supabase.
-- Adicionar politicas restritivas para garantir que anon nao leia:
CREATE POLICY "clientes_deny_anon" ON clientes
  FOR ALL TO anon USING (false);

CREATE POLICY "aparelhos_deny_anon" ON aparelhos
  FOR ALL TO anon USING (false);

CREATE POLICY "os_deny_anon" ON ordens_servico
  FOR ALL TO anon USING (false);

CREATE POLICY "pagamentos_deny_anon" ON pagamentos
  FOR ALL TO anon USING (false);
```

- [ ] **Step A.1.3: Aplicar no Supabase de VidaVirtual**

Abrir: Supabase Studio > gxavizwcpikvhrbwperg > SQL Editor
Colar e executar `003_business_tables.sql`.
Colar e executar `004_rls_business.sql`.
Verificar que as 4 tabelas aparecem em Table Editor.

- [ ] **Step A.1.4: Inserir dados de teste**

```sql
-- Dados minimos para testar a integracao
INSERT INTO clientes (nome, telefone) VALUES
  ('Joao Silva', '(11) 99999-0001'),
  ('Maria Souza', '(11) 99999-0002');

INSERT INTO aparelhos (cliente_id, tipo, marca, modelo)
SELECT id, 'notebook', 'Dell', 'Inspiron 15'
FROM clientes WHERE nome = 'Joao Silva' LIMIT 1;

INSERT INTO ordens_servico (cliente_id, aparelho_id, descricao, status, prioridade, valor_orcado, data_prevista)
SELECT
  c.id, a.id,
  'Tela quebrada — troca', 'em_andamento', 'urgente', 450.00,
  CURRENT_DATE + INTERVAL '3 days'
FROM clientes c
JOIN aparelhos a ON a.cliente_id = c.id
WHERE c.nome = 'Joao Silva';

INSERT INTO ordens_servico (cliente_id, descricao, status, prioridade, data_prevista)
SELECT id, 'Limpeza e formatacao', 'aguardando_peca', 'normal',
  CURRENT_DATE + INTERVAL '5 days'
FROM clientes WHERE nome = 'Maria Souza' LIMIT 1;
```

- [ ] **Step A.1.5: Commit em VidaVirtual**

```bash
cd C:\Users\Cliente\vidavirtual
git add supabase/migrations/003_business_tables.sql
git add supabase/migrations/004_rls_business.sql
git commit -m "feat(db): add business tables (clientes, aparelhos, ordens_servico, pagamentos)"
git push origin main
```

---

### Task A.2 — Endpoint de ping + summary no VidaVirtual

**Arquivos:**
- Create: `api/integration/ping.js` (em `C:\Users\Cliente\vidavirtual`)
- Create: `api/integration/summary.js`

- [ ] **Step A.2.1: Criar ping.js**

```javascript
// api/integration/ping.js
// GET /api/integration/ping
// Autentica com VIDAVIRTUAL_INTEGRATION_TOKEN no header X-Integration-Token.
// Retorna status do app para o dashboard-pessoal.

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.VIDAVIRTUAL_DASHBOARD_URL || '*')
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }

  const token = req.headers['x-integration-token']
  const expected = process.env.VIDAVIRTUAL_INTEGRATION_TOKEN || ''
  if (!expected || token !== expected) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({
    status: 'ok',
    app: 'vidavirtual',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }))
}
```

- [ ] **Step A.2.2: Criar summary.js**

```javascript
// api/integration/summary.js
// GET /api/integration/summary
// Retorna dados agregados para o widget do dashboard.
// Autentica com X-Integration-Token.

import { getAdminClient } from '../_lib/supabase.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.VIDAVIRTUAL_DASHBOARD_URL || '*')
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return }

  const token = req.headers['x-integration-token']
  const expected = process.env.VIDAVIRTUAL_INTEGRATION_TOKEN || ''
  if (!expected || token !== expected) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  try {
    const supabase = getAdminClient()

    const [osResult, pagResult] = await Promise.allSettled([
      supabase
        .from('ordens_servico')
        .select('id, status, prioridade, data_prevista, descricao, updated_at')
        .in('status', ['aberta', 'em_andamento', 'aguardando_peca'])
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('pagamentos')
        .select('id, valor, status, os_id')
        .eq('status', 'pendente')
        .limit(20),
    ])

    const os = osResult.status === 'fulfilled' ? (osResult.value.data ?? []) : []
    const pag = pagResult.status === 'fulfilled' ? (pagResult.value.data ?? []) : []

    const hoje = new Date().toISOString().slice(0, 10)
    const atrasadas = os.filter(o => o.data_prevista && o.data_prevista < hoje)
    const aguardandoPeca = os.filter(o => o.status === 'aguardando_peca')
    const totalPendente = pag.reduce((acc, p) => acc + Number(p.valor || 0), 0)

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      os_abertas:       os.length,
      os_atrasadas:     atrasadas.length,
      aguardando_peca:  aguardandoPeca.length,
      pagamentos_pendentes: pag.length,
      valor_pendente:   totalPendente,
      os_recentes:      os.slice(0, 5),
      gerado_em:        new Date().toISOString(),
    }))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Internal error' }))
  }
}
```

- [ ] **Step A.2.3: Adicionar env vars no VidaVirtual (Vercel)**

Vercel Dashboard > vidavirtual-omega > Settings > Environment Variables:
```
VIDAVIRTUAL_INTEGRATION_TOKEN=<valor gerado: openssl rand -hex 32>
VIDAVIRTUAL_DASHBOARD_URL=https://dashboard-pessoal-edson.vercel.app
SUPABASE_SERVICE_ROLE_KEY=<rotacionar primeiro — NAO usar valor anterior>
```

- [ ] **Step A.2.4: Testar ping em producao**

```bash
curl https://vidavirtual-omega.vercel.app/api/integration/ping \
  -H "X-Integration-Token: <token>"
```

Esperado: `{ "status": "ok", "app": "vidavirtual", "timestamp": "..." }`

Sem token: esperado `401 { "error": "Unauthorized" }`

- [ ] **Step A.2.5: Commit e push VidaVirtual**

```bash
cd C:\Users\Cliente\vidavirtual
git add api/integration/ping.js api/integration/summary.js
git commit -m "feat(integration): add ping and summary endpoints for dashboard integration"
git push origin main
```

---

## Sub-plano B — Dashboard Endpoints + Widget

### Task B.1 — Cliente Supabase VidaVirtual (shared)

**Arquivos:**
- Create: `api/vidavirtual/_vv.js` (em `C:\Users\Cliente\dashboard-pessoal`)

- [ ] **Step B.1.1: Criar _vv.js**

```javascript
// api/vidavirtual/_vv.js
// Cliente Supabase do VidaVirtual. Nunca importar no frontend.
// Usa VIDAVIRTUAL_SUPABASE_SERVICE_ROLE_KEY (server-side only).

const VV_URL = process.env.VIDAVIRTUAL_SUPABASE_URL || 'https://gxavizwcpikvhrbwperg.supabase.co'
const VV_KEY = process.env.VIDAVIRTUAL_SUPABASE_SERVICE_ROLE_KEY || ''
const VV_APP_URL = process.env.VIDAVIRTUAL_APP_URL || 'https://vidavirtual-omega.vercel.app'
const VV_TOKEN = process.env.VIDAVIRTUAL_INTEGRATION_TOKEN || ''

export async function vvFetch(path, opts = {}) {
  if (!VV_KEY) throw new Error('VIDAVIRTUAL_SUPABASE_SERVICE_ROLE_KEY nao configurada')
  const res = await fetch(`${VV_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:          VV_KEY,
      Authorization:   `Bearer ${VV_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
      ...(opts.headers || {}),
    },
  })
  const txt = await res.text()
  try { return { ok: res.ok, status: res.status, data: JSON.parse(txt) } }
  catch { return { ok: res.ok, status: res.status, data: txt } }
}

export async function vvPing() {
  if (!VV_TOKEN) return { status: 'error', reason: 'token nao configurado' }
  try {
    const r = await fetch(`${VV_APP_URL}/api/integration/ping`, {
      headers: { 'X-Integration-Token': VV_TOKEN },
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) return { status: 'error', reason: `HTTP ${r.status}` }
    return await r.json()
  } catch (e) {
    return { status: 'error', reason: e.message }
  }
}

export async function vvSummary() {
  if (!VV_TOKEN) return null
  try {
    const r = await fetch(`${VV_APP_URL}/api/integration/summary`, {
      headers: { 'X-Integration-Token': VV_TOKEN },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}
```

- [ ] **Step B.1.2: Adicionar env vars no dashboard-pessoal (Vercel)**

Vercel Dashboard > dashboard-pessoal-edson > Settings > Environment Variables:
```
VIDAVIRTUAL_SUPABASE_URL=https://gxavizwcpikvhrbwperg.supabase.co
VIDAVIRTUAL_SUPABASE_SERVICE_ROLE_KEY=<valor rotacionado — NAO usar valor anterior>
VIDAVIRTUAL_APP_URL=https://vidavirtual-omega.vercel.app
VIDAVIRTUAL_INTEGRATION_TOKEN=<mesmo valor configurado no VidaVirtual>
```

Adicionar tambem ao `.env.local` do dashboard-pessoal (nunca commitar).

- [ ] **Step B.1.3: Commit**

```bash
cd C:\Users\Cliente\dashboard-pessoal
git add api/vidavirtual/_vv.js
git commit -m "feat(vidavirtual): add shared Supabase client for VidaVirtual integration"
```

---

### Task B.2 — GET /api/vidavirtual/status

**Arquivos:**
- Create: `api/vidavirtual/status.js`

- [ ] **Step B.2.1: Criar status.js**

```javascript
// api/vidavirtual/status.js
// GET /api/vidavirtual/status
// Retorna health do VidaVirtual: ping + contagens do Supabase.
// Autenticado com X-Webhook-Token (mesmo token do dashboard).

import { vvPing, vvFetch } from './_vv.js'

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || ''

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://dashboard-pessoal-edson.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token')
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers['x-webhook-token']
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const [ping, osAbertasRes, osAtrasadasRes] = await Promise.allSettled([
    vvPing(),
    vvFetch('/ordens_servico?select=id&status=in.(aberta,em_andamento,aguardando_peca)'),
    vvFetch('/ordens_servico?select=id&status=in.(aberta,em_andamento)&data_prevista=lt.' + new Date().toISOString().slice(0,10)),
  ])

  const appOk = ping.status === 'fulfilled' && ping.value?.status === 'ok'
  const osAbertas = osAbertasRes.status === 'fulfilled'
    ? (Array.isArray(osAbertasRes.value?.data) ? osAbertasRes.value.data.length : 0) : 0
  const osAtrasadas = osAtrasadasRes.status === 'fulfilled'
    ? (Array.isArray(osAtrasadasRes.value?.data) ? osAtrasadasRes.value.data.length : 0) : 0

  return res.status(200).json({
    status:       appOk ? 'ok' : 'degraded',
    app_online:   appOk,
    os_abertas:   osAbertas,
    os_atrasadas: osAtrasadas,
    timestamp:    new Date().toISOString(),
    app_url:      process.env.VIDAVIRTUAL_APP_URL || '',
  })
}
```

- [ ] **Step B.2.2: Testar localmente (dev)**

```bash
cd C:\Users\Cliente\dashboard-pessoal
vercel dev
```

```bash
curl http://localhost:3000/api/vidavirtual/status \
  -H "X-Webhook-Token: oc_edson_2026_secure"
```

Esperado: `{ "status": "ok"|"degraded", "os_abertas": N, "os_atrasadas": N }`

- [ ] **Step B.2.3: Commit**

```bash
git add api/vidavirtual/status.js
git commit -m "feat(vidavirtual): add GET /api/vidavirtual/status"
```

---

### Task B.3 — GET /api/vidavirtual/os/recentes

**Arquivos:**
- Create: `api/vidavirtual/os.js`

- [ ] **Step B.3.1: Criar os.js**

```javascript
// api/vidavirtual/os.js
// GET /api/vidavirtual/os/recentes
// Retorna ultimas ordens de servico abertas/em andamento.

import { vvFetch } from './_vv.js'

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || ''

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://dashboard-pessoal-edson.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers['x-webhook-token']
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const result = await vvFetch(
    '/ordens_servico?select=id,descricao,status,prioridade,data_prevista,updated_at,cliente_id' +
    '&status=in.(aberta,em_andamento,aguardando_peca)' +
    '&order=updated_at.desc&limit=10'
  )

  if (!result.ok) {
    return res.status(503).json({ error: 'VidaVirtual Supabase indisponivel' })
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const os = (result.data || []).map(o => ({
    ...o,
    atrasada: o.data_prevista ? o.data_prevista < hoje : false,
  }))

  return res.status(200).json({ os, total: os.length })
}
```

- [ ] **Step B.3.2: Testar**

```bash
curl http://localhost:3000/api/vidavirtual/os/recentes \
  -H "X-Webhook-Token: oc_edson_2026_secure"
```

Esperado: `{ "os": [...], "total": N }`
Com dados de teste da Task A.1.4: deve retornar as 2 OS inseridas.

- [ ] **Step B.3.3: Commit**

```bash
git add api/vidavirtual/os.js
git commit -m "feat(vidavirtual): add GET /api/vidavirtual/os/recentes"
```

---

### Task B.4 — GET /api/vidavirtual/clientes/recentes

**Arquivos:**
- Create: `api/vidavirtual/clientes.js`

- [ ] **Step B.4.1: Criar clientes.js**

```javascript
// api/vidavirtual/clientes.js
// GET /api/vidavirtual/clientes/recentes

import { vvFetch } from './_vv.js'

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || ''

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://dashboard-pessoal-edson.vercel.app')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers['x-webhook-token']
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const result = await vvFetch(
    '/clientes?select=id,nome,telefone,created_at&order=created_at.desc&limit=10'
  )

  if (!result.ok) {
    return res.status(503).json({ error: 'VidaVirtual Supabase indisponivel' })
  }

  return res.status(200).json({ clientes: result.data || [], total: (result.data || []).length })
}
```

- [ ] **Step B.4.2: Commit**

```bash
git add api/vidavirtual/clientes.js
git commit -m "feat(vidavirtual): add GET /api/vidavirtual/clientes/recentes"
```

---

### Task B.5 — POST /api/vidavirtual/notify

**Arquivos:**
- Create: `api/vidavirtual/notify.js`

- [ ] **Step B.5.1: Criar notify.js**

```javascript
// api/vidavirtual/notify.js
// POST /api/vidavirtual/notify
// Recebe alertas do VidaVirtual e os injeta no sistema de alertas do dashboard.
// Chamado pelo VidaVirtual (via X-Integration-Token) ou pelo cron do dashboard.

import { adminFetch } from '../_supabase-admin.js'

const VV_TOKEN    = process.env.VIDAVIRTUAL_INTEGRATION_TOKEN || ''
const DASH_TOKEN  = process.env.WEBHOOK_TOKEN || ''

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  // Aceitar token de integracao (VidaVirtual -> dashboard) OU token do dashboard
  const token = req.headers['x-integration-token'] || req.headers['x-webhook-token']
  if (token !== VV_TOKEN && token !== DASH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { tipo, mensagem, severidade = 'info', fonte = 'vidavirtual' } = req.body || {}
  if (!mensagem) return res.status(400).json({ error: 'mensagem is required' })

  await adminFetch('/supervisor_logs', {
    method: 'POST',
    body: JSON.stringify({
      severidade: severidade === 'error' ? 'critico' : 'aviso',
      mensagem,
      componente: fonte,
    }),
  })

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step B.5.2: Commit**

```bash
git add api/vidavirtual/notify.js
git commit -m "feat(vidavirtual): add POST /api/vidavirtual/notify"
```

---

### Task B.6 — POST /api/vidavirtual/sync (cache local)

**Arquivos:**
- Create: `api/vidavirtual/sync.js`

- [ ] **Step B.6.1: Criar sync.js**

```javascript
// api/vidavirtual/sync.js
// POST /api/vidavirtual/sync
// Puxa summary do VidaVirtual e salva em dados_assistente do dashboard
// para acesso rapido sem re-consultar o Supabase do VidaVirtual a cada request.

import { adminFetch } from '../_supabase-admin.js'
import { vvSummary } from './_vv.js'

const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || ''

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers['x-webhook-token']
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const summary = await vvSummary()
  if (!summary) {
    return res.status(503).json({ error: 'VidaVirtual indisponivel' })
  }

  // Salvar em dados_assistente (tabela existente no dashboard)
  await adminFetch('/dados_assistente', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      tipo: 'vidavirtual',
      dados: summary,
      atualizado_em: new Date().toISOString(),
    }),
  })

  return res.status(200).json({ ok: true, summary })
}
```

- [ ] **Step B.6.2: Verificar schema de dados_assistente**

Confirmar no Supabase do dashboard que `dados_assistente` aceita `tipo = 'vidavirtual'`
e que a coluna `tipo` tem unicidade ou resolve conflito.
Se precisar de upsert por `tipo`, verificar se Supabase aceita `Prefer: resolution=merge-duplicates`
ou se precisa de `ON CONFLICT (tipo) DO UPDATE`.

- [ ] **Step B.6.3: Commit**

```bash
git add api/vidavirtual/sync.js
git commit -m "feat(vidavirtual): add POST /api/vidavirtual/sync to cache summary"
```

---

### Task B.7 — Supervisor IA: ferramenta vidavirtual_status

**Arquivos:**
- Modify: `api/supervisor.js` (em `C:\Users\Cliente\dashboard-pessoal`)

- [ ] **Step B.7.1: Ler supervisor.js antes de editar**

```bash
# Ler linhas 57-120 para ver o array TOOLS antes de modificar
```

Verificar: como as ferramentas sao declaradas (array `TOOLS` com objetos `{ type: 'function', function: { name, description, parameters } }`).
Verificar: como os handlers das ferramentas sao chamados (provavelmente um switch/case).

- [ ] **Step B.7.2: Adicionar ferramenta ao array TOOLS**

Dentro do array `TOOLS` existente, adicionar:

```javascript
{
  type: 'function',
  function: {
    name: 'vidavirtual_status',
    description: 'Retorna status do VidaVirtual: OS abertas, atrasadas, pagamentos pendentes e status do app.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
},
```

- [ ] **Step B.7.3: Adicionar handler da ferramenta**

No bloco de execucao de ferramentas (buscar por `tool_call.function.name` ou similar), adicionar:

```javascript
case 'vidavirtual_status': {
  const BASE = 'https://dashboard-pessoal-edson.vercel.app'
  const TOKEN = process.env.WEBHOOK_TOKEN || ''
  try {
    const r = await fetch(`${BASE}/api/vidavirtual/status`, {
      headers: { 'X-Webhook-Token': TOKEN },
      signal: AbortSignal.timeout(5000),
    })
    const d = await r.json()
    result = JSON.stringify(d)
  } catch (e) {
    result = JSON.stringify({ status: 'error', reason: e.message })
  }
  break
}
```

- [ ] **Step B.7.4: Commit**

```bash
git add api/supervisor.js
git commit -m "feat(vidavirtual): add vidavirtual_status tool to Supervisor IA"
```

---

### Task B.8 — Briefing: incluir VidaVirtual

**Arquivos:**
- Modify: `api/briefing.js`

- [ ] **Step B.8.1: Ler briefing.js antes de editar**

Verificar o bloco `Promise.allSettled` existente (linhas 22-32).
Verificar como outros dados sao incluidos no texto final do briefing.

- [ ] **Step B.8.2: Adicionar consulta VidaVirtual ao Promise.allSettled**

No array de `Promise.allSettled`, adicionar:

```javascript
adminFetch('/dados_assistente?tipo=eq.vidavirtual&select=dados&limit=1&order=atualizado_em.desc'),
```

- [ ] **Step B.8.3: Processar resultado e incluir no texto**

Apos extrair os outros resultados, adicionar:

```javascript
const vvRaw = /* resultado do allSettled acima */
const vv = vvRaw?.status === 'fulfilled' ? (vvRaw?.value?.[0]?.dados || null) : null
if (vv) fontes.push('vidavirtual')
```

No bloco de montagem do texto do briefing, adicionar:

```javascript
if (vv) {
  const atrasadas = vv.os_atrasadas > 0 ? ` (${vv.os_atrasadas} ATRASADAS)` : ''
  partes.push(`VidaVirtual: ${vv.os_abertas} OS abertas${atrasadas}, ${vv.pagamentos_pendentes} pagamentos pendentes.`)
}
```

- [ ] **Step B.8.4: Commit**

```bash
git add api/briefing.js
git commit -m "feat(vidavirtual): include VidaVirtual summary in executive briefing"
```

---

### Task B.9 — Widget no dashboard.html

**Arquivos:**
- Modify: `dashboard.html`

- [ ] **Step B.9.1: Localizar ponto de insercao no dashboard.html**

Buscar em `dashboard.html`:
- A secao "Infra" ou seção de widgets de sistema
- Padrao de widget existente para copiar estrutura HTML/CSS

```bash
grep -n "widget\|secao\|infra\|supervisor" dashboard.html | head -30
```

Identificar linha onde inserir o novo widget.

- [ ] **Step B.9.2: Adicionar HTML do widget**

Inserir o HTML do widget na secao correta:

```html
<!-- Widget VidaVirtual -->
<div class="widget" id="widget-vidavirtual">
  <div class="widget-header">
    <span class="widget-title">VidaVirtual</span>
    <span id="vv-status-badge" class="badge badge-loading">...</span>
  </div>
  <div class="widget-body" id="vv-widget-body">
    <div class="vv-metrics">
      <div class="vv-metric">
        <span class="vv-metric-value" id="vv-os-abertas">-</span>
        <span class="vv-metric-label">OS abertas</span>
      </div>
      <div class="vv-metric vv-metric-alert" id="vv-atrasadas-wrap">
        <span class="vv-metric-value" id="vv-os-atrasadas">-</span>
        <span class="vv-metric-label">Atrasadas</span>
      </div>
      <div class="vv-metric">
        <span class="vv-metric-value" id="vv-pag-pendentes">-</span>
        <span class="vv-metric-label">Pagamentos</span>
      </div>
    </div>
    <a href="https://vidavirtual-omega.vercel.app"
       target="_blank" rel="noopener"
       class="btn btn-sm btn-secondary vv-link">
      Abrir VidaVirtual
    </a>
  </div>
</div>
```

- [ ] **Step B.9.3: Adicionar CSS do widget**

Na secao de CSS do `dashboard.html`, adicionar:

```css
.vv-metrics { display: flex; gap: 12px; margin-bottom: 12px; }
.vv-metric { flex: 1; text-align: center; padding: 8px; background: var(--bg-card); border-radius: 6px; }
.vv-metric-value { display: block; font-size: 1.6rem; font-weight: 700; color: var(--text-primary); }
.vv-metric-label { display: block; font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px; }
.vv-metric-alert .vv-metric-value { color: var(--color-error, #e53e3e); }
.vv-link { display: block; text-align: center; margin-top: 8px; }
.badge-loading { background: var(--bg-muted); color: var(--text-secondary); }
.badge-ok { background: #c6f6d5; color: #276749; }
.badge-degraded { background: #feebc8; color: #7b341e; }
.badge-error { background: #fed7d7; color: #742a2a; }
```

- [ ] **Step B.9.4: Adicionar JS de carregamento**

Na secao JavaScript do `dashboard.html`, adicionar a funcao e chamada:

```javascript
async function loadVidaVirtual() {
  try {
    const res = await fetch('/api/vidavirtual/status', {
      headers: { 'X-Webhook-Token': WEBHOOK_TOKEN }
    })
    const d = await res.json()

    document.getElementById('vv-os-abertas').textContent   = d.os_abertas ?? '-'
    document.getElementById('vv-os-atrasadas').textContent = d.os_atrasadas ?? '-'
    document.getElementById('vv-pag-pendentes').textContent = '-' // sync via /api/vidavirtual/sync

    const badge = document.getElementById('vv-status-badge')
    badge.textContent = d.status === 'ok' ? 'Online' : 'Degradado'
    badge.className = `badge badge-${d.status === 'ok' ? 'ok' : 'degraded'}`

    if (d.os_atrasadas > 0) {
      document.getElementById('vv-atrasadas-wrap').style.display = 'block'
    }
  } catch {
    const badge = document.getElementById('vv-status-badge')
    if (badge) { badge.textContent = 'Offline'; badge.className = 'badge badge-error' }
  }
}

// Adicionar ao init do dashboard junto com outros widgets
// Exemplo: loadVidaVirtual()
```

Buscar no dashboard.html onde outros widgets sao inicializados (`loadSupervisor`, `loadBriefing`, etc.)
e adicionar `loadVidaVirtual()` no mesmo bloco.

- [ ] **Step B.9.5: Testar no browser**

Abrir `http://localhost:5500/dashboard.html` (ou equivalente local).
Verificar que o widget aparece, carrega os numeros e o badge de status.
Testar com DevTools: simular erro de rede e verificar que badge muda para "Offline".

- [ ] **Step B.9.6: Commit**

```bash
git add dashboard.html
git commit -m "feat(vidavirtual): add VidaVirtual widget to dashboard"
```

---

### Task B.10 — Deploy e smoke test

- [ ] **Step B.10.1: Push final**

```bash
cd C:\Users\Cliente\dashboard-pessoal
git push origin main
```

- [ ] **Step B.10.2: Smoke test em producao**

```bash
curl https://dashboard-pessoal-edson.vercel.app/api/vidavirtual/status \
  -H "X-Webhook-Token: oc_edson_2026_secure"
```

Esperado: `{ "status": "ok"|"degraded", "os_abertas": N, "os_atrasadas": N }`

```bash
curl https://dashboard-pessoal-edson.vercel.app/api/vidavirtual/os/recentes \
  -H "X-Webhook-Token: oc_edson_2026_secure"
```

Esperado: `{ "os": [...], "total": N }`

- [ ] **Step B.10.3: Verificar widget no browser**

Abrir `https://dashboard-pessoal-edson.vercel.app`.
Widget VidaVirtual deve aparecer com numeros reais e badge "Online".

---

## Roadmap Incremental

| Fase | Escopo | Pre-requisito |
|------|--------|---------------|
| 1 | Sub-plano A: tabelas de negocio + ping/summary | Rotacao da service_role |
| 2 | Sub-plano B Tasks B.1-B.3: cliente vv, status, OS | Fase 1 concluida |
| 3 | Sub-plano B Tasks B.4-B.6: clientes, notify, sync | Fase 2 concluida |
| 4 | Sub-plano B Tasks B.7-B.8: Supervisor IA + briefing | Fase 3 concluida |
| 5 | Sub-plano B Task B.9-B.10: widget + deploy | Fase 4 concluida |

---

## Criterios de Aceite (por fase)

### Fase 1 (VidaVirtual)
- [ ] Tabelas `clientes`, `aparelhos`, `ordens_servico`, `pagamentos` existem no Supabase `gxavizwcpikvhrbwperg`.
- [ ] RLS configurado: anon sem acesso, service_role com acesso total.
- [ ] `GET /api/integration/ping` com token correto retorna `{ status: "ok" }`.
- [ ] `GET /api/integration/ping` sem token retorna `401`.
- [ ] `GET /api/integration/summary` retorna contagens agregadas.
- [ ] Service_role anterior rotacionado. Novo valor configurado no Vercel do VidaVirtual.

### Fase 2 (Dashboard)
- [ ] `GET /api/vidavirtual/status` retorna `{ status, os_abertas, os_atrasadas }`.
- [ ] Sem `VIDAVIRTUAL_SUPABASE_SERVICE_ROLE_KEY` configurada: endpoint retorna `500` (nao silencia o erro).
- [ ] `GET /api/vidavirtual/os/recentes` retorna lista de OS com campo `atrasada: bool`.

### Fase 3 (Dashboard)
- [ ] `POST /api/vidavirtual/sync` salva summary em `dados_assistente` com `tipo = 'vidavirtual'`.
- [ ] `POST /api/vidavirtual/notify` com token de integracao insere em `supervisor_logs`.

### Fase 4 (Supervisor IA + briefing)
- [ ] Supervisor IA: ao perguntar "status do vidavirtual", chama ferramenta e retorna dados reais.
- [ ] Briefing: quando `dados_assistente` tem entrada `vidavirtual`, inclui no resumo do dia.

### Fase 5 (Widget)
- [ ] Widget aparece no dashboard sem quebrar layout mobile.
- [ ] Badge "Online"/"Degradado"/"Offline" reflete status real.
- [ ] Botao "Abrir VidaVirtual" abre `https://vidavirtual-omega.vercel.app` em nova aba.
- [ ] Com VidaVirtual offline: badge "Offline", numeros exibem "-", sem erro JS no console.

---

## Riscos

| Risco | Impacto | Mitigacao |
|-------|---------|-----------|
| Service_role comprometida nao rotacionada | CRITICO — accesso nao autorizado ao Supabase do VidaVirtual | Rotacionar ANTES de qualquer implementacao. Nao iniciar Task B.1 sem rotacao. |
| VidaVirtual Supabase sem tabelas de negocio | Sub-plano B retorna dados vazios | Tasks A.1 sao pre-requisito obrigatorio. Sub-plano B funciona mas retorna zeros. |
| `dados_assistente` nao aceita upsert por `tipo` | sync.js falha silenciosamente ou cria duplicatas | Verificar schema antes da Task B.6 (Step B.6.2). |
| `supervisor.js` tem estrutura de ferramentas diferente do esperado | Task B.7 exige leitura cuidadosa antes de editar | Step B.7.1 obriga leitura do arquivo antes de qualquer edicao. |
| `dashboard.html` nao tem secao Infra visivel | Widget inserido em lugar errado ou invisivel | Step B.9.1 obriga grep antes de inserir HTML. |
| WEBHOOK_TOKEN diferente entre `/api/vidavirtual/*` e o token real | 401 em producao | Verificar qual env var usar: `WEBHOOK_TOKEN` ou `OPENCLAW_GATEWAY_TOKEN`. Usar o mesmo que outros endpoints usam. |
| Vercel nao roteia `api/vidavirtual/os.js` para `/api/vidavirtual/os` | 404 em producao | Testar com `vercel dev` antes do push. Se necessario, adicionar rewrite no `vercel.json`. |
