# Story 1.1 — Widget Gmail no Dashboard

**Épico:** EPIC-001 — Central de Comando via Mensagem
**Status:** Ready
**Prioridade:** P1 — Must Have
**Agente:** @dev (Dex)
**Estimativa:** 3–4h

---

## Objetivo
Adicionar widget Gmail ao dashboard mostrando emails não lidos, com atualização automática.

## Acceptance Criteria
- [ ] Card Gmail na grid do dashboard com ícone e badge de não lidos
- [ ] Lista os 10 emails mais recentes não lidos: remetente, assunto, hora
- [ ] Botão "Marcar como lido" em cada email
- [ ] Botão "Abrir no Gmail" que abre o email direto
- [ ] Auto-refresh a cada 5 minutos
- [ ] Estado de loading com skeleton
- [ ] Fallback de erro com mensagem amigável
- [ ] Usa o token Google OAuth já existente no dashboard (window.GOOGLE_TOKEN)

## Contexto Técnico
- Token Google já disponível em: `localStorage.getItem('google_tokens')` 
- Endpoint Gmail: `https://gmail.googleapis.com/gmail/v1/users/me/messages`
- Scopes necessários: `gmail.readonly`, `gmail.modify`
- Adicionar o scope `gmail.readonly` na lista existente em `SCOPES` do dashboard.html
- Criar função `loadGmailWidget()` e card HTML com id `widget-gmail`
- Inserir na grid após o widget de Calendar

## Arquivos a modificar
- `dashboard.html` — adicionar widget HTML + CSS + JS
