# AI Session State — Dashboard Pessoal

> Atualizado em: 2026-05-11

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

---

---

## Sessão 2026-05-11 — Mapeamento OpenClaw / CRM / Supervisor IA

Documento produzido: `docs/20-mapa-openclaw-crm-supervisor.md`

### Fluxo principal confirmado

```
WhatsApp → OpenClaw (WebSocket VPS) → POST /api/webhook → tabela comandos → dashboard polling a cada 4s
```

Token aceito em `X-Webhook-Token` (header) ou `body.token` (legado OpenClaw).
Testes P0 cobrem este contrato. 15/15 passando.

### Dois stacks WhatsApp paralelos

| Stack | Onde roda | Funcao principal |
|-------|-----------|------------------|
| OpenClaw (`api/lib/openclaw.js`) | VPS via EasyPanel | Envia mensagens de saida via WebSocket |
| `server-vps.js` (whatsapp-web.js) | VPS Hostinger | Gerencia conexoes WA, sincroniza chats, executa analises Claude |

Os dois coexistem sem documentacao sobre qual recebe mensagens do usuario.

### server-vps.js nao processa mensagens recebidas

`server-vps.js` nao tem nenhum `client.on('message', ...)`.
Seu papel real hoje: gerenciar conexao (QR, auth), sincronizar lista de chats
em `wa_chats`, e executar analises sob demanda via fila `wa_requests`.
Ele **nao** age como chatbot de entrada.

### Tarefas e metas estao vazias no Supabase

Confirmado pelo usuario: as tabelas `tarefas` e `metas` existem mas estao
vazias. A divergencia de colunas (`done` vs. `concluida`, etc.) documentada
anteriormente nao impacta o fluxo operacional ativo. **Nao deve guiar a
proxima correcao.**

### Diagnostico server-vps.js (2026-05-11)

Documento completo: `docs/22-diagnostico-server-vps-openclaw.md`

**Conclusao: server-vps.js nao tem rastreabilidade de deploy neste repo.**

- Nenhum script de inicializacao o menciona (`iniciar.bat`, `iniciar.sh`, `publicar.bat`, `retomar.sh` — todos omitem)
- 4 dependencias ausentes no `package.json`: `dotenv`, `whatsapp-web.js`, `qrcode`, `@anthropic-ai/sdk`
- `package.json` tem `"type": "module"` (ESM); `server-vps.js` usa `require()` (CJS) — falha imediatamente se executado aqui
- `.wwebjs_auth/` (pasta de sessao WA) nao existe — nunca rodou nesta maquina
- Sem PM2/systemd/Docker config no repo
- O arquivo provavelmente existe no VPS de forma independente, com seu proprio `package.json`

**Verificacao manual necessaria (usuario):**
- SSH no VPS: `pm2 list` ou `ps aux | grep server-vps`
- OU inspecionar `wa_connections.updated_at` no Supabase — se antigo e status travado, processo esta parado
- OU verificar container no EasyPanel do Hostinger

**Fluxo OpenClaw nao e afetado** — `/api/webhook` → `comandos` roda 100% no Vercel.

### Resultado da investigacao de tabelas (2026-05-11)

Documento completo: `docs/21-mapa-tabelas-operacionais.md`

| Tabela | Escritor | Leitor | Situacao |
|--------|---------|--------|----------|
| `wa_chats` | server-vps.js | nenhum no repo | orfa — gravado, sem consumidor |
| `wa_analyses` | server-vps.js | nenhum no repo | orfa — gravado, sem consumidor |
| `wa_connections` | server-vps.js | server-vps.js | produtor-dashboard nao rastreado |
| `wa_requests` | nenhum no repo | server-vps.js | fila sem produtor rastreado |
| `supervisor_logs` | api/supervisor.js | api/supervisor.js | operacional (pode nao existir no banco) |
| `infra_logs` | nenhum no repo | dashboard.html | escritor desconhecido (n8n?) |
| `infra_servicos` | nenhum no repo | dashboard.html (possivelmente morto) | canary de Supabase; patch substituiu por outra tabela |

---

## Encerramento de sessão — 2026-05-10

