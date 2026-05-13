# RLS oauth_tokens — Checkpoint Final
**Data:** 2026-05-13

## SQL aplicado

```sql
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON oauth_tokens FROM anon;
REVOKE ALL ON oauth_tokens FROM authenticated;
```

## Resultado verificado

Anon key testada diretamente via REST API do Supabase:

```
GET /rest/v1/oauth_tokens?select=servico  (com anon key)
→ HTTP 401
→ {"code":"42501","message":"permission denied for table oauth_tokens"}
```

Leitura publica de `oauth_tokens` eliminada.

## Endpoints impactados

Todos os 4 endpoints Google usam `api/_supabase-admin.js` com `SUPABASE_SERVICE_ROLE_KEY`, que bypassa RLS por design do Postgres. Nenhum endpoint quebrou.

| Endpoint | Chave | RLS impacta |
|---|---|---|
| `api/google/calendar.js` | `SERVICE_ROLE_KEY` | Nao |
| `api/google/calendar-create.js` | `SERVICE_ROLE_KEY` | Nao |
| `api/google/gmail.js` | `SERVICE_ROLE_KEY` | Nao |
| `api/google/drive.js` | `SERVICE_ROLE_KEY` | Nao |

## Riscos residuais

- `SUPABASE_ANON_KEY` ainda publica no `dashboard.html` — sem acesso a `oauth_tokens`, mas usada para outras tabelas (comandos, logs). Escopo a revisar.
- Token Google pode expirar sem renovacao automatica — 401 operacional ate reconexao manual.
- `SUPABASE_SERVICE_ROLE_KEY` e o unico vetor critico restante — configurada como env var no Vercel, nao exposta no codigo.

## Proximo foco recomendado

- Observabilidade: logs estruturados por widget com rastreabilidade de falha em producao
- Health checks: reduzir falso positivo/negativo nos status live/demo dos widgets
- Auditar quais tabelas o anon ainda acessa via `dashboard.html` e aplicar RLS onde necessario
