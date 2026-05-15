# OpenClaw Gateway API — Design

> Documento de design. Versao: 1.0. Data: 2026-05-15.
> Nao ha codigo implementado. Este documento precede a implementacao.

---

## 1. Objetivo

### O que resolve

O OpenClaw hoje envia mensagens/comandos/audio para endpoints espalhados
(`/api/webhook`, `/api/comandos`, `/api/supervisor`) sem contrato formal,
sem logging centralizado, sem rate limit, e sem resposta estruturada uniforme.

O Gateway centraliza TUDO que vem do OpenClaw em uma camada organizada:
`/api/openclaw/*`.

### Por que existe

- Um ponto de entrada com autenticacao, validacao e logging uniformes.
- Contratos claros de payload/resposta que o OpenClaw pode depender.
- Visibilidade: todo comando registrado com id, origem, status, timestamp.
- Separacao de responsabilidades: o Gateway roteia; o Supervisor IA processa.

### O que substitui

| Antes | Depois |
|-------|--------|
| `POST /api/webhook` para log de voz | `POST /api/openclaw/message` |
| `POST /api/comandos` para keyword dispatch | `POST /api/openclaw/command` |
| `POST /api/briefing` chamado diretamente | `POST /api/openclaw/briefing` |
| Notificacao via n8n sem endpoint padrao | `POST /api/openclaw/notify` |
| Health check manual via Supabase/Vercel | `GET /api/openclaw/status` |

### O que NAO substitui

- O OpenClaw em si (interface humana/voz no `openclaw.n8ndredson.com`).
- O Supervisor IA (`/api/supervisor`) - continua existindo, o Gateway chama ele.
- O n8n (automacoes internas) - continua existindo, o Gateway dispara webhooks.
- O Supabase (banco) - continua sendo a fonte de dados.
- Os endpoints legados (`/api/webhook`, `/api/comandos`) - ficam ativos para
  compatibilidade retroativa ate o OpenClaw ser migrado.

---

## 2. Endpoints

```
POST /api/openclaw/message    — mensagem livre (texto ou voz transcrita)
POST /api/openclaw/audio      — audio raw (ogg/mp3) para transcricao + OCR
POST /api/openclaw/command    — comando estruturado (keyword + params)
POST /api/openclaw/briefing   — acionar geracao/entrega de briefing executivo
POST /api/openclaw/notify     — enviar notificacao ao usuario
GET  /api/openclaw/status     — health check de todos os servicos integrados
```

---

## 3. Especificacao dos Endpoints

### Auth (todos os endpoints)

```
Header: X-Webhook-Token: <OPENCLAW_GATEWAY_TOKEN>
```

`OPENCLAW_GATEWAY_TOKEN` e definido em `.env.local` (Vercel env var).
Valor atual: mesmo token de `WEBHOOK_TOKEN` (`oc_edson_2026_secure`) para
compatibilidade, mas deve ser rotacionado na Fase 1.

Validacao: se header ausente ou valor incorreto -> `401 { "error": "Unauthorized" }`.

---

### POST /api/openclaw/message

**Proposito:** receber qualquer mensagem livre do OpenClaw (texto digitado, voz
transcrita, resposta ja gerada). Salva no historico e, opcionalmente, encaminha
ao Supervisor IA para processamento adicional.

**Payload:**
```json
{
  "texto":    "string (required)",
  "resposta": "string (optional — resposta ja gerada pelo OpenClaw)",
  "tipo":     "texto | voz (optional, default: texto)",
  "de":       "string (optional, default: WhatsApp)",
  "session_id": "string (optional — para correlacao de sessao)"
}
```

**Resposta 200:**
```json
{
  "id":         "uuid",
  "status":     "saved",
  "created_at": "ISO8601"
}
```

**Erros:**
| Codigo | Condicao |
|--------|----------|
| 400 | `texto` ausente ou vazio |
| 401 | Token invalido |
| 500 | Falha ao salvar no Supabase |

**Timeout:** 8s (Vercel serverless default).

**Logs:** salvar `{ id, tipo, de, texto_length, session_id, created_at }`.
Nunca logar o conteudo completo de `texto` ou `resposta`.