### Commits registrados
```
23fddd5 chore(gitignore): ignora arquivos .env locais
3ee72fb checkpoint(sp-2.5): estabiliza discovery, contratos e testes P0
```

### Status no encerramento
- Testes P0: **15/15 passando**
- Working tree: **limpo**
- Migrations: **nenhuma**
- `api/comandos.js`: **não alterado**
- Banco Supabase: **não alterado**
- Deploy: **não realizado**

### OpenClaw vs server-vps.js (2026-05-11)

Documento completo: `docs/23-openclaw-vs-server-vps.md`

**Veredicto: server-vps.js nao e necessario para o fluxo operacional atual.**

- Fluxo de comandos WhatsApp roda 100% via OpenClaw + Vercel
- Nenhum widget ativo do dashboard consome `wa_chats`, `wa_analyses` ou `wa_requests`
- `server-vps.js` implementa CRM de conversas que **nao foi integrado ao frontend**
- Congelar o VPS nao quebra nenhuma funcionalidade visivel hoje

| O que funciona SEM VPS | O que para SEM VPS |
|------------------------|-------------------|
| Todos os comandos WA (audio/texto) | Ciclo QR/auth de novas conexoes WA |
| /api/comandos, /api/assistente, /api/supervisor | wa_chats, wa_analyses (sem consumidor) |
| Dashboard, Monitor IA, Google, Financas | wa_requests (sem produtor) |

### Decisao registrada — 2026-05-11

**OpenClaw/Vercel e o fluxo oficial atual.**

- `server-vps.js` esta parado/desconectado — nao ressuscitar agora
- CRM (`wa_*`) vai para backlog tecnico sem data
- Foco exclusivo no fluxo OpenClaw/Vercel

### Contrato webhook OpenClaw mapeado (2026-05-11)

Documento completo: `docs/24-contrato-real-openclaw-webhook.md`

**Descoberta critica:** `/api/webhook` e um endpoint de LOG, nao de processamento.
O OpenClaw ja chega com `resposta` pronta — o webhook apenas persiste o par
`(texto, resposta)` na tabela `comandos`. Nao ha roteamento dinamico.

**Dois canais de saida WhatsApp identificados:**
- `api/lib/openclaw.js` `sendWhatsApp()` — usado por `api/alerts.js` (alertas criticos/warn)
- Meta WhatsApp Business API (`graph.facebook.com`) — usado por `api/cron.js` (morning, weekly, reviews)

**Body em producao (formato documentado no dashboard):**
```json
{ "tipo": "voz", "texto": "...", "resposta": "...", "de": "WhatsApp", "token": "oc_edson_2026_secure" }
```
Aliases legados aceitos: `text`, `from`, `response`, `audio` (nao salvo).

### Mapa de comandos WhatsApp (2026-05-11)

Documento completo: `docs/26-mapa-comandos-whatsapp.md`

| Comando | Risco atual | Estado |
|---------|-------------|--------|
| `ajuda` | Zero | Pronto para Segundo Eu |
| `agenda` | Medio — cadeia OAuth | Funcional se token valido |
| `resumo` | Critico — combina 3 handlers | Herda riscos de tarefas + metas + financas |
| `tarefas` | Alto — coluna `done` provavelmente errada | Retorna todas pendentes silenciosamente |
| `metas` | Alto — colunas `atual`/`meta` provavelmente erradas | Exibe 0% em tudo silenciosamente |
| `financas` | Alto — le tabelas legadas | `lancamentos_financeiros` ignorado |
| `alertas` | Medio — chama producao | Nao testavel localmente |
| `emails`, `drive` | Baixo | Pouco usados; falha graciosamente |

**10 aliases identificados como legado** (ingleses/arcaicos): `calendar`, `inbox`, `tasks`,
`todo`, `goals`, `resume`, `docs`, `ver alertas`, `listar alertas`, `dinheiro`.

### Testes P1 criados (2026-05-11)

Arquivo: `tests/contract/api-comandos.p1.test.js`

