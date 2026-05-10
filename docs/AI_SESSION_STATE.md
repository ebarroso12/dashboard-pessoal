# AI Session State — Dashboard Pessoal

> Atualizado em: 2026-05-10

## Etapa atual
**SP-2.5 — Contract Capture** (testes P0 criados e passando)

## Objetivo da sessão
Reconectar e diagnosticar o dashboard localmente; mapear schema real do Supabase.

---

## Estado do servidor local

| Item | Valor |
|---|---|
| Arquivo de entrada | `server.cjs` (renomeado de `server.js`) |
| Porta | `8080` |
| URL local | `http://localhost:8080` |
| Comando | `node server.cjs` |
| Status | ✅ Rodando |

### Por que server.cjs?
`package.json` tem `"type": "module"` (ESM), mas `server.js` usa sintaxe CommonJS (`require`, `__dirname`).
Renomear para `.cjs` força o Node a tratar o arquivo como CJS sem alterar `package.json` nem a lógica.

---

## Testes de rota local (2026-05-10)

| Rota | Método | HTTP | Resultado |
|---|---|---|---|
| `/` | GET | 200 | `dashboard.html` servido |
| `/login.html` | GET | 200 | `login.html` servido |
| `/api/config` | GET | 200 | JSON com campos vazios (sem config.json) |
| `/api/comandos` | GET | 200 | `[]` (nenhum comando salvo) |
| `/api/supervisor` | GET | 404 | **Não existe no servidor local** — é função Vercel serverless (`api/supervisor.js`) |

---

## Arquitetura: servidor local vs. Vercel

O `server.cjs` serve apenas as rotas hardcoded:
- `GET /oauth/google`, `GET /oauth/tiktok`
- `POST /api/tiktok/token`, `POST /api/google/token`, `POST /api/google/refresh`
- `GET /api/config`
- `GET /api/comandos`
- `POST /api/webhook`
- `POST /api/analisa-foto`
- Fallback: arquivos estáticos do diretório

Os arquivos em `api/*.js` (`supervisor.js`, `ask.js`, `cron.js`, etc.) são **funções serverless Vercel** e não são invocadas pelo servidor local.

---

## Dependência de config.json

`server.cjs` lê `config.json` via `getConfig()` com `try/catch` — retorna `{}` se ausente.
Rotas que precisam de credenciais retornam `HTTP 400` ao ser chamadas, mas não travam o boot.

| Credencial | Onde está | Status local |
|---|---|---|
| `google.clientId/clientSecret` | `config.json` (ausente) | ⚠️ Vazio |
| `GOOGLE_CLIENT_ID/SECRET` | `process.env` | ⚠️ Não definido |
| `META_APP_ID` | `process.env` | ⚠️ Não definido |
| `WA_BUSINESS_TOKEN` | `process.env` | ⚠️ Não definido |

---

## Warnings no terminal

```
[DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized...
Use the WHATWG URL API instead.
```
Não é erro crítico. Não impede funcionamento local.

---

## Arquivos alterados nesta sessão

| Arquivo | Ação |
|---|---|
| `server.cjs` | Criado (cópia de `server.js`) |
| `docs/AI_SESSION_STATE.md` | Criado (este arquivo) |

Nenhum outro arquivo foi alterado, commitado ou publicado.

---

---

## SP-1.5 — Database Discovery (2026-05-10)

### Projeto Supabase
- ID: `jaewjscbigfwjiaeavft`
- URL: `https://jaewjscbigfwjiaeavft.supabase.co`

### Resultado
22 tabelas reais confirmadas por inspeção visual.
Documento completo: `docs/13-schema-real-extraido.md`

### Situação do schema
| Categoria | Qtd |
|---|---|
| Coincidentes com Plano B | 10 |
| Ausentes (a criar em SP-1) | 11 |
| Legadas confirmadas (a remover) | 4 |
| Não documentadas (investigar) | 7 |

### Tabelas críticas (não tocar)
`oauth_tokens`, `lancamentos_financeiros`, `comandos`, `chat_assistente`, `gmb_reviews`

### Tabelas legadas identificadas
`dados_assistente`, `financas`, `transacoes`, `fin_categorias`

### Tabelas a investigar antes de qualquer ação
`fin_orcamento`, `infra_logs`, `infra_servicos`, `wa_chats`, `wa_analyses`, `wa_connections`, `wa_requests`, `widget_scripts`

---

## SP-1.5 — Inspeção de Colunas (2026-05-10)

Documento completo: `docs/15-colunas-observadas-v1.md`
Fonte: inspeção de código (`api/*.js`) — MCP Supabase sem permissão de management.

### Divergências críticas confirmadas

| Tabela | Problema | Risco |
|---|---|---|
| `tarefas` | `comandos.js` usa `done`/`created_at`; demais usam `concluida`/`criado_em` | ALTO |
| `metas` | `comandos.js` usa `meta`/`atual`/`created_at`; demais usam `valor_meta`/`valor_atual`/`criado_em` | ALTO |
| `dados_assistente` | `cron.js` lê campos planos; `assistente.js` lê jsonb nested — estruturas incompatíveis | ALTO |
| `oauth_tokens` | Tokens OAuth acessíveis via anon key — RLS não verificado | CRÍTICO |
| `financas` | Saldo pode estar desatualizado; nenhum arquivo escreve nela | MÉDIO |
| `wa_chats` | Zero referências no código — origem desconhecida | MÉDIO |