**Idempotencia:** nao necessaria. Cada mensagem e um evento unico.

**Tabela Supabase:** `comandos` (existente, compatibilidade mantida).

---

### POST /api/openclaw/command

**Proposito:** receber comandos estruturados do OpenClaw. O Gateway valida,
identifica o handler correto, executa e retorna resposta pronta para o usuario.

**Payload:**
```json
{
  "command":    "string (required)",
  "params":     "object (optional)",
  "session_id": "string (optional)"
}
```

**Comandos suportados (Fase 1+2):**

| command | params | handler interno |
|---------|--------|-----------------|
| `resumo_do_dia` | `{}` | `/api/supervisor` |
| `status_sistemas` | `{}` | `/api/openclaw/status` (interno) |
| `agenda` | `{ "dias": 7 }` | `/api/comandos` handler `agenda` |
| `tarefas` | `{}` | Supabase `tarefas` direto |
| `registrar_tarefa` | `{ "titulo": "string", "prioridade": "alta|media|baixa" }` | Supabase `tarefas` INSERT |
| `adicionar_gasto` | `{ "valor": number, "categoria": "string", "descricao": "string" }` | Supabase `financeiro_gastos` INSERT |
| `enviar_relatorio` | `{ "tipo": "diario|semanal", "canal": "whatsapp|dashboard" }` | `/api/openclaw/briefing` (interno) |
| `analisar_nf` | `{ "imagem_url": "string" }` | `/api/analisa-foto` |

**Resposta 200:**
```json
{
  "id":      "uuid",
  "command": "string",
  "status":  "executed | queued | failed",
  "result":  {}
}
```

`result` varia por comando. Exemplos:
- `resumo_do_dia`: `{ "resumo": "texto do briefing" }`
- `registrar_tarefa`: `{ "tarefa_id": "uuid", "titulo": "string" }`
- `adicionar_gasto`: `{ "gasto_id": "uuid", "valor": 50.00 }`
- `status_sistemas`: `{ "status": "ok|degraded", "services": {...} }`

**Erros:**
| Codigo | Condicao |
|--------|----------|
| 400 | `command` ausente |
| 401 | Token invalido |
| 422 | `command` desconhecido |
| 422 | `params` invalidos para o command |
| 500 | Falha na execucao |

**Timeout:** 25s (comandos como `resumo_do_dia` chamam IA).

**Idempotencia:** sim para `adicionar_gasto` e `registrar_tarefa`.
Chave: SHA-256 de `command + JSON.stringify(params)` com TTL de 60s.
Se chave ja existe -> retornar o resultado anterior com `status: "deduplicated"`.

**Logs:** salvar `{ id, command, params_hash, status, duration_ms, created_at }`.
Nunca logar params completos se contiverem dados financeiros.

**Tabela Supabase:** `openclaw_events` (nova).

---

### POST /api/openclaw/briefing

**Proposito:** acionar a geracao e/ou entrega do briefing executivo.
Wrapper sobre o `/api/briefing` existente, adicionando delivery via WhatsApp.

**Payload:**
```json
{
  "tipo":     "diario | semanal (optional, default: diario)",
  "delivery": "dashboard | whatsapp | ambos (optional, default: dashboard)",
  "data":     "YYYY-MM-DD (optional, default: hoje)"
}
```

**Resposta 202 (Accepted — async):**
```json
{
  "job_id":   "uuid",
  "status":   "queued",
  "delivery": "dashboard | whatsapp | ambos"
}
```

**Erros:**
| Codigo | Condicao |
|--------|----------|
| 400 | `tipo` invalido |
| 401 | Token invalido |
| 503 | `/api/briefing` indisponivel |

**Timeout:** 10s para enfileirar. Briefing gerado em background (n8n ou Vercel
background function quando disponivel).

**Logs:** `{ job_id, tipo, delivery, data, created_at }`.

---

### POST /api/openclaw/audio

**Proposito:** receber audio raw do OpenClaw para transcricao e/ou OCR de nota
fiscal. Processamento e assincrono via n8n.

