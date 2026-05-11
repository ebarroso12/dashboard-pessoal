# Contrato Real — OpenClaw Webhook

> Leitura pura. Nenhum codigo alterado.
> Data: 2026-05-11
> Fonte: api/webhook.js, api/lib/openclaw.js, api/alerts.js, api/cron.js, dashboard.html

---

## 1. Estrutura esperada do body (inbound)

Documentada no painel de configuracao do dashboard (linha 2431 de dashboard.html):

```json
{
  "tipo":     "voz",
  "texto":    "transcricao do audio",
  "resposta": "resposta da IA",
  "de":       "WhatsApp",
  "token":    "oc_edson_2026_secure"
}
```

O que o codigo (`api/webhook.js` linhas 79-85) aceita de fato:

```js
{
  tipo:     body.tipo     || (body.audio ? 'voz' : 'texto'),
  texto:    body.texto    || body.text     || '',
  resposta: body.resposta || body.response || '',
  de:       body.de       || body.from     || 'WhatsApp',
  status:   body.status   || 'ok',
}
```

---

## 2. Campos obrigatorios

Nenhum campo do body e tecnicamente obrigatorio — todos tem fallback.
O unico requisito real e o **token de autenticacao**:

| Opcao | Onde | Valor |
|-------|------|-------|
| Header | `X-Webhook-Token` | `oc_edson_2026_secure` |
| Body | `body.token` | `oc_edson_2026_secure` |

Sem token valido: `HTTP 401 { error: "Token invalido" }`.

---

## 3. Campos opcionais e seus aliases

| Campo salvo | Aliases aceitos | Fallback | Notas |
|-------------|----------------|----------|-------|
| `tipo` | `body.tipo` | `'voz'` se `body.audio` presente; `'texto'` caso contrario | Controla icone no dashboard |
| `texto` | `body.texto`, `body.text` | `''` | Transcricao ou texto do usuario |
| `resposta` | `body.resposta`, `body.response` | `''` | Resposta ja gerada pelo OpenClaw |
| `de` | `body.de`, `body.from` | `'WhatsApp'` | Origem/remetente |
| `status` | `body.status` | `'ok'` | Status do processamento |
| `token` | `body.token` | — | Auth alternativa ao header |
| `audio` | `body.audio` | — | **Nao salvo** — apenas infere `tipo='voz'` |

---

## 4. Como comandos sao detectados

**O `/api/webhook` NAO detecta nem processa comandos.**

Ele e um endpoint de log puro:
```
OpenClaw → POST /api/webhook → INSERT na tabela `comandos` → retorna { ok: true, id }
```

O OpenClaw ja chegou com `texto` (transcricao) e `resposta` (o que foi respondido ao usuario)
prontos. O webhook apenas persiste esse par para exibicao no dashboard.

O processamento de comandos por keyword ocorre em endpoint separado:
```
OpenClaw → POST /api/comandos → handler de keyword → retorna { resposta, ok: true }
```

Os dois endpoints sao independentes. Uma chamada ao webhook nao aciona `/api/comandos`.

---

## 5. Como mensagens sao roteadas

Dois fluxos distintos, escolhidos pelo OpenClaw:

### Fluxo A — Audio / linguagem natural
```
Usuario envia audio no WhatsApp
    ↓
OpenClaw transcreve + processa com IA interna
    ↓
OpenClaw POST /api/webhook { tipo:"voz", texto:"...", resposta:"..." }
    ↓
webhook salva em `comandos`
    ↓
Dashboard exibe no widget OpenClaw Voz (polling a cada 4s)
```

### Fluxo B — Comandos por keyword
```
Usuario envia texto ("resumo", "agenda", etc.)
    ↓
OpenClaw POST /api/comandos { texto:"resumo" }
    ↓
handler executa (Supabase/Google API)
    ↓
retorna { resposta: "...", ok: true }
    ↓
OpenClaw repassa resposta ao usuario no WhatsApp
```

No fluxo B o registro nao aparece no widget OpenClaw Voz (nao ha POST ao /api/webhook).
Se o OpenClaw logar o resultado, ele precisaria fazer um segundo POST ao webhook.
Nao ha evidencia de que isso aconteca hoje.

---

## 6. Como respostas sao enviadas de volta ao usuario

O Vercel NAO envia respostas ao usuario via WhatsApp — apenas processa e retorna JSON.
Quem envia e sempre o OpenClaw (ou a Meta API).

Tres mecanismos de envio existem no repo:

### 6a. OpenClaw WebSocket (`api/lib/openclaw.js`)
Usado por: `api/alerts.js`
```
POST /api/alerts/sync → detecta alerta critico/warn
    → sendWhatsApp(PHONE_BRIEFING, texto)
    → conecta wss://openclaw.n8ndredson.com
    → autentica → chat.send (deliver:false)
    → envia mensagem pro numero configurado
```
`deliver: false` significa que o OpenClaw nao aciona Claude ao receber a mensagem enviada.

### 6b. Meta WhatsApp Business API (`api/cron.js`)
Usado por: cron morning, reviews, weekly
```
POST graph.facebook.com/v19.0/{WA_PHONE}/messages
    → envia texto diretamente via Meta API
    → requer WA_BUSINESS_TOKEN env var
```
Independente do OpenClaw.

