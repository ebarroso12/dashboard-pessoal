# Comportamento Real — `/api/comandos`

> Criado em: 2026-05-10
> Etapa: SP-2.5 — Contract Capture
> Fonte: inspeção de `api/comandos.js` (leitura apenas — zero alterações)

---

## 1. Objetivo do endpoint

Receber comandos em texto simples enviados via WhatsApp/OpenClaw e devolver respostas formatadas em Markdown compatível com WhatsApp. É o ponto de entrada principal do assistente via mensageria — não usa NLP, usa matching exato de palavras-chave.

---

## 2. Fluxo geral

```
OpenClaw/WhatsApp
      │
      ▼
POST /api/comandos
      │
      ├─ valida X-Webhook-Token
      ├─ normaliza texto: lowercase + remove não-letras + trim
      ├─ match exato contra lista de aliases por comando
      │
      ├─ handler específico (pode chamar Supabase e/ou Google APIs)
      │
      └─ HTTP 200 { resposta: "...", ok: true }  ← SEMPRE 200
```

---

## 3. Headers esperados

| Header | Obrigatório | Valor |
|---|---|---|
| `Content-Type` | Sim | `application/json` |
| `X-Webhook-Token` | Sim* | valor de `WEBHOOK_TOKEN` env var |

*Alternativa: campo `token` no body JSON.

CORS: `Access-Control-Allow-Origin: *` em todas as respostas.

---

## 4. Autenticação atual

```js
const token = req.headers['x-webhook-token'] || req.body?.token;
if (token !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Token inválido' });
```

**Token padrão hardcoded:**
```js
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'oc_edson_2026_secure';
```

Se `WEBHOOK_TOKEN` não estiver definido como env var na Vercel, o token `oc_edson_2026_secure` funciona como senha de fallback — qualquer pessoa que conheça esse valor pode chamar o endpoint.

**GET não requer autenticação** — retorna `{ ok: true, message: 'Comandos endpoint online' }`.

---

## 5. Estrutura da request

```json
// Formato padrão
{ "comando": "resumo", "refresh_token": "..." }

// Formato OpenClaw (aceito como alternativa)
{ "texto": "resumo" }
```

O campo lido é: `req.body?.comando || req.body?.texto`

**Normalização do comando:**
```js
raw.toLowerCase().trim().replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, '').trim()
```
Remove números, pontuação e caracteres especiais. Mantém acentos (ã, é, ç, etc.). Converte para minúsculas.

---

## 6. Estrutura da response

**Sempre HTTP 200**, mesmo em caso de erro interno:

```json
{ "resposta": "<string formatada para WhatsApp>", "ok": true }
```

Único desvio: token inválido retorna HTTP 401 `{ "error": "Token inválido" }`.
Método não permitido retorna HTTP 405 `{ "error": "Method not allowed" }`.

O formato de `resposta` usa Markdown compatível com WhatsApp:
- `*texto*` → negrito
- `_texto_` → itálico
- Quebras de linha `\n` respeitadas

---

## 7. Lista de comandos suportados

| Aliases aceitos | Handler |
|---|---|
| `agenda`, `calendar`, `eventos` | `handleAgenda()` |
| `email`, `emails`, `e-mail`, `inbox` | `handleEmails(null)` |
| `drive`, `arquivos`, `docs` | `handleDrive(null)` |
| `tarefas`, `tasks`, `todo` | `handleTarefas()` |
| `financas`, `finanças`, `saldo`, `dinheiro` | `handleFinancas()` |
| `metas`, `goals`, `objetivos` | `handleMetas()` |
| `resumo`, `resume`, `dia`, `hoje` | `handleResumo()` |
| `alertas`, `alerta`, `ver alertas`, `listar alertas` | `handleAlertas()` |
| `ajuda`, `help`, `comandos`, `menu` | `handleAjuda()` |
| qualquer outro | mensagem "Comando não reconhecido" |

---

## 8. Qual função trata cada comando

| Comando | Função | Tipo |
|---|---|---|
| `agenda` | `handleAgenda()` | async — Google API |
| `emails` | `handleEmails(accessToken=null)` | async — Google API |
| `drive` | `handleDrive(accessToken=null)` | async — Google API |
| `tarefas` | `handleTarefas()` | async — Supabase |
| `financas` | `handleFinancas()` | async — Supabase |
| `metas` | `handleMetas()` | async — Supabase |
| `resumo` | `handleResumo()` | async — chama agenda+tarefas+financas em paralelo |
| `alertas` | `handleAlertas()` | async — HTTP fetch para própria Vercel prod |
| `ajuda` | `handleAjuda()` | sync — string estática |

