# Auditoria Funcional - Fase 1: Analise de Codigo dos Widgets Criticos

> Data: 2026-05-13
> Escopo: analise estatica de codigo - SEM alteracao de codigo, banco, deploy ou novas features
> Widgets auditados: WhatsApp/OpenClaw, Supervisor IA, Agenda Google Calendar

---

## Widget 1: WhatsApp / OpenClaw

### Arquivos lidos

- `api/lib/openclaw.js`
- `api/whatsapp/test.js`
- `api/webhook.js`
- `api/alerts.js`
- `dashboard.html` (grep: linhas 2382-2510, 8537, 9645, 10167, 11230)

### Fonte de dados

| Fluxo | Fonte real |
|---|---|
| Envio outbound | Meta Business API `graph.facebook.com/v19.0/{phoneId}/messages` |
| Recepcao inbound | POST de n8n/OpenClaw para `/api/webhook` -> Supabase tabela `comandos` |
| Leitura historico | GET `/api/webhook` -> Supabase `comandos` (ultimos 20) |
| Alertas WA | `api/alerts.js` usa `sendWhatsApp` de `openclaw.js` |

### Classificacao

**PARCIAL** - outbound confiavel, inbound dependente de n8n ativo, frontend parcialmente legado

### Riscos identificados

1. **Nome enganoso** - `openclaw.js` usa Meta Business API, nao OpenClaw. Comentario no `test.js` diz "via OpenClaw WebSocket" - FALSO. Codigo real usa `graph.facebook.com`.

2. **Token exposto publicamente** - `oc_edson_2026_secure` aparece em texto claro no HTML servido pelo Vercel:
   - Linha 2423: campo `readonly` visivel na UI
   - Linha 2431: bloco `<code>` de exemplo
   - Linhas 8537, 9326, 9645, 10167, 10363, 11230: constantes JS do frontend
   - Mesmo token e usado como fallback no server-side (`webhook.js:17`, `supervisor.js:20`, `assistente.js:18`) quando `WEBHOOK_TOKEN` env nao esta configurado

3. **phoneId com fallback hardcoded** - `openclaw.js:10`: `'656678347527144'` como default. Nao e secret mas deveria vir so de env var.

4. **API version pinada** - `v19.0` na URL do Meta. Valida hoje mas pode deprecar sem aviso.

5. **Frontend com conteudo estatico fake** - widget "OpenClaw Voz" (linhas 2447-2490) exibe 3 blocos de "Teste de conexao OpenClaw - Dashboard conectado com sucesso!" como HTML estatico. Sao exemplos decorativos, nao dados reais. Usuario pode confundir com status live.

### Gaps para validacao runtime

- Confirmar se `WEBHOOK_TOKEN` esta definido no Vercel (se nao estiver, fallback publico esta ativo)
- Confirmar se `WA_BUSINESS_TOKEN` e `WA_BUSINESS_PHONE_ID` estao definidos no Vercel
- Confirmar se `PHONE_BRIEFING` esta definido (sem ele, alerts.js silencia sem erro)
- Confirmar se n8n envia POST para `/api/webhook` com estrutura correta
- Verificar tabela `comandos` no Supabase: existe, tem dados recentes, nao esta vazia

---

## Widget 2: Supervisor IA

### Arquivos lidos

- `api/supervisor.js`
- `dashboard.html` (script `supervisor-ia`, linhas 9322-9430)

### Fonte de dados

| Componente | Fonte real |
|---|---|
| Loop do agente | Anthropic API `api.anthropic.com/v1/messages` (direto, sem SDK) |
| Modelo | `claude-sonnet-4-6` (hardcoded) |
| Saude Google | Supabase `oauth_tokens` + `oauth2.googleapis.com/token` |
| Saude Supabase | Supabase REST direto (tabelas: `oauth_tokens`, `tarefas`, `financas`, `metas`, `transacoes`, `supervisor_logs`) |
| Logs | Supabase `supervisor_logs` |
| Health check API | `dashboard-pessoal-edson.vercel.app/api/comandos` (hardcoded) |

