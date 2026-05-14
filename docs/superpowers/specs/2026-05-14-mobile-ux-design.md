---
name: mobile-ux-design
description: Mobile responsive UX for dashboard - bottom nav, drawer, light theme
metadata:
  type: project
---

# Mobile UX + Tema Claro - Design Spec

**Data:** 2026-05-14
**Arquivo alvo:** `dashboard.html` (11k linhas, single-file app)
**Escopo:** frontend only, sem backend, sem OAuth/RLS

## Problema

`@media(max-width:800px)` apenas escondia sidebar - sem substituto de navegacao no mobile. Sem acesso ao seletor de tema. Cards nao empilhavam corretamente em todos os breakpoints.

## Solucao implementada

### Layout mobile (<=800px)

- `sidebar { display:none }` - mantido
- `main-content { margin-left:0; padding-bottom:72px }` - espaco para barra inferior
- `#maingrid.grid { grid-template-columns:1fr }` - 1 coluna garantida
- `.grid { grid-template-columns:1fr }` - cobre outros grids

### Barra inferior (#mobile-nav)

`position:fixed; bottom:0; height:60px; z-index:500`

5 botoes: Home | Clinica | Mkt | Infra | Menu

- Min 48px altura de toque
- Chama `showSection()` existente
- "Menu" abre gaveta via `toggleMobileMenu(true)`

### Gaveta lateral (#mobile-drawer)

`position:fixed; left:0; width:280px; z-index:600; transform:translateX(-100%)`

- `.open` class desliza para posicao visivel (`.25s ease`)
- Overlay `#mobile-overlay` (z-index:599) fecha ao toque
- Contem: seletor de tema (3 botoes) + links de nav por secao
- Links chamam `showSection()` + `toggleMobileMenu(false)`

### JS adicionado

```js
function toggleMobileMenu(open) {
  // toggle .open em #mobile-drawer e #mobile-overlay
  // trava scroll do body quando aberto
}
```

Reutiliza `_setTheme()` existente para tema na gaveta.

### Tema Claro (data-theme="claro")

CSS vars sobrescritas em `html[data-theme="claro"]`:

- `--bg:#f0f4f8` / `--card-bg:#ffffff`
- `--text:#1a202c` / `--muted:#64748b`
- `--accent:#2563eb`

Overrides pontuais para `.card`, `.sidebar`, `.sb-link`, `.kpi`, `.mn-btn`, `.t-btn`.

### Desktop

Sem alteracao. Sidebar fixa, grid 3→2→1 col por breakpoints existentes.
Theme-bar da sidebar: 3 botoes agora (Escuro / Claro / Clas.)

## Temas mapeados

| data-theme | CSS | Label |
|---|---|---|
| `classico` | `:root` vars (dark navy) | Escuro |
| `claro` | `html[data-theme="claro"]` | Claro |
| `legendarios` | `html[data-theme="legendarios"]` | Classico |

## Riscos restantes

- Cores hardcoded fora de CSS vars em cards individuais podem nao responder ao tema claro
- FAB overflow sobre card-foot em mobile - verificar em tela real
- Modais existentes: z-index nao foi auditado (gaveta usa 600, overlay 599)
- Tema claro: `_applyLegBg()` vai continuar zerando bg-images fora de `legendarios` - comportamento correto

## Arquivos modificados

- `dashboard.html`: ~200 linhas adicionadas/modificadas