**Payload:**
```json
{
  "audio_url":        "string (required — URL assinada ou base64 data URI)",
  "formato":          "ogg | mp3 | wav | jpg | png (required)",
  "tipo":             "voz | nota_fiscal (required)",
  "duracao_segundos": "number (optional)",
  "session_id":       "string (optional)"
}
```

**Resposta 202:**
```json
{
  "job_id":             "uuid",
  "status":             "queued",
  "tipo":               "voz | nota_fiscal",
  "estimativa_segundos": 30
}
```

**Erros:**
| Codigo | Condicao |
|--------|----------|
| 400 | `audio_url` ou `formato` ausentes |
| 401 | Token invalido |
| 413 | Payload > 10MB |
| 415 | Formato nao suportado |

**Timeout:** 10s para enfileirar. OCR/transcricao e assincrona.

**Logs:** `{ job_id, formato, tipo, duracao_segundos, created_at }`.
Nunca logar a URL completa (pode conter token assinado).

**Tabela Supabase:** `openclaw_jobs` (nova).

---

### POST /api/openclaw/notify

**Proposito:** enviar notificacao ao usuario via WhatsApp e/ou widget do
dashboard. Usado por outros endpoints internamente apos processamento async.

**Payload:**
```json
{
  "canal":     "whatsapp | dashboard | ambos (required)",
  "mensagem":  "string (required)",
  "prioridade": "alta | normal | baixa (optional, default: normal)",
  "metadata":  {
    "origem":     "string (optional)",
    "action_url": "string (optional)"
  }
}
```

**Resposta 200:**
```json
{
  "id":     "uuid",
  "status": "sent | queued",
  "canal":  "string"
}
```

Para `canal: "whatsapp"`: encaminha para n8n webhook que usa `api/lib/openclaw.js`
`sendWhatsApp()`.

Para `canal: "dashboard"`: insere em tabela `notificacoes` (nova) que o widget
de alerts do dashboard policia.

**Erros:**
| Codigo | Condicao |
|--------|----------|
| 400 | `canal` ou `mensagem` ausentes |
| 401 | Token invalido |
| 500 | Falha no envio WhatsApp |

**Timeout:** 10s.

---

### GET /api/openclaw/status

**Proposito:** health check dos servicos integrados. Usado pelo widget de infra
do dashboard e pelo comando `status_sistemas`.

**Auth:** mesmo `X-Webhook-Token` (nao e endpoint publico).

**Resposta 200:**
```json
{
  "status":    "ok | degraded | down",
  "timestamp": "ISO8601",
  "version":   "1.0.0",
  "services": {
    "supabase":    { "status": "ok | error", "latencia_ms": 45 },
    "supervisor":  { "status": "ok | error", "ultimo_log": "ISO8601" },
    "openclaw":    { "status": "ok | error", "ultimo_evento": "ISO8601" },
    "whatsapp":    { "status": "ok | error", "ultimo_envio": "ISO8601" },
    "briefing":    { "status": "ok | error", "ultimo_briefing": "ISO8601" }
  }
}
```

Status geral: `ok` = todos ok. `degraded` = >= 1 servico com erro nao critico.
`down` = Supabase ou Supervisor IA inacessiveis.

**Timeout por servico:** 3s (checks em paralelo com `Promise.allSettled`).
**Timeout total:** 5s.

**Sem idempotencia** (GET e idempotente por natureza HTTP).

---

## 4. Integracoes

### Supervisor IA (`/api/supervisor`)

`POST /api/openclaw/command` com `command: "resumo_do_dia"`:
```
Gateway -> POST /api/supervisor { mensagem: "gere o resumo do dia" }
        -> retorna { resposta: "..." }
        -> Gateway empacota em { command, status: "executed", result: { resumo } }
```

### Briefing Executivo (`/api/briefing`)

`POST /api/openclaw/briefing`:
```
Gateway -> POST /api/briefing (interno, localhost ou base URL Vercel)
        -> recebe dados agregados (tarefas, financeiro, calendario, alertas)
        -> se delivery inclui whatsapp: POST /api/openclaw/notify (interno)
```

### Financeiro/OCR (`/api/analisa-foto`)

`POST /api/openclaw/audio` com `tipo: "nota_fiscal"`:
```
Gateway -> salva job em openclaw_jobs (Supabase)
        -> dispara n8n webhook com job_id + audio_url
        -> n8n faz OCR via /api/analisa-foto
        -> n8n chama POST /api/openclaw/notify com resultado
```

