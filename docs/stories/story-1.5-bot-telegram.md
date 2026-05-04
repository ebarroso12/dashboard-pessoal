# Story 1.5 — Bot Telegram

**Épico:** EPIC-001 — Central de Comando via Mensagem
**Status:** Ready
**Prioridade:** P2 — Should Have
**Agente:** @dev (Dex)
**Estimativa:** 3–4h
**Dependência:** Story 1.4 (command-handlers.js pronto)

---

## Objetivo
Criar bot Telegram que usa os mesmos command-handlers do WhatsApp, com botões inline e notificações automáticas.

## Pré-requisito Manual (usuário faz uma vez)
1. Abrir @BotFather no Telegram
2. Enviar `/newbot` → nome: "Dashboard Dr Edson" → username: EdsonDashBot
3. Copiar o token gerado
4. Adicionar TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no Vercel Environment Variables
5. Pegar seu Chat ID: abrir @userinfobot e enviar qualquer mensagem

## Acceptance Criteria
- [ ] Criar `/api/telegram/webhook` como Vercel Function
- [ ] Registrar webhook: `POST https://api.telegram.org/bot{TOKEN}/setWebhook`
- [ ] Mesmos comandos do WhatsApp funcionando
- [ ] Menu `/start` com botões inline: Agenda | Emails | Drive | Resumo | Finanças
- [ ] Notificações automáticas:
  - Email novo → avisa no Telegram em até 5 min (via cron n8n)
  - Evento em 30min → lembrete automático
- [ ] Apenas o TELEGRAM_CHAT_ID do Dr. Edson pode usar o bot (segurança)

## Arquivos a criar
- `api/telegram/webhook.js` — recebe mensagens do Telegram
- `api/telegram/notify.js` — envia notificações (chamado pelo n8n)
- Reutiliza `api/_lib/command-handlers.js` da Story 1.4

## Configurar no vercel.json
```json
{ "source": "/api/telegram/webhook", "destination": "/api/telegram/webhook" },
{ "source": "/api/telegram/notify",  "destination": "/api/telegram/notify" }
```
