# Mapa de Tabelas Operacionais — CRM / OpenClaw / Supervisor IA

> Leitura pura. Nenhum código alterado.
> Data: 2026-05-11
> Fonte: varredura de todos os arquivos .js, .cjs e dashboard.html

---

## Resumo por tabela

### `wa_chats`

| | |
|---|---|
| **Quem escreve** | `server-vps.js` — `syncChats()` via `sbUpsert` |
| **Quando escreve** | Evento `ready` do cliente whatsapp-web.js (ao conectar) |
| **Campos gravados** | `perfil`, `chat_id`, `chat_name`, `is_group`, `last_message`, `last_message_ts`, `unread_count`, `updated_at` |
| **Quem lê** | **Nenhum arquivo do repo** — zero referências a `/rest/v1/wa_chats` no dashboard.html e em todas as APIs Vercel |
| **Stack** | server-vps.js (VPS) |
| **Criticidade** | Baixa no estado atual |
| **Risco se quebrar** | Invisivel — escrita silencia erros, leitura inexistente no repo |
| **Observacao** | Tabela orfã: dado gravado mas nunca consumido pelo código rastreado. Possível consumidor: n8n ou uma futura tela de CRM não implementada |

---

### `wa_analyses`

| | |
|---|---|
| **Quem escreve** | `server-vps.js` — `processRequest()` via `sbInsert` após análise Claude |
| **Quando escreve** | Ao concluir análise de conversa solicitada via `wa_requests` |
| **Campos gravados** | `chat_name`, `chat_type`, `tipo_analise`, `msgs_count`, `resultado`, `perfil` |
| **Quem lê** | **Nenhum arquivo do repo** — zero referências em dashboard.html e APIs Vercel |
| **Stack** | server-vps.js (VPS) |
| **Criticidade** | Baixa no estado atual |
| **Risco se quebrar** | Invisivel — análise é executada, resultado gravado, mas ninguém lê |
| **Observacao** | Dado gerado (com custo de token Claude) sem consumidor visível. O fluxo `wa_requests → processRequest → wa_analyses` está completo no backend, mas a exibição no dashboard não existe ainda |

---

### `wa_connections`

| | |
|---|---|
| **Quem escreve** | `server-vps.js` — em todos os eventos do cliente WA: `auth_failure`, `qr`, `authenticated`, `ready`, `disconnected`, `initialize().catch` |
| **Quando escreve** | A cada mudança de estado da conexão WhatsApp |
| **Campos gravados** | `status`, `qr_image`, `phone`, `display_name`, `updated_at` |
| **Quem lê** | `server-vps.js` — `mainLoop()` lê `status=eq.pending` para iniciar conexões; startup lê `status=in.(connected,authenticated,connecting)` para reconectar |
| **Escrita pelo dashboard** | Esperada (para criar registro `status=pending`), mas **zero referências diretas** a `/rest/v1/wa_connections` no dashboard.html — mecanismo não rastreado no código atual |
| **Stack** | server-vps.js (VPS) exclusivo |
| **Criticidade** | Alta — é o mecanismo de controle de sessão WhatsApp |
| **Risco se quebrar** | `server-vps.js` não reconecta perfis; QR code não aparece; dashboard perde controle sobre conexões WA |
| **Observacao** | O dashboard provavelmente escrevia via uma API Vercel removida ou direto via Supabase anon key em algum widget não encontrado na varredura |

---

### `wa_requests`

| | |
|---|---|
| **Quem escreve** | **Nenhum arquivo do repo** — zero referências a escrita nesta tabela no dashboard.html e APIs Vercel |
| **Quem lê / atualiza** | `server-vps.js` — `mainLoop()` lê `status=eq.pending`; `processRequest()` faz PATCH para `processing`, DELETE ao concluir, PATCH para `error` ao falhar |
| **Stack** | server-vps.js (VPS) — apenas consumidor |
| **Criticidade** | Média — é a fila de solicitações de análise de conversa |
| **Risco se quebrar** | Análises de conversa nunca são processadas; `server-vps.js` fica ocioso |
| **Observacao** | Fila sem produtor visível no repo. A escrita deveria vir do dashboard (usuário seleciona chat e solicita análise), mas o widget de CRM que faria esse POST não existe ou foi removido |

---

### `supervisor_logs`

| | |
|---|---|
| **Quem escreve** | `api/supervisor.js` — ferramenta `registrar_incidente` (POST via agente Claude) |
| **Quando escreve** | Quando o agente Claude detecta ou resolve um incidente |
| **Campos gravados** | `severidade` (info/aviso/erro/corrigido), `mensagem`, `componente`, `criado_em` |
| **Quem lê** | `api/supervisor.js` — ferramenta `listar_logs` (GET); também inspecionada por `verificar_supabase` |
| **Exposto no frontend** | Sim — via chat do widget Supervisor IA (o agente retorna os logs em linguagem natural) |
| **Stack** | Vercel (`api/supervisor.js`) |
| **Criticidade** | Média — auditoria de incidentes do Supervisor |
| **Risco se quebrar** | Histórico de incidentes perdido; agente Claude não consegue registrar ações; `tool_listar_logs` retorna mensagem de erro com DDL da tabela |
| **Observacao** | O código já documenta que a tabela pode não existir e dá o CREATE TABLE mínimo. É a única tabela neste mapa com produtor e consumidor no mesmo arquivo |

