# Dashboard Pessoal — Estado do Produto

> Checkpoint: 2026-05-15 | Versão operacional estável

## Produto

Dashboard pessoal do Dr. Edson Barroso, médico psiquiatra. Uso individual diário. Deployed em Vercel + Supabase. Sem usuários externos.

**URL:** https://dashboard-pessoal-edson.vercel.app  
**Repo:** https://github.com/ebarroso12/dashboard-pessoal  
**Supabase:** jaewjscbigfwjiaeavft

---

## Funcionalidades Prontas

### Integrações Reais
- **Google OAuth** — PKCE server-side. Gmail, Drive, Calendar carregam dados reais. Token refresh automático. refresh_token persistido no Supabase com service_role.
- **Meta OAuth** — Implicit flow. Instagram e Facebook conectados. Token dura 60 min (limitação do flow implícito).
- **WhatsApp Business** — Meta API operacional. Envio de mensagens funcionando.
- **OCR Nota Fiscal** — GPT-4.1-mini lê foto de nota fiscal, extrai itens/valores/categorias compatíveis com FIN_CATS.

### IA Operacional
- **Supervisor IA v2** — GPT-4.1-mini. Fluxo SCAN→DIAGNÓSTICO→REPARO→VALIDAÇÃO→RELATÓRIO. Classifica severidade (CRÍTICO/MÉDIO/AVISO/INFORMATIVO). Exporta relatório em .txt.
- **Briefing Executivo** — `/api/briefing` POST. Agrega calendário, tarefas, financeiro, alertas. GPT-4.1-mini gera sumário executivo diário. Fallback sem IA.
- **Assistente de Voz** — Comandos curtos (agenda, tarefas, financeiro). Intent detection local. Long-prompt bypass via GPT-4.1-mini.
- **Análise de Widgets** — Botões "Analisar IA" em IG/FB/GMB/YT/GA usam GPT-4.1-mini.

### Financeiro
- Modal completo com abas: Orçamento, Lançamentos, Patrimônio, Comparativo, Insights IA, Pagamentos, Recebimentos.
- Foto de nota → OCR → categorias corretas → salvar automaticamente.
- Sync com Supabase via `/api/finance/sync` (service_role, não anon).
- Briefing matinal lê dados financeiros sincronizados.

### Backup e Recuperação
- Export manual: JSON com tarefas, notas, metas, contatos, financeiro (6 meses), layout, tema.
- Import manual: validação de formato + confirmação antes de sobrescrever.
- Auto-backup diário silencioso (localStorage, 7 snapshots retidos).

### Mobile/PWA
- Bottom navigation bar (Home, Clínica, Mkt, Infra, Menu).
- Drawer lateral com navegação completa e seletor de temas.
- CSS mobile: sidebar oculta, cards 1 coluna, overflow-x bloqueado, `[style*="grid-column"]` resetado.
- PWA: manifest.json, sw.js, icon-192.png, icon-512.png, apple-touch-icon.
- Chrome Android oferece "Adicionar à tela inicial".

### UX
- Botões X e resize dos widgets funcionam (fix do `initLayoutControls`).
- Modais abrem/fecham corretamente.
- Temas: Escuro (padrão), Claro, Fire (Legendários).
- Tema persiste via localStorage.

### Segurança
- `oauth_tokens` protegido com RLS — só service_role pode ler/escrever.
- Google OAuth tokens nunca expostos ao browser.
- Meta OAuth tokens no localStorage (limitação do flow implícito).
- `SUPABASE_SERVICE_ROLE_KEY` como env var no Vercel.
- `/api/token/status` e `/api/token/save` usam service_role.
- Financeiro sync via endpoint backend (service_role).

---

## Banco de Dados — Estado Atual

**13 tabelas ativas:**
`oauth_tokens` · `dados_assistente` · `tarefas` · `metas` · `notas` · `comandos` · `chat_assistente` · `dashboard_alerts` · `supervisor_logs` · `morning_briefing` · `gmb_reviews` · `lancamentos_financeiros` · `financas` · `transacoes`

**9 tabelas dropadas (mortas):**
`fin_categorias` · `fin_orcamento` · `infra_logs` · `infra_servicos` · `wa_analyses` · `wa_chats` · `wa_connections` · `wa_requests` · `widget_scripts`

**Migration:** `supabase/migrations/2026-05-15-drop-dead-tables.sql`

---

## Testes

- **300 testes** passando (node --test)
- Cobertura: APIs, segurança, mobile, PWA, financeiro, backup, briefing, supervisor, contratos de endpoint
- Framework: Node.js built-in test runner (`node:test`)
- Path: `tests/contract/*.js` e `tests/contract/*.mjs`

---

## Riscos Residuais

Ver `KNOWN_ISSUES.md` para lista completa.

---

## Últimos Commits Significativos

| Hash | Descrição |
|------|-----------|
| cd86027 | fix(briefing): replace broken morning widget with executive briefing |
| 1399561 | feat(ai): add executive operational briefing system |
| e178699 | feat(supervisor): upgrade operational ai supervisor with gpt-4.1-mini |
| afd9926 | feat(backup): add personal backup and restore system |
| 404b954 | feat(ux): finalize desktop mobile pwa experience |
| 55de737 | fix(finance): connect OCR, sync and assistant flow |
| 14e7f4a | fix(ai): migrate all AI calls from Anthropic to OpenAI gpt-4.1-mini |
| 4d11419 | fix(ux): restore widget controls and modal reliability |