### Tabelas ainda não inspecionadas (colunas)
`chat_assistente`, `fin_categorias`, `fin_orcamento`, `gmb_reviews`, `infra_logs`,
`infra_servicos`, `morning_briefing`, `notas`, `supervisor_logs`, `transacoes`,
`wa_analyses`, `wa_connections`, `wa_requests`, `widget_scripts`

---

## Arquivos criados nesta sessão

| Arquivo | Ação |
|---|---|
| `server.cjs` | Criado (cópia de `server.js`) |
| `docs/AI_SESSION_STATE.md` | Criado e atualizado (este arquivo) |
| `docs/10-inventario-tecnico-atual.md` | Criado — diagnóstico ESM/CJS local |
| `docs/13-schema-real-extraido.md` | Criado — schema real Supabase |
| `docs/15-colunas-observadas-v1.md` | Criado — colunas das 8 tabelas críticas |
| `docs/17-comportamento-real-api-comandos.md` | Criado — contrato comportamental de `/api/comandos` |
| `tests/contract/api-comandos.p0.test.js` | Criado — 15 testes P0, todos passando |

**Nenhum arquivo de código foi alterado. Nenhum commit. Nenhum deploy.**

---

## Próximos passos (aguardando decisão)

### Status atual — SP-1.5
- [x] `docs/15-colunas-observadas-v1.md` criado — 8 tabelas críticas inspecionadas via código
- [x] Divergências críticas encontradas — `tarefas`, `metas`, `dados_assistente` com nomes de colunas inconsistentes entre `comandos.js` (legado) e demais arquivos
- [x] `oauth_tokens` é risco crítico até validar RLS — tokens OAuth (`access_token`, `refresh_token` do Google) acessíveis via `SUPABASE_ANON_KEY` exposta no código; sem confirmação de RLS ativado no painel Supabase
- [x] `wa_chats` sem origem confirmada — zero referências no código do repo; provável escrita por serviço externo (n8n / OpenClaw / Evolution API); não remover sem investigar

### Status atual — SP-2.5
- [x] `docs/17-comportamento-real-api-comandos.md` criado — contrato completo de `/api/comandos`
- [x] Confirmado: `comandos.js` usa nomes legados (`done`, `atual`, `meta`, `created_at`) divergentes dos demais arquivos — comportamento atual pode estar silenciosamente retornando dados errados
- [x] Confirmado: `handleFinancas()` lê tabelas legadas `financas` + `transacoes`, não `lancamentos_financeiros`
- [x] Confirmado: `handleAlertas()` faz HTTP fetch para produção Vercel — não funciona em dev sem internet
- [x] Contrato com OpenClaw mapeado: sempre HTTP 200, body `{ resposta, ok: true }`, aceita `body.texto`

### Status atual — SP-2.5 testes P0
- [x] `node:test` confirmado funcional (Node v24.15.0)
- [x] `tests/contract/api-comandos.p0.test.js` criado — 15 testes, **15/15 passando**
- [x] Cobertura P0: healthcheck GET, CORS, OPTIONS/PUT routing, auth (sem token, token inválido header/body, token no body), comando desconhecido, formato legado `body.comando`, `ajuda`/`help` sem deps externas, shape da response, normalização de input
- [x] Zero dependências externas — apenas `node:test` + `node:assert`
- [x] Comando: `node --test tests/contract/api-comandos.p0.test.js`

### Workspace canônico
- **Confirmado:** `/c/Users/Cliente/dashboard-pessoal` é o workspace canônico
- Codex operou em contexto separado — conteúdo dos docs 17/18/19 não foi transferido
- Placeholders criados para sincronização futura

### Docs pendentes de sincronização (TEMP_PLACEHOLDER)
| Arquivo | Status |
|---|---|
| `docs/17-contrato-api-comandos.md` | ⏳ Placeholder — aguarda conteúdo do Codex |
| `docs/18-fixtures-futuras-api-comandos.md` | ⏳ Placeholder — aguarda conteúdo do Codex |
| `docs/19-plano-testes-contrato-api-comandos.md` | ⏳ Placeholder — aguarda conteúdo do Codex |

**Nota:** existe também `docs/17-comportamento-real-api-comandos.md` criado nesta sessão — contrato comportamental completo de `/api/comandos`.

### Testes P0
- `tests/contract/api-comandos.p0.test.js` — **15/15 passando**
- Comando: `node --test tests/contract/api-comandos.p0.test.js`
- `api/comandos.js` **não alterado**

### Próxima ação segura
- [ ] Colar conteúdo real dos docs 17/18/19 do Codex para substituir os placeholders
- [ ] **Confirmar nomes reais das colunas** de `tarefas` e `metas` no painel Supabase antes de qualquer alteração de código
- [ ] Criar testes P1 apenas após sincronização dos docs e confirmação de schema
