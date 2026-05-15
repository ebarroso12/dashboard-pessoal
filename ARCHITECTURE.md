# Arquitetura — Dashboard Pessoal

> Documento técnico do sistema. Atualizado: 2026-05-15.

---

## Visão Geral

```
Browser (dashboard.html)
    │
    ├── Vercel Edge/Serverless (api/)
    │       ├── Google OAuth (calendar, gmail, drive)
    │       ├── Finance Sync (service_role)
    │       ├── Briefing IA (GPT-4.1-mini)
    │       ├── Supervisor IA (GPT-4.1-mini + tools)
    │       ├── Assistente de voz
    │       └── OCR foto (GPT-4.1-mini)
    │
    ├── Supabase (jaewjscbigfwjiaeavft)
    │       ├── oauth_tokens [RLS: service_role only]
    │       ├── dados_assistente [anon r, service_role rw]
    │       ├── tarefas, metas, notas
    │       └── supervisor_logs, morning_briefing, etc.
    │
    ├── OpenAI API (GPT-4.1-mini)
    │       ├── briefing executivo
    │       ├── análise de widgets (IG, FB, GMB, YT, GA)
    │       ├── supervisor IA
    │       └── OCR nota fiscal
    │
    └── APIs Externas (client-side direto)
            ├── Google Graph API (GMB, YT, GA) — token do localStorage
            ├── Meta Graph API (IG, FB) — token do localStorage
            └── WhatsApp Business (via Vercel proxy)
```

---

## Frontend — dashboard.html

Arquivo único (~11.500 linhas). HTML + CSS + JavaScript inline.

**Principais seções:**
- CSS: variáveis de tema, layout sidebar, cards, mobile, temas claro/escuro/fire
- HTML: widgets por seção (Clínica, Marketing, Infra)
- JS: funções por domínio (financeiro, backup, supervisor, briefing, OAuth, etc.)

**LocalStorage (fonte primária para dados locais):**
- `dash_tasks`, `dash_goals`, `dash_contacts`, `dash_notes` — dados pessoais
- `dash_theme`, `dash_layout_v2`, `dash_settings` — configurações
- `fin_YYYY_MM`, `fin_tx_YYYY_MM`, `fin_pagamentos`, `fin_recebimentos` — financeiro
- `dash_meta_token` — token Meta (60 min)
- `dash_google_tokens` — tokens Google (cache, backup do Supabase)
- `dash_backup_YYYY-MM-DD` — snapshots automáticos (7 dias)

**Temas:** `data-theme` no `<html>`. Valores: `classico` (padrão), `claro`, `legendarios`.

---

## Backend — Vercel Serverless (Node.js 23)

Todos os arquivos em `api/`. Exports `default async function handler(req, res)`.

| Endpoint | Descrição | Auth |
|---|---|---|
| `GET /api/token/status` | Verifica Google/Meta conectados | service_role |
| `POST /api/token/save` | Salva OAuth token no Supabase | service_role |
| `POST /api/google/calendar` | Busca eventos do calendário | service_role |
| `POST /api/google/gmail` | Busca emails não lidos | service_role |
| `POST /api/google/drive` | Busca arquivos recentes | service_role |
| `POST /api/google/token` | Troca code PKCE por tokens | público |
| `POST /api/google/refresh` | Renova access token | service_role |
| `POST /api/analisa-foto` | OCR de nota fiscal via GPT | público |
| `POST /api/briefing` | Briefing executivo diário | público |
| `POST /api/finance/sync` | Sync financeiro service_role | service_role |
| `POST /api/supervisor` | Agente IA operacional | WEBHOOK_TOKEN |
| `GET /api/supervisor` | Status da última varredura | WEBHOOK_TOKEN |
| `POST /api/assistente` | Assistente de voz | WEBHOOK_TOKEN |
| `POST /api/dashboard-proxy` | Proxy seguro para supervisor | WEBHOOK_TOKEN |
| `POST /api/webhook` | Recebe comandos OpenClaw | WEBHOOK_TOKEN |
| `GET /api/cron` | Automações agendadas | público |
| `GET /api/config` | Configurações públicas (App IDs) | público |
| `POST /api/finance/sync` | Sync financeiro via service_role | público |

