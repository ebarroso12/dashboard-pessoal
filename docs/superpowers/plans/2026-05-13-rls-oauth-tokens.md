# RLS oauth_tokens — Implementation Plan

> **Execução manual:** Este plano é executado pelo humano no Supabase SQL Editor, não por agente. Cada bloco SQL é copiado e rodado individualmente. Verificar cada etapa antes de prosseguir.

**Goal:** Ativar Row Level Security em `oauth_tokens` para bloquear acesso anon, sem quebrar nenhum endpoint backend que já usa service_role.

**Architecture:** RLS habilitado sem policies explícitas. Em PostgreSQL/Supabase, `ENABLE ROW LEVEL SECURITY` sem policies permissivas bloqueia `anon` e `authenticated` por padrão. `service_role` tem `BYPASSRLS` e continua com acesso total. Defense-in-depth opcional: revogar grants públicos.

**Estado pré-RLS verificado:**
- commit `a545098` — 113/113 testes verdes
- backend: service_role via `adminFetch`
- frontend writes: `/api/token/save` → service_role
- frontend reads: `/api/token/status` → service_role
- infra scan: `/api/token/status`
- zero acesso direto anon a `oauth_tokens` no código

---

## Checklist pré-execução

Verificar no Supabase antes de qualquer SQL:

- [ ] Confirmar que `api/_supabase-admin.js` está em produção (deploy do commit `397ad11` ou posterior)
- [ ] Confirmar que `api/token/save.js` está em produção (commit `19a41bf`)
- [ ] Confirmar que `api/token/status.js` está em produção (commit `a545098`)
- [ ] Testar `/api/token/status` retorna `{ google: { connected: bool }, meta: { connected: bool } }` sem erro
- [ ] Testar `/api/google/calendar` (POST) retorna eventos ou 401 "token not found" (nunca 403 de permissão)
- [ ] Registrar estado atual da tabela (query de diagnóstico abaixo)

---

## Task 1: Diagnóstico pré-RLS

Rodar no **Supabase SQL Editor** para registrar estado atual.

- [ ] **Step 1.1 — Verificar se RLS já está ativo**

```sql
SELECT
  relname            AS tabela,
  relrowsecurity     AS rls_ativo,
  relforcerowsecurity AS rls_forcado
FROM pg_class
WHERE relname = 'oauth_tokens';
```

Esperado: `rls_ativo = false`

- [ ] **Step 1.2 — Verificar policies existentes**

```sql
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'oauth_tokens';
```

Esperado: zero rows (sem policies)

- [ ] **Step 1.3 — Verificar grants na tabela**

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'oauth_tokens'
ORDER BY grantee, privilege_type;
```

Registrar o output para comparação pós-RLS.

- [ ] **Step 1.4 — Contar rows existentes (confirmação de dados)**

```sql
SELECT COUNT(*) FROM oauth_tokens;
```

Registrar. Deve ser >= 1 (ao menos token Google).

---

## Task 2: Aplicar RLS

Rodar no **Supabase SQL Editor**. Cada statement separado.

- [ ] **Step 2.1 — Habilitar RLS**

```sql
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
```

Esperado: `ALTER TABLE` sem erro.

- [ ] **Step 2.2 — Verificar ativação imediata**

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'oauth_tokens';
```

Esperado: `relrowsecurity = true`

- [ ] **Step 2.3 — Revogar grants de anon (defense-in-depth)**

```sql
REVOKE ALL ON oauth_tokens FROM anon;
REVOKE ALL ON oauth_tokens FROM authenticated;
```

Esperado: `REVOKE` sem erro. `service_role` não é afetado (tem BYPASSRLS).

---

## Task 3: Verificar bloqueio anon

Testar via REST API Supabase com anon key. Usar `curl` ou browser DevTools.

- [ ] **Step 3.1 — SELECT direto com anon key deve retornar array vazio**

```bash
curl -s \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  "https://jaewjscbigfwjiaeavft.supabase.co/rest/v1/oauth_tokens?select=*"
```

Esperado: `[]` (array vazio — RLS retorna zero rows para anon)

**NÃO esperado:** dados de token visíveis, `access_token`, `refresh_token`

- [ ] **Step 3.2 — INSERT com anon key deve falhar**

```bash
curl -s -X POST \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"servico":"test","access_token":"hacker"}' \
  "https://jaewjscbigfwjiaeavft.supabase.co/rest/v1/oauth_tokens"
```