`POST /api/openclaw/command` com `command: "adicionar_gasto"`:
```
Gateway -> valida idempotencia
        -> INSERT em Supabase (tabela a definir em Fase 1: financeiro_gastos ou
           dados_assistente dependendo de auditoria do schema)
        -> retorna { gasto_id, valor }
```

### WhatsApp/Meta WA

`POST /api/openclaw/notify` com `canal: "whatsapp"`:
```
Gateway -> POST n8n webhook (OPENCLAW_N8N_NOTIFY_URL env var)
        -> n8n chama api/lib/openclaw.js sendWhatsApp()
        -> retorna { status: "sent" }
```

Mensagens RECEBIDAS do WhatsApp (OpenClaw -> dashboard):
```
OpenClaw -> POST /api/openclaw/message (novo) OU
            POST /api/webhook (legado, compatibilidade)
```

### Supabase

Tabelas que o Gateway usa:

| Tabela | Uso | Nova? |
|--------|-----|-------|
| `comandos` | Salvar eventos de `/message` (compatibilidade) | Existente |
| `openclaw_events` | Log de todos os comandos/mensagens | Nova |
| `openclaw_jobs` | Jobs async (audio, briefing) | Nova |
| `tarefas` | INSERT de novas tarefas via `registrar_tarefa` | Existente |
| `supervisor_logs` | Leitura para `GET /status` | Existente |
| `morning_briefing` | Leitura do ultimo briefing para `GET /status` | Existente |

### Dashboard Widgets

`GET /api/openclaw/status` alimenta:
- Widget "Status dos Sistemas" (secao Infra)
- Alerta de degradacao no topo do dashboard

`openclaw_events` alimenta (Fase 4):
- Feed de atividade recente (ultimos comandos executados)

---

## 5. Seguranca

### Token

```
Header: X-Webhook-Token: <OPENCLAW_GATEWAY_TOKEN>
```

- `OPENCLAW_GATEWAY_TOKEN` = variavel de ambiente Vercel.
- **Nunca exposto no frontend** (nao aparece em dashboard.html, localStorage,
  ou qualquer response que o browser leia diretamente).
- Rotacionado via Vercel dashboard. Valor atual documentado apenas no `.env.local`.

### Validacao de payload

- Todos os campos `required` validados antes de qualquer operacao.
- `command` validado contra whitelist de comandos conhecidos.
- Tipos validados (ex: `valor` deve ser number > 0 para `adicionar_gasto`).
- Falha de validacao: `422 { "error": "string", "field": "string" }`.

### Rate limit simples

- 60 requisicoes/minuto por IP.
- Implementado via contador em Supabase (tabela `rate_limit_counters`) ou
  Vercel KV se disponivel.
- Excedido: `429 { "error": "Too Many Requests", "retry_after": 60 }`.
- Nao aplicar rate limit ao `GET /status` (health checks).

### Logs sem secrets

Nunca logar:
- Valor completo de `X-Webhook-Token`.
- `audio_url` completa (pode ter token assinado).
- Conteudo de `texto` ou `resposta` acima de 200 chars.
- `refresh_token` do Google/Meta que possa aparecer em params.

Sempre logar:
- `id` de cada evento.
- `command` ou `tipo`.
- `status` da resposta.
- `duration_ms`.
- Erros com stack (sem expor tokens em stack traces).

### Fail-safe

- Se Supabase indisponivel: endpoints retornam `503` mas NAO travam o processo.
- Se Supervisor IA falha: `command: "resumo_do_dia"` retorna `{ status: "failed",
  result: { error: "Supervisor indisponivel" } }` com HTTP 200 (nao e erro do
  Gateway em si).
- Se n8n indisponivel: `/audio` e `/briefing` retornam `202` com
  `status: "queued"` e retentar em Fase 3 (fila persistente).

---

## 6. Fluxos Reais

### "resumo do dia"