---

## Supabase

**Projeto:** `jaewjscbigfwjiaeavft` (região us-east-1)  
**Helper:** `api/_supabase-admin.js` — `adminFetch()` com service_role key

### Tabelas Principais

| Tabela | Quem escreve | Quem lê | RLS |
|---|---|---|---|
| `oauth_tokens` | `/api/token/save` (service_role) | APIs Google (service_role) | Sim |
| `dados_assistente` | Dashboard (anon), `/api/finance/sync` (service_role) | APIs (anon) | Não |
| `tarefas` | `/api/assistente` (anon) | Dashboard cache | Não |
| `metas` | — | Cron, comandos | Não |
| `notas` | `/api/assistente` (anon) | — | Não |
| `supervisor_logs` | `/api/supervisor` (anon) | Supervisor | Não |

### RLS Aplicado

```sql
-- oauth_tokens: apenas service_role
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
-- Policy: service_role bypass automático
```

---

## OAuth Google

**Flow:** PKCE (authorization_code).  
**Scopes:** calendar, gmail.readonly, drive.readonly, yt-analytics.readonly, analytics.readonly, business.manage  
**Armazenamento:** refresh_token no Supabase (`oauth_tokens`, service_role). access_token renovado automaticamente.  
**Segurança:** Token nunca retornado nas respostas da API. Frontend nunca vê o token real.

## OAuth Meta

**Flow:** Implicit (response_type=token). **Limitação:** token dura 60 min.  
**Scopes:** pages_read_engagement, instagram_basic, instagram_manage_insights, pages_show_list  
**Armazenamento:** `localStorage.dash_meta_token` (client-side apenas).  
**Segurança:** Token não fica no Supabase de forma útil (acesso client-side necessário para Graph API).  
**Instagram Account ID real:** `17841447769632524` (@dredsonbarroso).

---

## OpenAI (GPT-4.1-mini)

**Usado em:** briefing executivo, análise de widgets, supervisor IA, OCR nota fiscal, assistente (long-prompt).  
**Key:** `OPENAI_API_KEY` env var no Vercel (projeto `dashboard-pessoal-edson`).  
**Timeout:** `AbortSignal.timeout(20000-30000)` em todas as chamadas.  
**Sem Anthropic:** migração completa feita em 2026-05-15.

---

## Financeiro / OCR

**Categorias:** compatíveis com `FIN_CATS` do dashboard (12 categorias: moradia, comunicacao, alimentacao, transporte, saude, pessoais, educacao, lazer, financeiros, empresa, dependentes, diversos).  
**Fluxo:** Foto → base64 → `/api/analisa-foto` → GPT vision → JSON → `_addTx()` → localStorage → `/api/finance/sync` → Supabase.  
**Sync:** service_role via `/api/finance/sync` (não anon direto).

---

## Supervisor IA v2

**Modelo:** GPT-4.1-mini com OpenAI function calling (6 tools).  
**Loop:** até 8 iterações (`MAX_ITER`).  
**Tools:** verificar_google_oauth, verificar_supabase, executar_comando_dashboard, verificar_saude_servicos, registrar_incidente, listar_logs.  
**Fluxo:** SCAN → DIAGNÓSTICO → REPARO → VALIDAÇÃO → RELATÓRIO.  
**TTL logs:** DELETE passivo de registros > 30 dias no cron.

---

## Backup / Restore

**Export:** JSON com version, exported_at, data (tarefas, notas, metas, contatos, config, tema, layout, financeiro 6 meses).  
**Import:** validação de formato + confirm() + restore + reload.  
**Auto-backup:** diário, chave `dash_backup_YYYY-MM-DD`, 7 snapshots retidos.

---

## PWA

**manifest.json:** name="Dashboard Dr. Edson", display=standalone, start_url=/dashboard.html, icons 192+512.  
**sw.js:** pass-through fetch handler, skipWaiting, clients.claim.  
**Meta tags:** apple-touch-icon, mobile-web-app-capable, theme-color.  
**Instalável:** Chrome Android → menu → "Adicionar à tela inicial".
