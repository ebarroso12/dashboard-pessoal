# Estado Operacional Final — 2026-05-17

## Producao: OPERACIONAL

### Endpoints validados

| Endpoint | Status |
|---|---|
| GET /api/token/status | PASS — google:connected, meta:connected |
| GET /api/vidavirtual/summary | PASS — os_abertas:1, pagamentos_pendentes:1 |
| POST /api/alerts/sync | PASS — synced:1, notified:1 |
| POST /api/briefing | PASS — fontes: supervisor_logs, google_calendar, vidavirtual |
| POST /api/openclaw/briefing/send | PASS (envio confirmado anteriormente; erro #131037 intermitente — lado Meta) |
| HEAD /api/token/status | PASS — 200 (fix e207f55) |

### Fixes aplicados nesta sessao

| Commit | Fix |
|---|---|
| e207f55 | fix(status): HEAD /api/token/status retornava 405, badge Supabase falso negativo |
| 9ca2d9e | fix(crm): criacao de novo lead e edicao de nome do contato nao funcionavam |

### Infraestrutura validada

- `dashboard_alerts` criada no Supabase `jaewjscbigfwjiaeavft` — upsert funcional
- `VIDAVIRTUAL_SUPABASE_URL` e `VIDAVIRTUAL_SERVICE_ROLE_KEY` configuradas no Vercel
- Todas as env vars confirmadas: OPENAI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, WEBHOOK_TOKEN, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, WA_BUSINESS_TOKEN, WA_BUSINESS_PHONE_ID

### Risco restante

| Risco | Tipo | Acao |
|---|---|---|
| Meta #131037 — display name approval | Plataforma Meta, nao codigo | Aprovar display name no Meta Business Manager para WA_BUSINESS_PHONE_ID |
| Anon key CRM exposta no HTML | Seguranca | RLS nao configurada em zlrydmfwsobheajaeael — priorizar em proxima sessao |