```
1. OpenClaw envia:
   POST /api/openclaw/command
   { "command": "resumo_do_dia" }

2. Gateway: valida token + payload.

3. Gateway: INSERT em openclaw_events
   { command: "resumo_do_dia", status: "processing" }

4. Gateway: POST /api/supervisor
   { "mensagem": "gere o resumo executivo do dia para o Dr. Edson" }

5. Supervisor IA agrega: Google Calendar + financeiro + tarefas + alertas.

6. Supervisor retorna: { "resposta": "texto do resumo" }

7. Gateway: UPDATE openclaw_events status="executed"

8. Gateway responde:
   { "id": "uuid", "command": "resumo_do_dia",
     "status": "executed",
     "result": { "resumo": "texto do resumo" } }
```

### "adicionar gasto"

```
1. OpenClaw envia:
   POST /api/openclaw/command
   { "command": "adicionar_gasto",
     "params": { "valor": 50, "categoria": "alimentacao", "descricao": "almoco" },
     "session_id": "abc123" }

2. Gateway: valida token + payload (valor > 0, categoria nao vazia).

3. Gateway: calcula chave idempotencia = SHA-256("adicionar_gasto" + params_json).
   Se chave existe em openclaw_events (< 60s): retorna resultado anterior,
   status "deduplicated".

4. Gateway: INSERT em Supabase tabela financeiro (a confirmar em Fase 1).

5. Gateway: INSERT em openclaw_events.

6. Gateway responde:
   { "id": "uuid", "command": "adicionar_gasto",
     "status": "executed",
     "result": { "gasto_id": "uuid", "valor": 50 } }
```

### "como estao os sistemas?"

```
1. OpenClaw envia:
   POST /api/openclaw/command
   { "command": "status_sistemas" }

2. Gateway: valida token.

3. Gateway: executa internamente GET /api/openclaw/status
   (Promise.allSettled de 5 checks em paralelo, timeout 3s cada).

4. Gateway responde:
   { "id": "uuid", "command": "status_sistemas",
     "status": "executed",
     "result": { "status": "ok", "services": { ... } } }
```

### "enviar relatorio"

```
1. OpenClaw envia:
   POST /api/openclaw/command
   { "command": "enviar_relatorio",
     "params": { "tipo": "diario", "canal": "whatsapp" } }

2. Gateway: chama internamente POST /api/openclaw/briefing
   { "tipo": "diario", "delivery": "whatsapp" }

3. Briefing endpoint: chama /api/briefing, recebe dados.

4. Briefing endpoint: chama POST /api/openclaw/notify
   { "canal": "whatsapp", "mensagem": "<briefing formatado>" }

5. Notify: dispara n8n -> sendWhatsApp().

6. Gateway responde:
   { "command": "enviar_relatorio", "status": "queued",
     "result": { "job_id": "uuid", "delivery": "whatsapp" } }
```

### "registrar tarefa"

```
1. OpenClaw envia:
   POST /api/openclaw/command
   { "command": "registrar_tarefa",
     "params": { "titulo": "Revisar proposta", "prioridade": "alta" } }

2. Gateway: valida (titulo nao vazio, prioridade em enum).

3. Gateway: INSERT em Supabase tarefas
   { titulo: "Revisar proposta", prioridade: "alta",
     concluida: false, origem: "openclaw" }

4. Gateway responde:
   { "command": "registrar_tarefa", "status": "executed",
     "result": { "tarefa_id": "uuid", "titulo": "Revisar proposta" } }
```

### "analisar nota fiscal"

```
1. Usuario envia foto da NF via WhatsApp.

2. OpenClaw envia:
   POST /api/openclaw/audio
   { "audio_url": "https://...", "formato": "jpg", "tipo": "nota_fiscal" }

3. Gateway: valida + INSERT em openclaw_jobs { status: "queued" }.

4. Gateway: dispara webhook n8n com { job_id, audio_url, formato }.

5. Gateway responde: { "job_id": "uuid", "status": "queued" }

6. n8n: chama /api/analisa-foto com a imagem.

7. n8n: recebe { valor, fornecedor, data, categoria } do OCR.

8. n8n: chama POST /api/openclaw/command
   { "command": "adicionar_gasto", "params": { ... } }

9. n8n: chama POST /api/openclaw/notify
   { "canal": "whatsapp",
     "mensagem": "Nota fiscal registrada: R$ 89,90 — Farmacia Sao Joao" }

10. openclaw_jobs: UPDATE status="done".
```

