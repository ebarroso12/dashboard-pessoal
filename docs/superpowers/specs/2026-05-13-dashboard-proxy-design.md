# Design: api/dashboard-proxy

> Data: 2026-05-13
> Status: aprovado
> Contexto: token publico removido em commit 46b478b; frontend nao pode mais enviar WEBHOOK_TOKEN.

---

## Problema

Apos remover `oc_edson_2026_secure` do `dashboard.html`, 6 chamadas frontend passaram a enviar `X-Webhook-Token: ''`. As APIs `/api/assistente` e `/api/supervisor` retornam 401. O dashboard precisa de autenticacao sem expor o token.

---

## Solucao

Endpoint proxy unico `/api/dashboard-proxy`:

- Frontend chama o proxy sem token
- Proxy adiciona `WEBHOOK_TOKEN` internamente (env var Vercel)
- Proxy chama o target via HTTP e repassa a resposta
- CORS restrito a origem fixa do dashboard

---

## Arquitetura

```
dashboard.html
    |
    +-- POST /api/dashboard-proxy
          |  { action, payload }
          |  sem X-Webhook-Token
          |
          +-- action: 'assistente'       --> POST /api/assistente
          +-- action: 'supervisor-chat'  --> POST /api/supervisor
          +-- action: 'supervisor-status'--> GET  /api/supervisor
```

URL base interna: `https://dashboard-pessoal-edson.vercel.app` (sem fallback, fail-fast se ausente).

---

## Contrato do proxy

### Request

```
POST /api/dashboard-proxy
Content-Type: application/json

{ "action": "<ver tabela>", "payload": { ... } }
```

### Whitelist de actions e payload

| action | target | campos aceitos no payload |
|---|---|---|
| `assistente` | POST `/api/assistente` | `q` (string, obrigatorio), `origem` (string, opcional) |
| `supervisor-chat` | POST `/api/supervisor` | `mensagem` (string, obrigatorio), `historico` (array, opcional) |
| `supervisor-status` | GET `/api/supervisor` | nenhum |

Campos fora desta lista sao descartados antes de repassar ao target. Proxy nao encaminha payload arbitrario.

### Responses

- Repassa status e body do target sem alteracao
- `400` se `action` ausente ou desconhecida
- `405` se metodo nao for POST
- `500` se `WEBHOOK_TOKEN` env var ausente (fail-fast, nao silencia)

---

## CORS

```
Access-Control-Allow-Origin:  https://dashboard-pessoal-edson.vercel.app
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Origem fixa e explicita. Sem `*`. Sem fallback para outra origem.

---

## Seguranca

- `WEBHOOK_TOKEN` nunca aparece em nenhuma resposta ao frontend
- Payload validado por action antes de repassar (sem injecao de campos extras)
- URL interna hardcoded sem variaveis dinamicas
- Qualquer action desconhecida bloqueia com 400 imediatamente

Risco residual aceito: `Origin` pode ser forjado com curl/ferramenta direta. Impacto: custo de Anthropic API. Mitigacao: dashboard pessoal sem exposicao publica; risco classificado como baixo.

---

## Arquivos afetados

| Arquivo | Tipo | Descricao |
|---|---|---|
| `api/dashboard-proxy.js` | novo | proxy com whitelist e CORS restrito |
| `dashboard.html` | modificado | 6 pontos de chamada apontam para `/api/dashboard-proxy` |
| `tests/contract/api-dashboard-proxy.test.js` | novo | testes de whitelist, CORS, payload strip e propagacao de resposta |

`api/assistente.js` e `api/supervisor.js` nao mudam.

---

## Testes minimos

1. POST com action desconhecida retorna 400
2. POST sem `q` na action `assistente` retorna 400
3. POST sem `mensagem` na action `supervisor-chat` retorna 400
4. Campos extras no payload sao descartados (nao chegam ao target)
5. `supervisor-status` ignora qualquer payload enviado
6. WEBHOOK_TOKEN ausente retorna 500

---

## Plano incremental

1. Criar `api/dashboard-proxy.js` com whitelist e CORS restrito
2. Escrever e rodar testes de contrato
3. Atualizar 6 pontos em `dashboard.html` para usar o proxy
4. Verificar grep: nenhuma chamada direta restante a `/api/assistente` ou `/api/supervisor` sem token no frontend
5. Commit + push
6. Rotacionar `WEBHOOK_TOKEN` no Vercel (acao operacional, fora do codigo)