### Classificacao

**CONFIAVEL com ressalvas** - loop do agente bem implementado, mas com pontos criticos de seguranca e fragilidades operacionais

### Riscos identificados

1. **Token exposto** - `SV_TOKEN = 'oc_edson_2026_secure'` hardcoded em JS publico (linha 9326). Mesma exposicao do widget 1.

2. **scrubSecrets agressivo** - `supervisor.js:237`: regex `[A-Za-z0-9]{50,}` substitui QUALQUER string alfanumerica >= 50 chars por `[TOKEN_REDACTED]`. Pode corromper logs legitimos (ex: IDs do Supabase, resumos de eventos do calendario, base64 de imagens em texto).

3. **URL deployment hardcoded** - `supervisor.js:166`: `'https://dashboard-pessoal-edson.vercel.app'` em `tool_executar_comando_dashboard`. Se URL mudar, ferramenta quebra silenciosamente (retorna `ok: false` com erro).

4. **Sem prompt caching** - chamadas diretas para Anthropic API sem `cache_control`. Com MAX_ITER=8 e historico, cada sessao pode custar varios turnos completos.

5. **Tabela supervisor_logs pode nao existir** - `tool_listar_logs` retorna mensagem de aviso se a tabela nao existe, mas `tool_registrar_incidente` vai falhar silenciosamente (tenta inserir, retorna `{ok:true, registrado:true}` sem verificar se o insert teve erro real).

6. **system prompt com terminologia legada** - menciona "OpenClaw/WhatsApp Business (webhooks e comandos)" e "VPS Hostinger + n8n + EasyPanel + Evolution API + Chatwoot" - pode induzir o agente a diagnosticar componentes que nao existem mais na arquitetura atual.

7. **GET do svInit sem autenticacao robusta** - frontend faz GET para `/api/supervisor` com token hardcoded no JS. Se token mudar no server mas nao no JS, svInit vai falhar e mostrar "offline" sem indicacao clara da causa.

### Gaps para validacao runtime

- Confirmar se `ANTHROPIC_API_KEY` esta definida no Vercel
- Confirmar se tabela `supervisor_logs` existe no Supabase com colunas: `id`, `severidade`, `mensagem`, `componente`, `criado_em`
- Confirmar se GET `/api/supervisor` retorna `{ok:true}` com saude atual
- Testar POST `/api/supervisor` com mensagem "verifique tudo" e confirmar resposta coerente
- Verificar se `tool_registrar_incidente` realmente insere na tabela (log de insert OK vs erro silencioso)

---

## Widget 3: Agenda Google Calendar

### Arquivos lidos

- `api/google/calendar.js`
- `api/google/calendar-create.js`
- `api/google/token.js`
- `api/google/refresh.js`
- `api/assistente.js` (funcoes `lerCalendario`, `addCompromisso`)
- `dashboard.html` (`loadCalendar()`, linhas 5217-5285)

### Fonte de dados

| Fluxo | Fonte real |
|---|---|
| Leitura de eventos | Google Calendar API `googleapis.com/calendar/v3/calendars/{id}/events` |
| Refresh de token | `oauth2.googleapis.com/token` via server-side (nao expoe clientSecret) |
| Armazenamento de tokens | Supabase `oauth_tokens` + browser localStorage |
| Criacao de evento | Google Calendar API POST `/calendars/primary/events` |

### Classificacao

**CONFIAVEL para leitura via dashboard**, **PARCIAL para path do assistente**

### Riscos identificados

1. **assistente.js usa access_token direto sem refresh** - `lerCalendario()` (linha 189) e `addCompromisso()` (linha 236) usam `access_token` da tabela `oauth_tokens` do Supabase diretamente. Access tokens do Google expiram em 1 hora. Se o token estiver expirado, a chamada vai falhar com 401. Nao ha refresh automatico nesse path.