---

## 9. Tabelas Supabase acessadas por comando

| Comando | Tabela | Operação | Campos selecionados |
|---|---|---|---|
| `agenda` | `oauth_tokens` | SELECT | `refresh_token` WHERE `servico=eq.google` |
| `emails` | `oauth_tokens` | SELECT | `refresh_token` WHERE `servico=eq.google` |
| `drive` | `oauth_tokens` | SELECT | `refresh_token` WHERE `servico=eq.google` |
| `tarefas` | `tarefas` | SELECT | `texto, done` ORDER BY `created_at.desc` LIMIT 10 |
| `financas` | `financas` | SELECT | `saldo` LIMIT 1 ORDER BY `updated_at.desc` |
| `financas` | `transacoes` | SELECT | `descricao, valor, tipo, data` ORDER BY `data.desc` LIMIT 5 |
| `metas` | `metas` | SELECT | `nome, atual, meta, icone` ORDER BY `created_at.asc` LIMIT 6 |
| `resumo` | (todas acima combinadas) | — | — |
| `alertas` | (nenhuma — usa HTTP externo) | — | — |

---

## 10. APIs externas usadas

| API | Endpoint | Comando | Condição |
|---|---|---|---|
| Google OAuth | `https://oauth2.googleapis.com/token` | agenda, emails, drive | sempre (obtém access_token do refresh) |
| Google Calendar | `googleapis.com/calendar/v3/calendars/primary/events` | agenda | token Google presente |
| Gmail | `gmail.googleapis.com/gmail/v1/users/me/messages` | emails | token Google presente |
| Google Drive | `googleapis.com/drive/v3/files` | drive | token Google presente |
| Própria Vercel prod | `https://dashboard-pessoal-edson.vercel.app/api/alerts` | alertas | sempre |

---

## 11. Dependências Google/OAuth

Todos os comandos de Google (`agenda`, `emails`, `drive`) seguem o mesmo fluxo:

```
handleXxx(accessToken=null)
  │
  ├─ accessToken é null?
  │     └─ sbFetch('/oauth_tokens?select=refresh_token&servico=eq.google&limit=1')
  │           └─ retorna refresh_token
  │
  ├─ refresh_token ausente → retorna mensagem amigável "token não encontrado"
  │
  ├─ getGoogleAccessToken(refreshToken)
  │     └─ POST oauth2.googleapis.com/token
  │           └─ retorna access_token ou null
  │
  ├─ access_token null → retorna "erro ao renovar token"
  │
  └─ chama Google API com access_token
```

**Observação crítica:** `handleEmails(null)` e `handleDrive(null)` são sempre chamados com `null` — nunca reutilizam token já obtido. Cada chamada ao `resumo` faz **3 renovações independentes** de access_token para o mesmo refresh_token.

---

## 12. Fluxos financeiros

```
handleFinancas()
  │
  ├─ sbFetch('/financas?select=saldo&limit=1&order=updated_at.desc')
  │     └─ lê campo: saldo (numeric)
  │
  └─ sbFetch('/transacoes?select=descricao,valor,tipo,data&order=data.desc&limit=5')
        └─ lê campos: descricao (text), valor (numeric), tipo (text), data (date)
```

**Tabelas lidas:** `financas` e `transacoes` — ambas são legadas no Plano B.
**Tabela correta** (`lancamentos_financeiros`) **não é usada** por este endpoint.

Formato de saída:
```
💰 *Finanças*
Saldo: R$ X.XXX,XX
Últimas transações:
🟢 Descrição: R$ X.XXX,XX
🔴 Descrição: R$ X.XXX,XX
```

---

## 13. Fluxos de tarefas

```
handleTarefas()
  │
  └─ sbFetch('/tarefas?select=texto,done&order=created_at.desc&limit=10')
        └─ filtra: rows.filter(t => !t.done)   ← campo legado
```

Formato de saída:
```
✅ *Tarefas pendentes (N)*
• Texto da tarefa
• Texto da tarefa
```
ou `✅ Todas as tarefas concluídas! (N feitas)`
ou `✅ Tarefas: nenhuma tarefa cadastrada.`

---

## 14. Fluxos de metas

```
handleMetas()
  │
  └─ sbFetch('/metas?select=nome,atual,meta,icone&order=created_at.asc&limit=6')
        │
        └─ para cada meta:
              pct = m.meta > 0 ? Math.round((m.atual / m.meta) * 100) : 0
              bar = '█'.repeat(pct/10) + '░'.repeat(10 - pct/10)
```

