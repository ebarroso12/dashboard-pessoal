# Mapa: OpenClaw / CRM / Supervisor IA

> Leitura pura — sem alteração de código ou banco.
> Data: 2026-05-11

---

## 1. Fluxo OpenClaw → Dashboard

```
WhatsApp (usuário)
    │
    ▼ HTTP POST com X-Webhook-Token
api/webhook.js  (Vercel)
    │  valida token → insere em /comandos (Supabase)
    │  campos: tipo, texto, resposta, de, status, ts
    ▼
Supabase · tabela `comandos`
    │
    ▼ polling direto (Supabase REST, a cada 4s)
dashboard.html — widget "OpenClaw Voz"
    └─ renderiza novos registros onde id > ocLastId
```

Pontos de entrada alternativos (mesmo token, mesma tabela):
- `POST /api/comandos` — comandos tipo keyword (agenda, tarefas, etc.)
- `POST /api/assistente` — linguagem natural com detecção de intenção
- `POST /api/supervisor` — agente Claude com ferramentas reais

O token `oc_edson_2026_secure` é aceito tanto no header `X-Webhook-Token`
quanto no campo `body.token` (contrato legado OpenClaw).

---

## 2. Fluxo WhatsApp / CRM (server-vps.js)

Este é um stack **separado** do OpenClaw, rodando no VPS via `whatsapp-web.js`:

```
dashboard.html
    │  escreve wa_connections (status=pending)
    ▼
Supabase · wa_connections
    ▲
    │  polling a cada 3s
server-vps.js  (VPS Hostinger — Node.js, whatsapp-web.js)
    │
    ├─ initClient(perfil)  →  WhatsApp Web via Puppeteer
    │      eventos: qr, authenticated, ready, disconnected
    │      → atualiza wa_connections (status, qr_image, phone)
    │
    ├─ syncChats(perfil)   →  60 últimas conversas → upsert wa_chats
    │
    └─ processRequest(req) →  lê wa_requests (status=pending)
           │  busca mensagens do chat → chama Claude API
           └─ grava resultado em wa_analyses
              → deleta registro de wa_requests
```

---

## 3. Papel de `wa_chats`

- **Quem escreve:** `server-vps.js` · `syncChats()` · upsert via `resolution=merge-duplicates`
- **Quando:** logo após WhatsApp entrar em status `ready`
- **Colunas observadas no código:** `perfil`, `chat_id`, `chat_name`, `is_group`,
  `last_message`, `last_message_ts`, `unread_count`, `updated_at`
- **Quem lê:** nenhuma API Vercel referencia esta tabela; o dashboard pode ler
  direto pelo Supabase REST (não confirmado no código rastreado)
- **Risco:** duplicação potencial com `chat_assistente`, que guarda histórico
  do assistente Vercel; são fontes diferentes (WA-web vs. `/api/assistente`)

---

## 4. Papel de `wa_analyses`

- **Quem escreve:** `server-vps.js` · `processRequest()` após análise Claude
- **Colunas:** `chat_name`, `chat_type`, `tipo_analise`, `msgs_count`,
  `resultado`, `perfil`
- **Tipos de análise:** resumo, tarefas, urgentes, datas, completo, pergunta
- **Quem lê:** nenhuma API Vercel; leitura provável direto pelo dashboard via
  Supabase REST (não rastreada no trecho analisado)
- **Modelo usado:** `claude-sonnet-4-6` com system prompt em português

---

## 5. Papel de `wa_connections`

- **Quem escreve:** `server-vps.js` (todos os estados) e dashboard (cria registro
  com `status=pending` para disparar nova conexão)
- **Ciclo de status:** `pending` → `connecting` → `qr` → `authenticated` →
  `connected` → `disconnected`
- **Campo `qr_image`:** base64 PNG gerado pelo servidor, salvo no Supabase,
  lido pelo dashboard para exibir o QR de pareamento
- **Campo `phone`:** preenchido no evento `ready` com `info.wid.user`

---

## 6. Papel de `supervisor_logs`

- **Quem escreve:** `api/supervisor.js` · `tool_registrar_incidente()`
- **Colunas:** `id serial`, `severidade` (info/aviso/erro/corrigido),
  `mensagem`, `componente`, `criado_em`
- **Quem lê:** `tool_listar_logs()` → retorna para o agente Claude →
  exibido no chat do widget Supervisor IA
- **Alerta no código:** `tool_listar_logs` já documenta que a tabela pode não
  existir e dá o DDL mínimo necessário