2. **newAccessToken nao e salvo no Supabase** - `loadCalendar()` atualiza `googleTokens` em memoria e localStorage quando recebe `newAccessToken` do server, mas NAO persiste no Supabase. Novo dispositivo ou session limpa do browser vai buscar token desatualizado do Supabase.

3. **Duplicacao de logica de refresh** - `api/google/refresh.js` e `api/google/calendar.js` implementam refresh de forma independente. `api/google/calendar-create.js` tambem reimplementa. 3 copias do mesmo fluxo = risco de divergencia futura.

4. **calendar-create.js com offset `-03:00` hardcoded** - linhas 32-33: offset de fuso fixo. Brazil aboliu horario de verao em 2019, entao `-03:00` e correto para Brasilia atualmente. Nao e bug hoje, mas e fragil se a regra mudar.

5. **calendarId como parametro opcional sem validacao** - `calendar.js:20` aceita `calendarId` do body. Se passado incorretamente, retorna 404 do Google sem mensagem clara para o usuario.

6. **Widget-agenda (linha 3291) dependente do loadCalendar** - `renderAgendaWidget()` so e chamada como callback de `loadCalendar()`. Se calendar nao carregar (token expirado, Google fora), widget-agenda fica no estado "Carregando..." para sempre sem mensagem de erro.

### Gaps para validacao runtime

- Confirmar se `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estao definidos no Vercel
- Confirmar se tabela `oauth_tokens` tem linha com `servico='google'` e `refresh_token` valido
- Confirmar se browser tem `dash_google_tokens` no localStorage com `refresh_token`
- Testar POST `/api/google/calendar` com o refresh_token atual e verificar retorno de eventos
- Testar se `assistente.js` rota calendario falha quando access_token expirou (confirmar comportamento de erro)
- Verificar se widget-agenda exibe erro quando loadCalendar falha (nao apenas "Carregando...")

---

## Sumario Consolidado

| Widget | Classificacao | Prioridade de correcao |
|---|---|---|
| WhatsApp / OpenClaw (outbound) | CONFIAVEL | - |
| WhatsApp / OpenClaw (inbound/historico) | PARCIAL | media |
| WhatsApp / OpenClaw (frontend estatico) | LEGADO | baixa |
| Supervisor IA (loop agente) | CONFIAVEL | - |
| Supervisor IA (logs/tabelas) | PARCIAL | media |
| Supervisor IA (seguranca token) | RISCO CRITICO | **alta** |
| Agenda Calendar (loadCalendar) | CONFIAVEL | - |
| Agenda Calendar (assistente path) | PARCIAL | media |
| Agenda Calendar (persistencia token) | PARCIAL | media |

### Risco critico transversal

**Token `oc_edson_2026_secure` esta exposto em texto claro no HTML publico do dashboard.**
- Aparece em 8+ locais no `dashboard.html`
- Mesmo valor e fallback nos 3 endpoints server-side quando env var nao esta configurada
- Qualquer pessoa com acesso ao source da pagina pode enviar comandos autenticados para `/api/webhook`, `/api/supervisor` e `/api/assistente`

Acao necessaria antes de qualquer outra coisa:
1. Definir `WEBHOOK_TOKEN` nas env vars do Vercel com valor novo e aleatorio
2. Remover hardcoded fallback dos server files
3. Passar token no frontend via variavel de ambiente (ou mecanismo de bootstrap)

---

## Proximos passos (Fase 2 - validacao runtime)

1. Verificar env vars no Vercel: `WEBHOOK_TOKEN`, `WA_BUSINESS_TOKEN`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_ANON_KEY`, `PHONE_BRIEFING`
2. Verificar tabelas no Supabase: `comandos`, `oauth_tokens`, `supervisor_logs`, `dashboard_alerts`
3. Executar GET `/api/supervisor` e confirmar saude dos componentes
4. Executar POST `/api/google/calendar` com refresh_token real
5. Executar POST `/api/whatsapp/test` e confirmar envio real no WhatsApp