### 6c. Link `wa.me` (dashboard.html)
Usado por: botao "Enviar via WhatsApp" no widget morning briefing
```
window.open(`https://wa.me/${num}?text=...`)
    → abre conversa no WhatsApp do usuario
    → usuario envia manualmente
```
Nao automatizado — acao humana.

---

## 7. Como erros sao tratados

| Situacao | Resposta |
|----------|----------|
| Token invalido | `HTTP 401 { error: "Token invalido" }` |
| Metodo nao permitido | `HTTP 405 { error: "Metodo nao permitido" }` |
| SUPABASE_ANON_KEY ausente | `HTTP 500 { error: "Configuracao incompleta: SUPABASE_ANON_KEY ausente" }` |
| Erro ao salvar no Supabase | `HTTP 500 { error: "Erro ao salvar comando", detail: ... }` |
| Erro ao buscar comandos (GET) | `HTTP 500 { error: "Erro ao buscar comandos", detail: ... }` |

O webhook e o unico endpoint que retorna 4xx/5xx em erros reais.
`/api/comandos` retorna sempre 200 (ver doc 17).

---

## 8. O que parece legado

| Elemento | Evidencia | Risco de remover |
|----------|-----------|-----------------|
| `body.text` (alias de `body.texto`) | Fallback para integracao mais antiga | Baixo — se OpenClaw usa `texto`, `text` e morto |
| `body.from` (alias de `body.de`) | Convencao inglesa antiga | Baixo |
| `body.response` (alias de `body.resposta`) | Convencao inglesa antiga | Baixo |
| `body.audio` | Detectado mas nao salvo — apenas infere tipo | Medio — remover muda inferencia de `tipo` |
| `body.status` | Aceito mas nunca lido apos salvar | Baixo |
| Formato `body.comando` em `/api/comandos` | Descrito como "formato legado" nos proprios comentarios | Medio — pode ter cliente antigo |

---

## 9. O que esta em uso em producao

Com base no body documentado no dashboard e nos contratos P0 testados:

```json
{
  "tipo":     "voz" | "texto",
  "texto":    "<transcricao ou mensagem>",
  "resposta": "<resposta gerada pelo OpenClaw>",
  "de":       "WhatsApp",
  "token":    "oc_edson_2026_secure"
}
```

Header alternativo (mais seguro que token no body):
```
X-Webhook-Token: oc_edson_2026_secure
```

Tabela `comandos` no Supabase recebe:
`id, tipo, texto, resposta, de, status, ts (timestamptz default now())`

Dashboard le direto do Supabase via REST a cada 4s:
```
GET /rest/v1/comandos?select=*&order=ts.desc&limit=20
```

---

## 10. Oportunidades futuras

### Memoria IA
**Situacao atual:** cada mensagem e tratada de forma isolada. O `texto` e a `resposta` sao
logados mas nunca consultados pelo OpenClaw em interacoes futuras.

**Oportunidade:** usar a tabela `chat_assistente` (ja existe) como historico de contexto.
Antes de gerar uma resposta, o OpenClaw (ou `/api/assistente`) consultaria as ultimas N
interacoes para personalizar a resposta.

**Impacto:** respostas que lembram conversas anteriores ("voce me perguntou isso
ontem..."); contexto de metas e tarefas em curso.

---

### Anexos e imagens
**Situacao atual:** `body.audio` e detectado mas descartado. Nenhum campo para imagens.

**Oportunidade:** salvar URL do audio/imagem no Supabase; adicionar campo `anexo_url` e
`anexo_tipo` na tabela `comandos`. O dashboard poderia exibir o audio original com player.

**Impacto:** historico completo — hoje so o texto transcrito e preservado.

---

### Documentos (PDF, texto)
**Situacao atual:** nao suportado.

**Oportunidade:** quando usuario envia PDF pelo WhatsApp, OpenClaw extrai texto e envia
via webhook com `tipo: "documento"`. O `/api/assistente` faria analise do conteudo.

**Impacto:** analise de laudos medicos, contratos, receituarios — contexto relevante
para medico.

---

### Contexto familiar/pessoal
**Situacao atual:** todas as mensagens chegam sem contexto de quem enviou alem de
`de: "WhatsApp"`.

**Oportunidade:** adicionar campo `contato_nome` ou `contato_id` ao body do webhook.
Isso permitiria ao `/api/assistente` adaptar a resposta conforme o remetente
(familia, paciente, colega) — cada grupo com regras de privacidade diferentes.

**Impacto:** "Quando o Dr. Edson pergunta sobre saldo, mostrar detalhes. Quando outro
numero pergunta, resposta generica."

---

### Confirmacao de entrega
**Situacao atual:** o webhook nao sabe se a resposta chegou ao usuario.

**Oportunidade:** usar o campo `status` da tabela `comandos` (hoje sempre `'ok'`) para
rastrear: `pending → delivered → read`. O OpenClaw enviaria um segundo POST ao
webhook com o status de entrega.

**Impacto:** dashboard mostraria confirmacao visual de mensagens lidas.
