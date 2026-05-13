# Google OAuth Hardening — Checkpoint Final
**Data:** 2026-05-13

## O que foi feito

OAuth Google migrado para server-side em todos os endpoints afetados.

- `api/google/calendar.js` — token lido do Supabase server-side
- `api/google/calendar-create.js` — token lido do Supabase server-side
- `api/google/gmail.js` — token lido do Supabase server-side
- `api/google/drive.js` — token lido do Supabase server-side

Browser nao envia `refresh_token` no body de nenhuma chamada Google.
Browser nao recebe `access_token` nem `newAccessToken` em nenhuma resposta Google.
`dashboard.html` envia `body: {}` para Gmail e Drive.

## Commits

- `5291694` fix(security): keep calendar oauth tokens server-side
- `533cc6f` fix(security): keep calendar create token server-side
- `b6b3259` fix(security): keep gmail and drive oauth tokens server-side

## Testes

- `tests/contract/api-calendar.security.test.js` — 15/15 pass
- `tests/contract/api-gmail.security.test.js` — 8/8 pass
- `tests/contract/api-drive.security.test.js` — 8/8 pass

## Risco residual

- `SUPABASE_ANON_KEY` e publico no frontend — permite leitura da tabela `oauth_tokens` por qualquer pessoa com o projeto aberto. RLS nao configurado nesta fase.
- Token Google pode expirar sem renovacao automatica — causa 401 operacional ate reconexao manual pelo usuario.

## Proximos focos

- Observabilidade: logs estruturados por widget com rastreabilidade de falha
- Health checks: reduzir falso positivo/falso negativo nos status live/demo
- `infra_logs`: auditoria e retencao de logs de erro das funcoes Vercel
