# Story 1.3 — Widget Microsoft OneDrive

**Épico:** EPIC-001 — Central de Comando via Mensagem
**Status:** Ready
**Prioridade:** P2 — Should Have
**Agente:** @dev (Dex)
**Estimativa:** 4–5h
**Dependência:** Azure App Registration (pré-requisito manual)

---

## Objetivo
Exibir arquivos recentes do OneDrive no dashboard via Microsoft Graph API.

## Pré-requisito Manual (usuário faz uma vez)
1. Acessar portal.azure.com → App registrations → New registration
2. Nome: "Dashboard Edson", Redirect URI: `https://dashboard-pessoal-edson.vercel.app/dashboard.html`
3. Copiar Client ID e criar Client Secret
4. Adicionar permissões: Files.Read, User.Read
5. Adicionar MICROSOFT_CLIENT_ID e MICROSOFT_CLIENT_SECRET no Vercel Environment Variables

## Acceptance Criteria
- [ ] Botão "Conectar OneDrive" se não autenticado
- [ ] OAuth Microsoft com PKCE (igual ao Google já existente)
- [ ] Criar `/api/onedrive/files` como Vercel Function (proxy seguro)
- [ ] Card mostra 10 arquivos recentes com nome, tipo e data
- [ ] Clique abre arquivo no OneDrive
- [ ] Token salvo em localStorage com refresh automático

## Arquivos a criar/modificar
- `api/onedrive/files.js` — Vercel Function proxy
- `api/onedrive/token.js` — exchange code → token
- `dashboard.html` — widget HTML + CSS + JS + OAuth flow
