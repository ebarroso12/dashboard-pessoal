# Checkpoint: Security Hardening — WhatsApp / Proxy / Tokens

> Data: 2026-05-13
> Status: concluido
> Proximo foco: auditoria Supervisor IA

---

## O que foi feito

### Meta WA API operacional

- `api/lib/openclaw.js` reescrito para usar Meta Business API (`graph.facebook.com/v19.0`)
- OpenClaw WebSocket removido da automacao backend
- Commit: `85624f8 feat(openclaw): substitui WebSocket OpenClaw por Meta WA Business API`

### Token publico removido do frontend

- `oc_edson_2026_secure` removido de 8 locais em `dashboard.html`
- Contador fake, cards estaticos e catch silencioso tambem corrigidos no widget WhatsApp
- Commit: `46b478b fix(widget): remove estado falso e token publico do WhatsApp`

### dashboard-proxy implementado

- `api/dashboard-proxy.js`: endpoint proxy com whitelist de 3 actions
- Frontend chama `/api/dashboard-proxy` sem token; proxy injeta `WEBHOOK_TOKEN` via env
- CORS restrito a `https://dashboard-pessoal-edson.vercel.app`
- Campos extras de payload sao descartados antes de repassar ao target
- 5 call sites em `dashboard.html` atualizados (assistente, supervisor, IA widgets)

### Fallbacks comprometidos removidos de todos os backends

- `api/assistente.js`, `api/supervisor.js`, `api/webhook.js`, `api/ask.js`, `api/comandos.js`
- Padrao aplicado: leitura de `WEBHOOK_TOKEN` no request-time, fail-fast com 500 se ausente
- Commit: `e8d1f1b fix(security): remove webhook token fallbacks`

---

## Estado dos testes

- 79 testes passando, 0 falhas
- Suites: comandos P0, comandos P1, comandos security, supervisor security,
  openclaw Meta WA, dashboard-proxy, dashboard widget OpenClaw

---

## Commits principais desta fase

| Hash | Descricao |
|---|---|
| `85624f8` | feat(openclaw): substitui WebSocket OpenClaw por Meta WA Business API |
| `46b478b` | fix(widget): remove estado falso e token publico do WhatsApp |
| `a02c356` | feat(proxy): dashboard-proxy com whitelist e CORS restrito |
| `5ba439a` | feat(frontend): dashboard chama proxy seguro em vez de APIs autenticadas diretamente |
| `707455f` | fix(security): remove fallback de token comprometido (comandos.js) |
| `e8d1f1b` | fix(security): remove webhook token fallbacks (4 APIs restantes) |

---

## Riscos residuais conhecidos

1. Comentarios JSDoc em `assistente.js`, `supervisor.js`, `comandos.js` ainda referenciam
   `oc_edson_2026_secure` como exemplo — nao executavel, baixa prioridade
2. `WEBHOOK_TOKEN` deve ser rotacionado no Vercel (o valor antigo estava comprometido)
   e atualizado nos 6 pontos JS do `dashboard.html` que agora enviam string vazia
3. CORS no proxy nao autentica chamador — apenas restringe origem
   Risco classificado como baixo para dashboard pessoal

---

## Proximo foco

Auditoria funcional do widget Supervisor IA:
- Verificar tabela `supervisor_logs` no Supabase
- Testar loop do agente Claude com ANTHROPIC_API_KEY configurado
- Confirmar que `scrubSecrets` nao corrompe dados legitimos
- Validar que `svInit` (supervisor-status) funciona via proxy