---

## 7. Papel do Monitor IA

Widget HTML (`id="widget-infra"`) + script `<script id="supervisor-ia">` +
script `<script id="ia-brain-v3">`.

**Duas funcionalidades distintas no mesmo widget:**

| Parte | Função |
|-------|--------|
| `infraScanNow()` | Faz ping HTTP nos serviços públicos; classifica VPS-only como `⚡ CORS/privado`; atualiza cards visuais |
| Supervisor IA (chat) | Chat com `POST /api/supervisor`; agente Claude com 6 ferramentas reais |

`svInit()` chama `GET /api/supervisor` no carregamento e popula a health bar
com status de Supabase, Google token, API e env vars.

Os atalhos de botão (`svAtalho("verifique tudo"`) são os gatilhos mais comuns
para o agente executar varredura completa.

---

## 8. O que já funciona

- Token em header ou body aceito consistentemente em todos os endpoints
- `POST /api/webhook` → `comandos` → polling do dashboard: fluxo completo e
  testado (15/15 testes P0)
- `POST /api/comandos` com keywords: agenda, tarefas, metas, finanças, resumo,
  alertas, ajuda — todos funcionais (lógica isolada)
- `POST /api/assistente` com detecção de intenção em português: cobertura
  razoável de padrões comuns
- `api/lib/openclaw.js` `sendWhatsApp()`: handshake WebSocket documentado
  (connect.challenge → auth → chat.send)
- `server-vps.js`: lógica de reconexão e ciclo de status do WhatsApp parece
  completa e robusta
- Supervisor IA: loop de agente com até 8 iterações, todas as 6 ferramentas
  implementadas

---

## 9. O que parece quebrado ou confuso

### 9a. Dois stacks WhatsApp paralelos sem separação clara
- **OpenClaw** (WebSocket, `api/lib/openclaw.js`): envia mensagens de saída
- **whatsapp-web.js** (`server-vps.js`): gerencia conexões, lê histórico,
  faz análises
- Não está documentado onde as mensagens *recebidas* pelo usuário via WhatsApp
  chegam: pelo webhook do OpenClaw ou por evento `message` do `whatsapp-web.js`
  (nenhum handler `client.on('message', ...)` existe no `server-vps.js`)

### 9b. Divergência de coluna em `tarefas`
- `api/comandos.js` linha 161: `select=texto,done`
- `api/assistente.js` linha 320: `select=id,texto,concluida`
- Uma dessas colunas não existe no banco. Ainda não confirmado qual.

### 9c. `server-vps.js` com anon key hardcoded
- Linha 9: `const SB_KEY = 'eyJ...'` em texto claro no repositório
- Todos os endpoints Vercel usam `process.env.SUPABASE_ANON_KEY`
- Inconsistência de segurança (a anon key não é secreta por natureza, mas o
  padrão é usar env var)

### 9d. `supervisor_logs` pode não existir no banco
- `tool_listar_logs()` trata isso com fallback textual, mas
  `tool_registrar_incidente()` vai silenciar o erro (retorna `{ok:true}` sem
  verificar)

### 9e. `wa_chats` sem leitura rastreável no código Vercel
- Tabela escrita pelo VPS mas nenhuma API Vercel a lê; se o dashboard lê
  direto, é via Supabase REST no HTML — não rastreado no trecho lido

### 9f. `/api/supervisor` chama `/api/comandos` com URL absoluta
- `tool_executar_comando_dashboard()` faz fetch para
  `https://dashboard-pessoal-edson.vercel.app/api/comandos`
- Funciona, mas é um round-trip de rede desnecessário quando ambos são
  funções Vercel no mesmo deploy

---

## 10. Proxima correcao minima recomendada

**Confirmar o nome real da coluna boolean em `tarefas` no Supabase.**

- `api/comandos.js` usa `done`
- `api/assistente.js` usa `concluida`

Ambos os endpoints estao em producao. Se a coluna real for `concluida`,
`handleTarefas()` em `comandos.js` retorna sempre "nenhuma tarefa"
(filtro `!t.done` em campo inexistente = sempre falsy).
Se for `done`, `lerTarefas()` em `assistente.js` falha da mesma forma.

**Acao:** o usuario confirma o nome da coluna → corrigimos o arquivo errado
com uma linha de mudanca, sem tocar o banco.

Isso desbloqueia P1 com confianca sobre o estado real das tarefas.