Esperado: erro 403 ou `{ "code": "42501", "message": "..." }` (permission denied)

- [ ] **Step 3.3 — Confirmar no SQL Editor que dados permanecem intactos**

```sql
SELECT COUNT(*) FROM oauth_tokens;
```

Esperado: mesmo count do Step 1.4 (RLS não apaga dados)

---

## Task 4: Verificar endpoints backend (service_role bypass)

Todos usam service_role → devem continuar funcionando normalmente.

- [ ] **Step 4.1 — `/api/token/status` deve retornar connected=true**

```bash
curl -s "https://dashboard-pessoal-edson.vercel.app/api/token/status"
```

Esperado:
```json
{ "google": { "connected": true }, "meta": { "connected": true } }
```

Se connected=false para google, verificar se token existe no banco (Step 1.4).

- [ ] **Step 4.2 — `/api/google/calendar` deve funcionar ou retornar 401 operacional**

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  "https://dashboard-pessoal-edson.vercel.app/api/google/calendar"
```

Esperado: `{ "success": true, "events": [...] }` (200)
OU: `{ "error": "Google token not found..." }` (401 — token expirado/ausente, não erro de permissão)

**NÃO esperado:** erro 403, 500 com mensagem de SUPABASE_SERVICE_ROLE_KEY, stack trace

- [ ] **Step 4.3 — Verificar `/api/google/gmail`**

```bash
curl -s -X POST \
  "https://dashboard-pessoal-edson.vercel.app/api/google/gmail"
```

Esperado: mesmo padrão do Step 4.2

- [ ] **Step 4.4 — Verificar `/api/google/drive`**

```bash
curl -s -X POST \
  "https://dashboard-pessoal-edson.vercel.app/api/google/drive"
```

Esperado: mesmo padrão

- [ ] **Step 4.5 — Verificar `/api/token/save` ainda persiste token**

Simular save de token (safe — não expõe token real, somente testa o endpoint):

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"servico":"google","refresh_token":"rt_test_rls","access_token":"at_test_rls"}' \
  "https://dashboard-pessoal-edson.vercel.app/api/token/save"
```

Esperado: `{ "ok": true }` — endpoint salva via service_role, não afetado por RLS

Limpar depois (no SQL Editor):

```sql
DELETE FROM oauth_tokens WHERE refresh_token = 'rt_test_rls';
```

---

## SQL de Rollback

Executar no SQL Editor **apenas se algo quebrar** após ativar RLS.

```sql
-- Rollback completo: desativa RLS e restaura grants
ALTER TABLE oauth_tokens DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_tokens TO authenticated;
```

**Quando usar rollback:**
- `/api/token/status` retorna 500 ou `connected: false` quando deveria ser `true`
- `/api/google/calendar` retorna 403 ou erro de SERVICE_ROLE_KEY
- `/api/token/save` retorna 403 em vez de `{ ok: true }`

**Não usar rollback se:**
- anon REST retorna `[]` (comportamento correto do RLS)
- Dashboard mostra "desconectado" após limpar localStorage (degradação esperada)
- Widgets de Google não carregam sem reconexão (degradação esperada)

---

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| `service_role` em produção usa chave errada ou ausente | Baixa | Verificar Step 4.1 antes de aplicar RLS |
| Deploy incompleto — endpoints antigos ainda em produção | Baixa | Verificar commits no Vercel dashboard antes |
| Token Google expirado ao testar Step 4.2 | Média | 401 é erro operacional esperado, não RLS |
| `authenticated` role usada em algum fluxo não mapeado | Baixa | Buscar `supabase.auth.getUser` + `oauth_tokens` no código antes |
| Cron jobs Vercel chamam endpoints durante o teste | Baixa | Aceitar — endpoints já usam service_role |

---

## Checklist pós-execução

- [ ] `pg_class.relrowsecurity = true` para `oauth_tokens`
- [ ] `curl` com anon key retorna `[]` para SELECT
- [ ] `curl` com anon key retorna 403 para INSERT
- [ ] `/api/token/status` retorna `connected: true` (service_role bypass ativo)
- [ ] `/api/google/calendar` retorna 200 ou 401 operacional (nunca 403)
- [ ] `/api/token/save` retorna `{ ok: true }`
- [ ] COUNT de rows no banco permanece igual ao pré-RLS
- [ ] Nenhum log de erro de SERVICE_ROLE_KEY no Vercel