---

## 7. Persistencia

### Tabela: openclaw_events (nova)

```sql
CREATE TABLE openclaw_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,         -- 'message' | 'command' | 'briefing' | 'notify'
  command     TEXT,                  -- nome do command, se aplicavel
  params_hash TEXT,                  -- SHA-256 para idempotencia
  status      TEXT NOT NULL,         -- 'processing' | 'executed' | 'queued' | 'failed' | 'deduplicated'
  session_id  TEXT,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

TTL: 90 dias. Cron de limpeza (cron.js existente) pode rodar mensalmente.

### Tabela: openclaw_jobs (nova)

```sql
CREATE TABLE openclaw_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,         -- 'audio' | 'briefing'
  status      TEXT NOT NULL,         -- 'queued' | 'processing' | 'done' | 'failed'
  payload     JSONB,                 -- { audio_url_hash, formato, tipo } sem a URL real
  result      JSONB,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

TTL: 7 dias para jobs com `status IN ('done', 'failed')`.

### Tabela: comandos (existente)

Continua sendo gravada por `/api/openclaw/message` para compatibilidade com o
widget "OpenClaw Voz" do dashboard (que faz polling nessa tabela).

### Onde salvar comandos

- Eventos de todos os endpoints -> `openclaw_events`.
- Jobs async (audio, briefing) -> `openclaw_jobs`.
- Mensagens/voz -> `comandos` (compatibilidade) + `openclaw_events`.
- Tarefas criadas via `registrar_tarefa` -> `tarefas` (existente).

### TTL resumo

| Tabela | TTL |
|--------|-----|
| `openclaw_events` | 90 dias |
| `openclaw_jobs` | 7 dias (concluidos) |
| `comandos` | Sem TTL (existente, nao alterar) |
| `supervisor_logs` | Sem TTL (gerenciado por supervisor.js) |

---

## 8. Arquitetura

```
OpenClaw (openclaw.n8ndredson.com)
        |
        | POST/GET com X-Webhook-Token
        v
+-------------------------------+
|   Vercel API Routes           |
|   /api/openclaw/*             |
|                               |
|  _gateway.js (shared)         |
|   - validateToken()           |
|   - validatePayload()         |
|   - logEvent()                |
|   - rateLimit()               |
|                               |
|  message.js  ──────────────── | --> Supabase comandos (INSERT)
|  command.js  ──────────────── | --> supervisor.js (POST interno)
|              ──────────────── | --> Supabase tarefas (INSERT)
|              ──────────────── | --> status.js (GET interno)
|  briefing.js ──────────────── | --> /api/briefing (POST interno)
|              ──────────────── | --> notify.js (POST interno)
|  audio.js    ──────────────── | --> n8n webhook (POST externo)
|  notify.js   ──────────────── | --> n8n webhook (POST externo)
|  status.js   ──────────────── | --> Promise.allSettled de 5 checks
+-------------------------------+
        |
        v
Supabase (jaewjscbigfwjiaeavft)
  openclaw_events, openclaw_jobs,
  tarefas, comandos, supervisor_logs
```

### Arquivos a criar (Fase 1-3)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `api/openclaw/_gateway.js` | Auth, rate limit, logging, helpers |
| `api/openclaw/message.js` | POST /api/openclaw/message |
| `api/openclaw/command.js` | POST /api/openclaw/command |
| `api/openclaw/status.js` | GET /api/openclaw/status |
| `api/openclaw/briefing.js` | POST /api/openclaw/briefing |
| `api/openclaw/notify.js` | POST /api/openclaw/notify |
| `api/openclaw/audio.js` | POST /api/openclaw/audio |
| `supabase/migrations/001_openclaw_events.sql` | DDL openclaw_events |
| `supabase/migrations/002_openclaw_jobs.sql` | DDL openclaw_jobs |

Nenhum arquivo existente e modificado nas Fases 1-3.
`vercel.json` pode precisar de entrada de rota se Vercel nao rotear
`api/openclaw/*.js` automaticamente (verificar em Fase 1).
