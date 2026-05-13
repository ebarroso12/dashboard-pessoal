# Incidente de Segurança: Token Meta em supervisor_logs

> Data de descoberta: 2026-05-11
> Severidade: ALTA
> Estado: ATIVO — token ainda potencialmente válido e exposto publicamente

---

## 1. O que foi encontrado

Durante auditoria de produção (`docs/28`), a chamada:

```
GET https://dashboard-pessoal-edson.vercel.app/api/supervisor
```

retornou os últimos 5 registros de `supervisor_logs`. O registro **id:20**
(criado em 2026-04-28) contém na coluna `mensagem` um token de acesso Meta
de longa duração, em texto claro.

O token foi registrado pelo Supervisor IA durante uma sessão em que o Dr. Edson
confirmou manualmente o token Meta via chat — o agente Claude o incluiu
literalmente na chamada a `tool_registrar_incidente`.

---

## 2. Risco real

### 2a. Exposição pública sem autenticação (CRÍTICO)

`GET /api/supervisor` **não requer autenticação**. O handler GET roda antes
do bloco de auth do arquivo (`api/supervisor.js` linhas 377–385 vs. 390–391).
O bloco de auth só protege POST.

Qualquer pessoa com a URL pode chamar:
```
curl https://dashboard-pessoal-edson.vercel.app/api/supervisor
```
e receber o JSON com os 5 últimos logs, incluindo o token.

### 2b. Token ainda no janela dos últimos 5 logs

A query é `supervisor_logs?order=criado_em.desc&limit=5`. Há 23 registros.
Os 5 mais recentes são ids 23, 22, 21, **20**, 19. O token está em id:20 —
quarto da lista. Ele permanece exposto até que pelo menos 4 novos logs sejam
criados acima dele.

### 2c. Token Meta provavelmente ainda válido

Tokens de usuário Meta expiram em ~60 dias. Criado em 28/04/2026, o token
tem validade estimada até ~27/06/2026. Hoje (11/05) faltam ~47 dias para
expiração natural — mas pode ter vida útil mais longa se for token de sistema.

### 2d. Tabela também lida via anon key direta

`supervisor_logs` não tem Row Level Security (RLS) confirmado. A anon key,
exposta em `dashboard.html` e `server-vps.js`, permite leitura direta:
```
GET https://jaewjscbigfwjiaeavft.supabase.co/rest/v1/supervisor_logs?select=*
```
Esta rota também expõe o token sem qualquer autenticação adicional.

---

## 3. O que NÃO fazer

- **Não rotacionar o token sem antes apagar o log** — gerar novo token antes
  de limpar o log antigo não resolve nada: o token novo pode aparecer no mesmo
  lugar se o Supervisor IA for usado novamente.

- **Não deletar toda a tabela** — `supervisor_logs` tem 23 registros com
  histórico de diagnósticos. Só o id:20 precisa ser tratado.

- **Não fazer deploy de código antes de revogar o token** — mudar o código
  não invalida um token já exposto.

- **Não alterar RLS antes de revogar** — RLS protege acesso futuro, não
  desfaz a exposição passada.

- **Não postar o token em nenhum outro lugar** (Slack, email, documento) ao
  discutir o incidente.

---

## 4. Ação imediata recomendada

**Ordem obrigatória:**

1. **Agora — revogar token Meta** (ver seção 6)
2. **Em seguida — apagar/mascarar id:20** (ver seção 5)
3. **Depois — adicionar auth ao GET** (ver seção 8, passo 1)
4. **Depois — habilitar RLS** (ver seção 7)

Revogar o token primeiro garante que mesmo que o log persista por alguns
minutos, o token não seja mais utilizável.

---

## 5. Como remover / mascarar o log com segurança

### Opção A — Apagar o registro (recomendado)

No painel Supabase → SQL Editor, executar:

```sql
DELETE FROM supervisor_logs WHERE id = 20;
```

Isso remove o registro completamente. O histórico de diagnósticos permanece
intacto (22 outros registros).

### Opção B — Mascarar a mensagem (se quiser manter o registro para auditoria)

```sql
UPDATE supervisor_logs
SET mensagem = '[TOKEN REMOVIDO — incidente de segurança 2026-05-11]'
WHERE id = 20;
```

**Verificar após executar:**
```sql
SELECT id, mensagem FROM supervisor_logs WHERE id = 20;
```

---

## 6. Necessidade de rotacionar o token Meta

**Sim — rotacionar é necessário**, independentemente de haver indício de uso
indevido. O princípio de compromisso pressupõe que um token exposto deve ser
considerado comprometido.

### Como revogar no Meta for Developers

1. Acessar: `developers.facebook.com` → seu aplicativo
2. Ir em **Ferramentas** → **Explorador da API do Graph**
3. No campo de token, localizar o token expirado (começa com `EAARgT8...`)
4. Clicar em **Revogar** ou usar o endpoint:
   ```
   DELETE https://graph.facebook.com/me/permissions
   Authorization: Bearer <token_a_revogar>
   ```
