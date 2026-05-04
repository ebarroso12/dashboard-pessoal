# Story 1.2 — Widget Google Drive no Dashboard

**Épico:** EPIC-001 — Central de Comando via Mensagem
**Status:** Ready
**Prioridade:** P1 — Must Have
**Agente:** @dev (Dex)
**Estimativa:** 2–3h

---

## Objetivo
Exibir arquivos recentes do Google Drive no dashboard com acesso rápido.

## Acceptance Criteria
- [ ] Card Google Drive na grid com ícone e contador de arquivos
- [ ] Lista 10 arquivos mais recentes: ícone por tipo, nome, data de modificação
- [ ] Clique no arquivo abre direto no Google Drive/Docs/Sheets
- [ ] Filtro por tipo: Todos / Docs / Sheets / Slides / PDF
- [ ] Auto-refresh a cada 10 minutos
- [ ] Estado de loading com skeleton
- [ ] Usa token Google OAuth já existente

## Contexto Técnico
- Endpoint Drive: `https://www.googleapis.com/drive/v3/files`
- Params: `orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink)`
- Scopes: `drive.readonly`
- Criar função `loadDriveWidget()` e card HTML com id `widget-drive`
- Ícones por mimeType: doc=📄, sheet=📊, slide=📽️, pdf=📕, pasta=📁, outro=📎

## Arquivos a modificar
- `dashboard.html` — adicionar widget HTML + CSS + JS
