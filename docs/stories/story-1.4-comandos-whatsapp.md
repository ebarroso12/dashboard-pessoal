# Story 1.4 — Comandos via WhatsApp pelo OpenClaw

**Épico:** EPIC-001 — Central de Comando via Mensagem
**Status:** Ready
**Prioridade:** P1 — Must Have
**Agente:** @dev (Dex)
**Estimativa:** 4–5h
**Dependências:** Stories 1.1 (Gmail) e 1.2 (Drive) implementadas

---

## Objetivo
Permitir que o Dr. Edson envie comandos por WhatsApp e receba respostas do dashboard via OpenClaw.

## Comandos a implementar
| Comando | Resposta |
|---------|----------|
| `emails` ou `email` | Lista os 5 emails não lidos mais recentes |
| `drive` | Lista 5 arquivos recentes do Drive |
| `agenda` | Próximos 5 eventos do Google Calendar |
| `resumo` | Resumo do dia: agenda + emails + tarefas pendentes |
| `metas` | Status das metas financeiras em % |
| `financas` ou `saldo` | Saldo atual e últimas 3 transações |
| `tarefas` | Tarefas pendentes |
| `ajuda` ou `help` | Lista todos os comandos disponíveis |

## Acceptance Criteria
- [ ] Criar `/api/comandos` como Vercel Function
- [ ] OpenClaw webhook aponta para `/api/comandos`
- [ ] Autenticação via token secreto no header (já existe `oc_edson_2026_secure`)
- [ ] Cada comando acessa os dados via APIs Google com o token salvo no Supabase
- [ ] Resposta formatada em texto simples legível no WhatsApp
- [ ] Comandos case-insensitive e com variações (email/emails/e-mail)
- [ ] Resposta de erro amigável para comando não reconhecido

## Arquivos a criar
- `api/comandos.js` — Vercel Function principal
- `api/_lib/command-handlers.js` — lógica de cada comando
- `api/_lib/google-auth.js` — helper para token Google

## Formato de resposta (exemplo "resumo")
```
📋 Resumo do Dia — 23/04/2026

📅 AGENDA (próximos eventos)
• 14:00 - Consulta João Silva
• 16:30 - Reunião equipe

📧 EMAILS NÃO LIDOS (3)
• Dr. Paulo — Resultado exame
• Secretaria — Confirmação consulta  

✅ TAREFAS (2 pendentes)
• Assinar laudo paciente X
• Ligar para convênio

💰 SALDO: R$ 12.450,00
```