Formato de saída:
```
🎯 *Metas*
🎯 Nome da meta: 75%
   ███████░░░
```

---

## 15. Fluxos de resumo

```
handleResumo()
  │
  └─ Promise.all([handleAgenda(), handleTarefas(), handleFinancas()])
        │
        └─ concatena os 3 resultados com \n\n entre eles
```

O `resumo` **não** inclui: metas, emails, drive, alertas. Inclui apenas: agenda + tarefas + finanças.

---

## 16. Campos divergentes encontrados

| Tabela | Campo usado aqui | Campo usado em outros arquivos | Qual está certo? |
|---|---|---|---|
| `tarefas` | `done` | `concluida` (assistente.js, cron.js) | **A definir** |
| `tarefas` | `created_at` | `criado_em` (assistente.js, cron.js) | **A definir** |
| `metas` | `atual` | `valor_atual` (ask.js, cron.js) | **A definir** |
| `metas` | `meta` | `valor_meta` (ask.js, cron.js) | **A definir** |
| `metas` | `created_at` | `criado_em` (ask.js, cron.js) | **A definir** |

`comandos.js` é o arquivo mais antigo do projeto. Os outros arquivos (ask.js, cron.js, assistente.js) parecem ter sido escritos com nomes padronizados. A tabela real pode ter um dos dois conjuntos — ou ambos, com um deles sendo `null` em todas as linhas.

---

## 17. Onde pode ocorrer `undefined` silencioso

| Local | Causa | Efeito visível |
|---|---|---|
| `handleTarefas()` linha `rows.filter(t => !t.done)` | Se coluna real é `concluida`, então `t.done` é sempre `undefined` — falsy — **todas as tarefas aparecem como pendentes** | Nunca mostra "todas concluídas" |
| `handleMetas()` linha `m.meta > 0` | Se coluna real é `valor_meta`, então `m.meta` é `undefined` — condição sempre falsa → `pct = 0` | Todas as metas mostram 0% |
| `handleMetas()` linha `m.atual / m.meta` | Ambos `undefined` → `NaN / NaN` = NaN → `pct = NaN` | Ver seção 18 |
| `handleFinancas()` linha `saldo[0].saldo` | Se coluna real tem outro nome, retorna `undefined` → branch "dados não disponíveis" | Saldo sempre mostra "dados não disponíveis" |
| `sbFetch` retorna `null` em erro de rede | `rows?.length` é falsy → handler retorna "nenhum X cadastrado" | Erro de conexão mascarado como "vazio" |

---

## 18. Onde pode ocorrer `NaN`

| Local | Código | Resultado |
|---|---|---|
| `handleMetas()` | `Math.round((undefined / undefined) * 100)` | `NaN` |
| `handleMetas()` | `Math.floor(NaN / 10)` → argumento do `repeat()` | `NaN` — `String.repeat(NaN)` retorna `''` (string vazia) — barra de progresso some |
| `handleFinancas()` | `Number(t.valor)` onde `t.valor` é `undefined` | `NaN` — `.toLocaleString()` retorna a string `"NaN"` no output do WA |
| `handleFinancas()` | `Number(saldo[0].saldo)` onde `saldo` é `undefined` | Não chega aqui (guard `saldo?.[0]?.saldo !== undefined`), mas se chegar retorna `"NaN"` |

**Único NaN visível ao usuário:** `Number(t.valor)` quando `t.valor` é nulo/undefined — aparece como `"NaN"` na mensagem de transações enviada pelo WhatsApp.

---

## 19. Respostas amigáveis mascarando erro

| Handler | Mensagem amigável | Condição real |
|---|---|---|
| `handleTarefas()` | `"Tarefas: nenhuma tarefa cadastrada."` | Supabase erro, rede off, tabela vazia, coluna errada — tudo vira a mesma mensagem |
| `handleFinancas()` | `"Saldo: dados não disponíveis"` | Supabase erro, rede off, `financas` vazia ou com coluna diferente |
| `handleAgenda()` | `"token Google não encontrado"` | `oauth_tokens` vazia, SUPABASE_ANON_KEY ausente, rede off |
| `handleAgenda()` | `"erro ao renovar token Google"` | Token expirado, CLIENT_ID/SECRET errados, Google API down |
| `handleAlertas()` | `"Não foi possível consultar alertas"` | HTTP 4xx/5xx da própria Vercel, rede off, timeout |
| Catch global | `"Erro ao processar comando X. Tente novamente."` | Qualquer exceção não tratada nos handlers |

