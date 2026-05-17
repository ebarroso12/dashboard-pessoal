# CRM Proxy Seguro — Estado Final

**Data:** 2026-05-17
**Commit final:** 8c1fa77

## O que mudou

O CRM Kanban deixou de chamar o Supabase diretamente do browser.
Toda escrita agora passa pelo endpoint `api/crm.js` server-side com `service_role`.

| Antes | Depois |
|---|---|
| `CRM_SB_KEY` (anon) hardcoded no HTML | Removida — 0 refs no HTML |
| Fetch direto do browser para Supabase CRM | `fetch('/api/crm', ...)` para proxy Vercel |
| RLS como unica barreira | service_role server-side, sem dependencia de RLS |

## Operacoes validadas em producao

| Operacao | Endpoint proxy | Status |
|---|---|---|
| Listar leads + contatos | GET /api/crm | PASS |
| Criar lead manual | POST action=create | PASS |
| Mover coluna (drag-drop) | POST action=move | PASS |
| Editar lead (status/interesse/resumo) | POST action=update | PASS |
| Editar nome do contato | POST action=update (contactId+name) | PASS |

## Commits do ciclo

| Hash | Descricao |
|---|---|
| e54a9d5 | refactor(crm): move crm access to secure backend proxy |
| 645a7e7 | fix(crm): check INSERT response status and return error detail |
| 5cb78b5 | fix(crm): add response checks to move, update, and GET operations |
| 8429bc7 | chore(crm): remove jwt debug endpoint |
| 8c1fa77 | fix(crm): use null for phone on manual contact creation |

## Producao operacional: SIM

## Risco residual

| Risco | Severidade | Acao |
|---|---|---|
| `SB_ANON` (main Supabase) hardcoded no HTML linha ~3993 | MEDIO | Acesso read-only a tabela `comandos` para assistente de voz. Nao tem escrita. Avaliar em proxima fase. |
| RLS do Supabase CRM nao configurada explicitamente | BAIXO | service_role bypassa RLS. Anon key removida do browser. Risco reduzido. |