| Suite | Testes | Resultado |
|-------|--------|-----------|
| P1: ajuda | 6 | 6/6 passando |
| P1: agenda sem token | 6 | 6/6 passando |
| P1: resumo mocks minimos | 10 | 10/10 passando |
| **Total P1** | **22** | **22/22** |
| P0 (regressao) | 15 | 15/15 — sem regressao |

Tecnicas usadas:
- `global.fetch` mockado via `installMock()` / `removeMock()`
- `before`/`after` escopados por suite (`describe`)
- Default mock retorna `[]` simulando tabelas Supabase vazias
- Nenhuma chamada de rede real

### Auditoria de producao (2026-05-11)

Documento: `docs/28-auditoria-producao-minima.md`

**Estado real em producao:**

| Componente | Estado |
|------------|--------|
| Vercel / rotas | Todas 200 — operacional |
| Google OAuth token | Presente e valido |
| Todas env vars | Configuradas |
| Morning briefing (cron) | **PARADO** — ultimo envio: 2026-05-03 (8 dias) |
| OpenClaw → comandos | **INATIVO** — 2 registros de teste, nenhum real apos abr/19 |
| `dashboard_alerts` | **NAO EXISTE** no banco |
| Supabase health (supervisor) | Falso negativo permanente (query errada) |
| Instagram/Facebook widgets | Dados hardcoded — token Meta ignorado |
| Tarefas, metas, notas, lancamentos | Todas vazias |

**3 reparos prioritarios:**
1. **Urgente** — descobrir por que morning briefing parou em mai/03 (WA_BUSINESS_TOKEN expirado?)
2. **Medio** — criar tabela `dashboard_alerts` (sistema de alertas implementado mas bloqueado)
3. **Medio** — corrigir health check Supabase no supervisor (`select=id` → `select=servico`, 1 linha)

**Risco de seguranca — INCIDENTE ATIVO:** token Meta em plaintext em `supervisor_logs` id:20.
Documento completo: `docs/31-incidente-token-meta-supervisor-logs.md`

Agravante descoberto: `GET /api/supervisor` nao requer autenticacao (handler GET roda
antes do bloco de auth). O token e retornado publicamente sem token algum.

Ordem de correcao (aguardando confirmacao do usuario):
1. Revogar token Meta no painel Meta for Developers
2. DELETE supervisor_logs WHERE id=20 (SQL Supabase)
3. Gerar novo token Meta + salvar em oauth_tokens
4. Alterar GET /api/supervisor para exigir auth (Claude Code)
5. Adicionar scrubbing em tool_registrar_incidente (Claude Code)
6. Habilitar RLS em supervisor_logs (Supabase)
7. Deploy

### Inventario de chamadas IA (2026-05-11)

Documento: `docs/30-inventario-chamadas-ia.md`

| Arquivo | Modelo | Chamadas por acionamento | Risco custo |
|---------|--------|--------------------------|-------------|
| `api/supervisor.js` | `claude-sonnet-4-6` | Ate 8 (loop agente) | ALTO |
| `api/analisa-foto.js` | `claude-haiku-4-5-20251001` | 1 (visao, sem loop) | BAIXO |
| `server-vps.js` | `claude-sonnet-4-6` | 1 (parado) | ZERO |
| `api/assistente.js` | NENHUM | Regex puro | ZERO |
| `api/comandos.js` | NENHUM | Keyword matching | ZERO |

**Bug critico:** botao "Claude Analisa" no dashboard chama `/api/assistente` (sem IA).
Usuario ve "Consultando Claude..." mas nenhum Claude e acionado — retorna "nao entendi".

---

## Comando de retomada

```
Reconectar ao dashboard-pessoal.

Leia primeiro:
- docs/AI_SESSION_STATE.md
- docs/13-schema-real-extraido.md
- docs/15-colunas-observadas-v1.md
- docs/17-comportamento-real-api-comandos.md
- tests/contract/api-comandos.p0.test.js

Estado atual esperado:
- commits 3ee72fb e 23fddd5 existem
- testes P0 passam 15/15
- não avançar para P1 antes de validar colunas reais de tarefas e metas no Supabase

Continue exatamente da próxima ação recomendada.
Não altere código, banco, deploy ou secrets sem confirmação.
```
