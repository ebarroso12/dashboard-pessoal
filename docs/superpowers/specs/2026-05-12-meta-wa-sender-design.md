# Migração OpenClaw → Meta WA Business API — Design

> Data: 2026-05-12
> Decisão: abandonar integração backend via OpenClaw WebSocket
> Substituto: Meta WhatsApp Business API (ja usada por api/cron.js)
> Restricoes: sem alteracao de contratos externos, sem novo deploy de infra

---

## 1. Contexto e motivacao

`api/lib/openclaw.js` implementa envio via OpenClaw WebSocket. A integracao falha
por requerer device identity vinculado ao browser — incompativel com funcoes
serverless stateless do Vercel. Evolution API nao tem DNS publico acessivel pelo Vercel.

A Meta WA Business API ja e usada com sucesso por `api/cron.js` (morning briefing,
reviews, weekly). Usa HTTP simples, token ja configurado em Vercel, zero nova
infraestrutura.

---

## 2. Decisao arquitetural

| Aspecto | Atual | Novo |
|---------|-------|------|
| Protocolo | WebSocket (OpenClaw) | HTTP (Meta WA API) |
| Env var principal | `OPENCLAW_TOKEN` | `WA_BUSINESS_TOKEN` |
| Infra | VPS EasyPanel (OpenClaw) | `graph.facebook.com` |
| Acessivel do Vercel | Nao (device-bound) | Sim (HTTP publico) |
| Ja em uso | Nao (nunca funcionou) | Sim (cron.js) |

**OpenClaw permanece como interface humana/painel.** A mudanca e apenas na camada
de envio backend (server-to-server).

---

## 3. Interface publica — sem alteracao

A interface exportada por `api/lib/openclaw.js` permanece identica:

```js
export async function sendWhatsApp(to, message, timeoutMs)
```

Todos os consumidores (`api/alerts.js`, `api/whatsapp/test.js`) continuam sem
alteracao. A mudanca e interna ao modulo.

---

## 4. Implementacao interna nova

Substituir o corpo de `sendWhatsApp` por chamada HTTP Meta WA:

```js
// Env vars (mesmas do cron.js)
const WA_TOKEN = process.env.WA_BUSINESS_TOKEN    || '';
const WA_PHONE = process.env.WA_BUSINESS_PHONE_ID || '607518142444507';

export async function sendWhatsApp(to, message) {
  if (!WA_TOKEN) throw new Error('WA_BUSINESS_TOKEN nao configurado');
  const number = String(to).replace(/\D/g, '');
  const r = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: number,
      type: 'text',
      text: { body: message },
    }),
  });
  const d = await r.json();
  if (!d.messages?.[0]?.id) throw new Error(`Meta WA falhou: ${JSON.stringify(d.error || d)}`);
  return { id: d.messages[0].id };
}
```

---

## 5. Arquivos afetados

| Arquivo | Tipo de mudanca |
|---------|----------------|
| `api/lib/openclaw.js` | Reescrever corpo de `sendWhatsApp` — mesma assinatura |
| `api/whatsapp/test.js` | Atualizar `envCheck` para mostrar `WA_BUSINESS_TOKEN` em vez de `OPENCLAW_TOKEN` |
| `tests/contract/api-openclaw.test.mjs` | Atualizar assercoes para novo protocolo (sem WebSocket, sem scopes) |

Nao alterar:
- `api/alerts.js` — contrato preservado
- `api/cron.js` — ja usa Meta WA, nao toca
- `dashboard.html` — sem alteracao
- Banco Supabase — sem alteracao

---

## 6. Env vars

| Var | Status | Fonte |
|-----|--------|-------|
| `WA_BUSINESS_TOKEN` | Configurada no Vercel | Ja usada por cron.js |
| `WA_BUSINESS_PHONE_ID` | Configurada (default: 607518142444507) | Ja usada por cron.js |
| `PHONE_BRIEFING` | Configurada | Numero destino |
| `OPENCLAW_TOKEN` | Pode ser removida no futuro | Nao mais usada apos migracao |

---

## 7. Fallback e logging

- Se `WA_BUSINESS_TOKEN` ausente: lanca erro imediato (fail-fast)
- Se Meta API retorna erro: lanca com mensagem do `d.error`
- `api/alerts.js` ja tem try/catch e retorna `false` em falha — sem alteracao necessaria
- `api/whatsapp/test.js` ja tem try/catch — sem alteracao necessaria

---

## 8. Estrategia de teste

### Teste de contrato (sem rede real)
Atualizar `tests/contract/api-openclaw.test.mjs`:
- Verificar que o modulo exporta `sendWhatsApp`
- Verificar que nao importa `ws` (sem WebSocket)
- Verificar que usa `WA_BUSINESS_TOKEN`, nao `OPENCLAW_TOKEN`
- Verificar que usa `graph.facebook.com` como endpoint

### Teste de integracao (com rede)
Apos deploy: `POST /api/whatsapp/test` com token valido.
Sucesso = mensagem chegando no numero `PHONE_BRIEFING`.

---

## 9. Riscos

| Risco | Probabilidade | Mitigacao |
|-------|--------------|-----------|
| `WA_BUSINESS_TOKEN` expirado | Medio | Verificar validade antes de deploy |
| Rate limit Meta API | Baixo | Alertas ja tem cooldown de 30min |
| Numero formatado errado | Baixo | `replace(/\D/g,'')` ja usado por cron.js |
| `PHONE_BRIEFING` ausente | Baixo | Fail-fast em `api/alerts.js` (ja implementado) |

---

## 10. Fora de escopo

- Suporte a multiplos destinatarios
- Templates de mensagem (usar texto simples como hoje)
- Suporte a midia/audio
- Reativacao do OpenClaw WebSocket
- Configuracao da Evolution API