---

## 20. Contratos implícitos importantes

1. **Sempre HTTP 200:** OpenClaw/WhatsApp assume que qualquer resposta é a mensagem a entregar. Um HTTP 5xx pode fazer o OpenClaw não encaminhar a resposta ou tentar novamente.

2. **Campo `resposta` sempre presente:** Se ausente, o OpenClaw provavelmente envia mensagem vazia ao usuário.

3. **Token fallback hardcoded:** `oc_edson_2026_secure` funciona mesmo sem env var configurada. Remoção do fallback sem configurar a env var quebraria todas as chamadas do OpenClaw.

4. **Dois formatos de body aceitos:** `{ comando }` e `{ texto }` — o OpenClaw usa `texto`, o formato legado usava `comando`. Remover suporte a um dos dois quebraria algum cliente.

5. **Normalização de comando remove pontuação:** `"finanças!"` → `"finanças"`. Comandos com números (`tarefa 1`) viram `"tarefa "` (espaço) — não reconhecidos.

6. **`handleAlertas` bate em produção:** Mesmo em desenvolvimento, o comando `alertas` faz HTTP fetch para `dashboard-pessoal-edson.vercel.app`. Sem acesso à internet, este comando sempre falha.

7. **`handleEmails` e `handleDrive` ignoram `accessToken` passado:** São sempre chamados com `null` pelo dispatch principal — busca do Supabase acontece em toda execução.

---

## 21. Comportamentos que NÃO podem mudar

| Comportamento | Por que não pode mudar |
|---|---|
| `HTTP 200` em toda resposta | OpenClaw interpreta 4xx/5xx como falha e pode não repassar ao WA |
| `{ resposta, ok: true }` como body | Contrato com OpenClaw |
| Aceitar `req.body?.texto` | Formato que o OpenClaw usa |
| Aceitar `req.headers['x-webhook-token']` | Como o OpenClaw autentica |
| Aliases dos comandos (ex: `saldo`, `dinheiro`, `finanças`) | Usuários já treinados a usá-los |
| Manter resposta `"Comando não reconhecido: X"` com sugestão `"Digite ajuda"` | UX estabelecida |

---

## 22. Riscos de quebrar WhatsApp/OpenClaw

| Mudança | Risco |
|---|---|
| Mudar status HTTP de resposta de 200 para 4xx/5xx | **CRÍTICO** — OpenClaw para de repassar mensagens |
| Remover campo `resposta` da response | **CRÍTICO** — mensagens chegam vazias |
| Remover suporte a `req.body?.texto` | **ALTO** — formato atual do OpenClaw |
| Mudar `WEBHOOK_TOKEN` sem atualizar no OpenClaw | **ALTO** — todas as mensagens retornam 401 silenciosamente |
| Renomear aliases de comando (ex: remover `saldo`) | **MÉDIO** — usuários que usam `saldo` passam a ver "não reconhecido" |
| Adicionar autenticação no GET | **BAIXO** — GET não é usado pelo fluxo WA |
| Corrigir nomes de colunas de `tarefas`/`metas` no código SEM verificar o banco | **ALTO** — se banco tem `done`/`atual`, corrigir para `concluida`/`valor_atual` quebra os handlers |

---

## 23. Próxima microtarefa segura

**ADR: confirmar nomes reais das colunas de `tarefas` e `metas` no banco.**

Antes de qualquer alteração de código neste arquivo, é preciso saber qual conjunto de nomes existe de fato na tabela Supabase:

| Tabela | Hipótese A (legado) | Hipótese B (padrão) |
|---|---|---|
| `tarefas` | `done`, `created_at` | `concluida`, `criado_em` |
| `metas` | `atual`, `meta`, `created_at` | `valor_atual`, `valor_meta`, `criado_em` |

Método seguro para confirmar (leitura, sem SQL, sem alteração):
- Inspecionar via painel Supabase → Table Editor → colunas de `tarefas` e `metas`
- Ou: observar o JSON retornado por `GET /api/tarefas` em produção e checar quais campos estão presentes

Somente após confirmação é seguro decidir:
- Se banco tem nomes legados (`done`, `atual`) → `comandos.js` está certo, os outros precisam migrar
- Se banco tem nomes novos (`concluida`, `valor_atual`) → `comandos.js` está errado e silenciosamente retorna dados vazios/incorretos