5. Gerar novo token com os mesmos escopos (`pages_show_list`,
   `instagram_basic`, `instagram_manage_insights`, etc.)
6. Salvar o novo token no Supabase via Table Editor:
   ```sql
   UPDATE oauth_tokens
   SET access_token = '<novo_token>'
   WHERE servico = 'meta';
   ```

**Importante:** não inserir o novo token via chat do Supervisor IA — isso
repetiria o incidente.

---

## 7. Como validar RLS de supervisor_logs

### Verificar estado atual

No Supabase → Table Editor → `supervisor_logs` → botão **RLS** (ou via SQL):

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'supervisor_logs';
```

Se `rowsecurity = false`, a tabela está aberta para leitura/escrita via anon key.

### Habilitar RLS mínimo

```sql
-- 1. Habilitar RLS
ALTER TABLE supervisor_logs ENABLE ROW LEVEL SECURITY;

-- 2. Bloquear leitura anon (nenhuma linha visível via anon key)
CREATE POLICY "deny_anon_read" ON supervisor_logs
  FOR SELECT
  USING (false);

-- 3. Permitir escrita pelo service_role (usado pelo Vercel via SUPABASE_ANON_KEY)
-- NOTA: a anon key não é o service_role. Se os logs precisam ser escritos
-- pelo endpoint Vercel, a política de INSERT deve ser permissiva para anon:
CREATE POLICY "allow_insert" ON supervisor_logs
  FOR INSERT
  WITH CHECK (true);
```

**Após ativar RLS:** testar que `GET /api/supervisor` ainda retorna logs
(porque o Vercel usa a anon key para ler — se RLS bloquear leitura anon, o
endpoint vai retornar array vazio). O bloqueio de leitura direta via REST é
desejado; o endpoint deve ser a única forma de acesso aos logs.

---

## 8. Plano de prevenção para não logar tokens de novo

### Passo 1 — Adicionar autenticação ao GET /api/supervisor

**Arquivo:** `api/supervisor.js` linhas 377–385

Mover o bloco de auth para antes do GET:

```js
// ANTES DO if (req.method === 'GET') { ... }
const token = req.headers['x-webhook-token'] || req.body?.token;
if (req.method !== 'OPTIONS' && token !== WEBHOOK_TOKEN) {
  return res.status(401).json({ error: 'Token inválido' });
}
```

Isso fecha a exposição pública sem alterar o comportamento para clientes
autenticados (o frontend já envia o token no header).

### Passo 2 — Sanitizar mensagens antes de gravar em supervisor_logs

**Arquivo:** `api/supervisor.js` — função `tool_registrar_incidente`

Adicionar scrubbing de padrões que parecem tokens antes de gravar:

```js
function scrubTokens(text) {
  // Remove strings que parecem tokens OAuth (>40 chars alfanumerico sem espaços)
  return text.replace(/\b[A-Za-z0-9_\-]{40,}\b/g, '[REDACTED]');
}

async function tool_registrar_incidente({ severidade, mensagem, componente }) {
  const mensagemSafe = scrubTokens(mensagem);
  await sb('/supervisor_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ severidade, mensagem: mensagemSafe, componente,
      criado_em: new Date().toISOString() }),
  });
  return { ok: true, registrado: true };
}
```

### Passo 3 — Adicionar ao system prompt do Supervisor

No `SYSTEM` de `api/supervisor.js` (linha 265), adicionar:

```
SEGURANÇA: Nunca inclua tokens, chaves, senhas ou strings longas de
autenticação na mensagem de um incidente. Use apenas '[TOKEN PRESENTE]'
ou '[CREDENCIAL PRESENTE]' para indicar que um token existe.
```

---

## 9. Ordem exata de correção

```
Etapa | Ação                                    | Onde           | Quem executa
------|----------------------------------------|----------------|-------------
1     | Revogar token Meta                      | Meta Developers| Dr. Edson
2     | DELETE FROM supervisor_logs WHERE id=20 | Supabase SQL   | Dr. Edson
3     | Confirmar deleção (SELECT id=20)        | Supabase SQL   | Dr. Edson
4     | Gerar novo token Meta                   | Meta Developers| Dr. Edson
5     | Salvar novo token em oauth_tokens       | Supabase SQL   | Dr. Edson
6     | Alterar GET /api/supervisor (auth)      | api/supervisor | Claude Code
7     | Adicionar scrubbing em registrar_incidente | api/supervisor | Claude Code
8     | Habilitar RLS em supervisor_logs        | Supabase SQL   | Dr. Edson
9     | Adicionar regra ao SYSTEM prompt        | api/supervisor | Claude Code
10    | Deploy                                  | Vercel         | Dr. Edson
11    | Testar GET /api/supervisor sem token    | curl           | Verificar 401
```

**Etapas 1–5 são manuais e devem ser feitas antes de qualquer alteração de código.**
**Etapas 6–9 serão executadas pelo Claude Code após confirmação do Dr. Edson.**
**Etapa 10 só ocorre depois que todas as etapas anteriores estiverem concluídas.**