---

### `infra_logs`

| | |
|---|---|
| **Quem escreve** | **Nenhum arquivo do repo** |
| **Quem lê** | `dashboard.html` — `infraLoadLogs()`, aba "Logs" do Monitor IA, via Supabase REST direto |
| **Query usada** | `GET /rest/v1/infra_logs?select=*&order=criado_em.desc&limit=50` |
| **Campos esperados no display** | `criado_em`, `tipo` (info/alerta/fix/update/erro), `servico`, `mensagem` |
| **Stack** | dashboard.html lê; escritor desconhecido (n8n? serviço externo?) |
| **Criticidade** | Baixa — exibição de logs; não bloqueia nenhuma funcao principal |
| **Risco se quebrar** | Aba "Logs" do Monitor IA exibe mensagem vazia; nada mais quebra |
| **Observacao** | Tabela possivelmente preenchida por n8n ou script externo. Se vazia, a aba Logs do Monitor IA mostra "Sem logs." |

---

### `infra_servicos`

| | |
|---|---|
| **Quem escreve** | **Nenhum arquivo do repo** |
| **Quem lê** | `dashboard.html` em dois contextos: (1) `infraScanNow()` — canary check de Supabase via `type='db'`; (2) `iaRepairAll()` — verifica se Supabase responde |
| **Query usada** | `GET /rest/v1/infra_servicos?select=id&limit=1` |
| **Stack** | dashboard.html lê; escritor desconhecido |
| **Criticidade** | Baixa — usada apenas como "tabela canário" para confirmar que o Supabase está acessível |
| **Risco se quebrar** | Se a tabela não existir, o ping de saúde do Supabase no Monitor IA retorna erro e marca Supabase como offline mesmo que esteja ok |
| **Observacao** | O `_infraServices` lista `infra_servicos` como `type:'db'` mas o scan atual usa `type:'db_rest'` apontando para `oauth_tokens`. A referência a `infra_servicos` ficou em código morto após um patch (`ia-brain-v3`). Pode não ser lida de fato |

---

## Mapa de fluxos por stack

### OpenClaw (Vercel + VPS WebSocket)

```
WhatsApp → OpenClaw gateway (VPS) → POST /api/webhook → tabela: comandos
                                   → lib/openclaw.js sendWhatsApp() ← dashboard
```
Tabelas operadas: `comandos` (leitura/escrita via Vercel), nenhuma das 7 acima.

### server-vps.js (VPS Node.js — whatsapp-web.js)

```
dashboard (escrita desconhecida) → wa_connections (status=pending)
    ↓ polling 3s
server-vps.js mainLoop()
    ├─ initClient() → wa_connections (status updates + qr_image)
    ├─ syncChats()  → wa_chats (upsert — sem consumidor)
    └─ processRequest() ← wa_requests (polling — sem produtor no repo)
                        → wa_analyses (insert — sem consumidor)
```

### dashboard.html polling direto no Supabase REST

```
dashboard.html → GET /rest/v1/infra_logs       (aba Logs, Monitor IA)
dashboard.html → GET /rest/v1/infra_servicos   (canary check, possivelmente morto)
dashboard.html → GET /rest/v1/comandos         (widget OpenClaw Voz, a cada 4s)
```

### Vercel API supervisor

```
POST /api/supervisor (frontend) → agente Claude → supervisor_logs (leitura e escrita)
```

---

## Tabelas sem produtor ou sem consumidor no repo

| Tabela | Problema |
|--------|----------|
| `wa_chats` | Escritor existe (server-vps.js), consumidor ausente |
| `wa_analyses` | Escritor existe (server-vps.js), consumidor ausente |
| `wa_requests` | Consumidor existe (server-vps.js), produtor ausente |
| `infra_logs` | Consumidor existe (dashboard.html), produtor ausente |
| `infra_servicos` | Consumidor possivelmente morto, produtor ausente |

---

## Proxima investigacao recomendada

Antes de qualquer P1: confirmar se `server-vps.js` está de fato rodando no VPS
hoje. Se estiver parado, todas as tabelas `wa_*` estão congeladas.

Perguntas abertas:
1. Quem cria registros em `wa_requests`? Widget removido? n8n?
2. Quem escreve em `infra_logs`? n8n? Script externo?
3. `wa_connections` — qual endpoint ou widget do dashboard cria o registro inicial `status=pending`?
