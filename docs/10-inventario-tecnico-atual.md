# Inventário Técnico Atual — Dashboard Pessoal

> Documento criado em: 2026-05-10

---

## 12. Diagnóstico local (2026-05-10)

### Problema: server.js não roda localmente

**Causa raiz:** conflito entre o modo de módulo declarado e a sintaxe usada.

| Arquivo | Declaração | Sintaxe |
|---|---|---|
| `package.json` | `"type": "module"` → Node trata `.js` como **ESM** | — |
| `server.js` | — | `require()`, `__dirname` → **CommonJS (CJS)** |

O Node.js v24 recusa `require()` em arquivos tratados como ESM, resultando em:

```
ReferenceError: require is not defined in ES module scope
```

---

### Solução local segura: `server.cjs`

Renomear `server.js` para `server.cjs` força o Node a tratar o arquivo como CommonJS
independentemente do `"type": "module"` no `package.json`.

- Nenhuma lógica foi alterada
- Nenhum arquivo de produção foi modificado
- `package.json` permanece intacto
- Os arquivos `api/*.js` (ESM) continuam funcionando normalmente

**Comando de execução local:**
```bash
cd /c/Users/Cliente/dashboard-pessoal
node server.cjs
```

---

### Resultado: servidor sobe na porta 8080

```
✅  Servidor rodando!
🌐  Acesse: http://localhost:8080
```

**Warning não crítico registrado:**
```
[DEP0169] DeprecationWarning: `url.parse()` is not standardized — use WHATWG URL API
```
Não impede o funcionamento. Não foi corrigido (fora do escopo desta sessão).

---

### Rotas testadas

| Rota | Método | HTTP | Resultado |
|---|---|---|---|
| `/` | GET | 200 | `dashboard.html` servido corretamente |
| `/login.html` | GET | 200 | `login.html` servido corretamente |
| `/api/config` | GET | 200 | JSON com campos vazios (sem `config.json`) |
| `/api/comandos` | GET | 200 | `[]` (nenhum comando registrado) |
| `/api/supervisor` | GET | 404 | Ver nota abaixo |

---

### `/api/supervisor` retorna 404 no servidor local

`api/supervisor.js` é uma **função serverless Vercel** — não é uma rota registrada em `server.cjs`.

O `server.cjs` define apenas as rotas hardcoded abaixo:

```
GET  /oauth/google
GET  /oauth/tiktok
POST /api/tiktok/token
POST /api/google/token
POST /api/google/refresh
GET  /api/config
GET  /api/comandos
POST /api/webhook
POST /api/analisa-foto
     /* fallback: arquivos estáticos */
```

Os arquivos em `api/` (`supervisor.js`, `ask.js`, `cron.js`, `assistente.js`, etc.)
são invocados apenas pela infraestrutura Vercel em produção.

---

### Estado do config.json

O arquivo `config.json` está ausente localmente (listado no `.gitignore` e `.vercelignore`).

`getConfig()` em `server.cjs` tem `try/catch` e retorna `{}` se o arquivo não existir —
o servidor sobe normalmente. Rotas que precisam de credenciais retornam `HTTP 400` quando chamadas.

| Credencial | Fonte esperada | Status local |
|---|---|---|
| `google.clientId / clientSecret` | `config.json` | ⚠️ Ausente |
| `GOOGLE_CLIENT_ID / SECRET` | `process.env` | ⚠️ Não definido |
| `META_APP_ID` | `process.env` | ⚠️ Não definido |
| `WA_BUSINESS_TOKEN` | `process.env` | ⚠️ Não definido |

---

### Arquivos criados nesta sessão (sem alterar produção)

| Arquivo | Tipo | Descrição |
|---|---|---|
| `server.cjs` | Cópia de `server.js` | Permite execução local com Node CJS |
| `docs/AI_SESSION_STATE.md` | Novo | Estado da sessão para retomada futura |
| `docs/10-inventario-tecnico-atual.md` | Novo | Este documento |

**Nenhum arquivo existente foi modificado. Nenhum commit. Nenhum deploy.**
