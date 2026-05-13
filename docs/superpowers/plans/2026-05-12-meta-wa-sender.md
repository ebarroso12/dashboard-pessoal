# Meta WA Business API Sender — Plano de Execucao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir implementacao WebSocket do OpenClaw por chamada HTTP Meta WA API em `api/lib/openclaw.js`, mantendo contratos externos identicos.

**Architecture:** Reescrever corpo de `sendWhatsApp` para HTTP fetch a `graph.facebook.com`. Mesma assinatura exportada. Mesmas env vars do `api/cron.js`.

**Tech Stack:** Node.js ESM, Vercel Serverless, Meta WA Business API v19.0, `node:test`

**Spec de referencia:** `docs/superpowers/specs/2026-05-12-meta-wa-sender-design.md`

---

## Pre-condicoes

- [ ] Confirmar `WA_BUSINESS_TOKEN` valido no Vercel (testar via `/api/cron?tipo=morning` ou checar Vercel env)
- [ ] Confirmar `WA_BUSINESS_PHONE_ID` configurado (default: `607518142444507`)
- [ ] Confirmar `PHONE_BRIEFING` configurado com numero destino

---

## Task 1: Atualizar testes de contrato

**Arquivos:**
- Modify: `tests/contract/api-openclaw.test.mjs`

- [ ] **1.1 Rodar testes atuais para confirmar baseline**

```bash
node --test tests/contract/api-openclaw.test.mjs
```
Esperado: 4/4 passando (contratos antigos do protocolo OpenClaw)

- [ ] **1.2 Atualizar assercoes para o novo contrato**

Substituir o conteudo por assercoes que validam o protocolo Meta WA:

```js
test('nao importa WebSocket (protocolo HTTP agora)', () => {
  assert.ok(!src.includes("require('ws')") && !src.includes('require("ws")'),
    'nao deve usar WebSocket');
});

test('usa WA_BUSINESS_TOKEN (nao OPENCLAW_TOKEN)', () => {
  assert.ok(src.includes('WA_BUSINESS_TOKEN'),
    'deve usar WA_BUSINESS_TOKEN');
  assert.ok(!src.includes('OPENCLAW_TOKEN'),
    'nao deve referenciar OPENCLAW_TOKEN');
});

test('chama graph.facebook.com', () => {
  assert.ok(src.includes('graph.facebook.com'),
    'deve chamar Meta WA API');
});

test('exporta sendWhatsApp com mesma assinatura', () => {
  assert.ok(src.includes('export async function sendWhatsApp'),
    'deve exportar sendWhatsApp');
});
```

- [ ] **1.3 Rodar testes — confirmar que FALHAM (RED)**

```bash
node --test tests/contract/api-openclaw.test.mjs
```
Esperado: 4/4 falhando (codigo ainda nao foi alterado)

---

## Task 2: Reescrever api/lib/openclaw.js

**Arquivos:**
- Modify: `api/lib/openclaw.js`

- [ ] **2.1 Substituir implementacao completa**

Conteudo final do arquivo:

```js
/**
 * api/lib/openclaw.js
 * Envia mensagem WhatsApp via Meta WA Business API.
 * Substitui integracao WebSocket OpenClaw (incompativel com Vercel stateless).
 *
 * Env vars (mesmas de api/cron.js):
 *   WA_BUSINESS_TOKEN    — token Meta WA (obrigatorio)
 *   WA_BUSINESS_PHONE_ID — phone ID (default: 607518142444507)
 */

const WA_TOKEN = process.env.WA_BUSINESS_TOKEN    || '';
const WA_PHONE = process.env.WA_BUSINESS_PHONE_ID || '607518142444507';

export async function sendWhatsApp(to, message) {
  if (!WA_TOKEN) throw new Error('WA_BUSINESS_TOKEN nao configurado');

  const number = String(to).replace(/\D/g, '');
  const r = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE}/messages`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:               number,
      type:             'text',
      text:             { body: message },
    }),
  });

  const d = await r.json();
  if (!d.messages?.[0]?.id) {
    throw new Error(`Meta WA falhou: ${JSON.stringify(d.error || d)}`);
  }
  return { id: d.messages[0].id };
}
```

- [ ] **2.2 Rodar testes — confirmar GREEN**

```bash
node --test tests/contract/api-openclaw.test.mjs
```
Esperado: 4/4 passando

---

## Task 3: Atualizar api/whatsapp/test.js

**Arquivos:**
- Modify: `api/whatsapp/test.js`

- [ ] **3.1 Atualizar envCheck para refletir nova env var**

Trocar:
```js
const envCheck = {
  OPENCLAW_TOKEN: process.env.OPENCLAW_TOKEN ? `✅ configurado` : '❌ ausente',
  PHONE_BRIEFING: WA_DEST || '❌ ausente',
};
```

Por:
```js
const envCheck = {
  WA_BUSINESS_TOKEN:    process.env.WA_BUSINESS_TOKEN    ? '✅ configurado' : '❌ ausente',
  WA_BUSINESS_PHONE_ID: process.env.WA_BUSINESS_PHONE_ID ? '✅ configurado' : '❌ ausente (usa default)',
  PHONE_BRIEFING:       WA_DEST || '❌ ausente',
};
```

- [ ] **3.2 Atualizar mensagem de teste**

Trocar:
```js
'✅ Teste WhatsApp Dashboard OK\n\nIntegração via OpenClaw funcionando.'
```
Por:
```js
'✅ Teste WhatsApp Dashboard OK\n\nIntegração via Meta WA Business API funcionando.'
```

---

## Task 4: Rodar regressao completa

- [ ] **4.1 Rodar todos os testes**

```bash
node --test tests/contract/api-openclaw.test.mjs tests/contract/api-comandos.p0.test.js tests/contract/api-comandos.p1.test.js tests/contract/api-supervisor.security.test.js
```

Esperado: todos passando, zero regressao.

- [ ] **4.2 Verificar git status**

```bash
git status --short
git diff --stat
```

---

## Task 5: Commit e deploy

- [ ] **5.1 Commit**

```bash
git add api/lib/openclaw.js api/whatsapp/test.js tests/contract/api-openclaw.test.mjs
git commit -m "fix(whatsapp): migra envio backend de OpenClaw WS para Meta WA Business API

- substitui implementacao WebSocket (device-bound, incompativel com Vercel)
- usa Meta WA API identica ao api/cron.js
- mantem assinatura sendWhatsApp(to, message) — sem quebra de contratos
- atualiza test.js para reportar WA_BUSINESS_TOKEN
- atualiza testes de contrato para novo protocolo HTTP"
```

- [ ] **5.2 Push e aguardar deploy**

Usar Gage (`*push`) apos commit.

- [ ] **5.3 Validar producao**

```bash
POST /api/whatsapp/test  (com X-Webhook-Token)
```

Esperado: `{ ok: true, result: { id: '...' } }` e mensagem chegando no PHONE_BRIEFING.

---

## Quando parar

Parar apos 5.3 confirmado. Nao abrir nova frente.
Registrar resultado em `docs/AI_SESSION_STATE.md` antes de encerrar.

---

## Fora de escopo

- Suporte a templates de mensagem Meta
- Reativacao do OpenClaw WebSocket
- Configuracao da Evolution API
- Alteracao de api/alerts.js, api/cron.js, dashboard.html
