# Known Issues — Dashboard Pessoal

> Última atualização: 2026-05-15

---

## Críticos (bloqueiam uso)

Nenhum crítico ativo. Produto operacional para uso diário.

---

## Médios (degradam experiência)

### META-001: Token Meta expira em 60 minutos
**Impacto:** Usuário precisa clicar "Reconectar Meta" a cada sessão nova no browser.  
**Causa:** OAuth implícito (response_type=token) retorna token de curta duração.  
**Workaround:** Reconectar antes de usar IG/FB. Dados ficam em `--` quando desconectado.  
**Resolução futura:** Migrar para flow server-side com Long-Lived Token.

### ANON-001: SB_ANON residual no frontend
**Impacto:** `sbSyncTarefas()` e `sbSyncMetrica()` ainda usam anon key para escrever em `dados_assistente`.  
**Localização:** `dashboard.html:3774/3787` — `sbUpsert`/`sbInsert` com `SB_ANON`.  
**Risco real:** Baixo para uso pessoal. Não expõe dados sensíveis.  
**Resolução futura:** Criar `/api/tasks/sync` e `/api/metrics/sync` com service_role (padrão do `/api/finance/sync`).

### DB-001: Tabelas legado preservadas mas inativas
**Tabelas:** `financas`, `transacoes`, `lancamentos_financeiros`  
**Impacto:** Zero para o dashboard atual. Cron.js lê de `dados_assistente` agora.  
**Risco:** Confusão futura se alguém examinar o schema.  
**Resolução futura:** Verificar se estão vazias → dropar em próxima janela de manutenção.

---

## Baixos (qualidade/polish)

### MOBILE-001: Validação em dispositivo físico pendente
**Impacto:** CSS e layout testados por análise estática. Screenshots mostraram progresso mas não confirmação 100%.  
**Workaround:** Testar em Chrome DevTools viewport 390px.  
**Status:** Parcialmente validado por screenshots do usuário.

### SUPERVISOR-001: supervisor_logs sem limite garantido
**Impacto:** Tabela cresce indefinidamente se cron não rodar.  
**Causa:** TTL de 30 dias é passivo — depende de chamadas ao endpoint `/api/cron`.  
**Resolução futura:** pg_cron ativo no Supabase OU scheduled function no Vercel.

### AUTH-001: Autenticação de usuário via localStorage
**Impacto:** Qualquer pessoa com acesso ao browser tem acesso total.  
**Contexto:** Dashboard pessoal — risco aceitável.  
**Resolução futura:** Supabase Auth real com email/senha.

### BRIEFING-001: Custo de tokens GPT a cada briefing
**Impacto:** Cada chamada ao `/api/briefing` consome tokens OpenAI.  
**Estimativa:** ~500 tokens/chamada × uso diário = custo baixo mas presente.  
**Workaround:** Cache de 24h implementado via dados_assistente. Reusar se existir briefing recente.

---

## Resolvidos nesta sessão

- ~~Sidebar desktop visível no celular~~ — CSS `!important` mobile
- ~~card-remove-btn sem handler~~ — `initLayoutControls` guard corrigido
- ~~finBackdrop duplicado~~ — IDs renomeados
- ~~Google token na resposta da API~~ — tokens removidos das respostas
- ~~`closeOut()` era no-op~~ — implementado `closeModal(id)`
- ~~Análise IA devolvia agenda do Google~~ — intent detection bypass
- ~~Briefing carregava `/api/morning-briefing` (404)~~ — endpoint criado e corrigido
- ~~Meta OAuth bloqueado após Google OAuth~~ — sessionStorage.oauth_state limpo
- ~~IG/FB/GMB/YT/GA status hardcoded como "live"~~ — mudado para "demo"
- ~~SUPABASE_SERVICE_ROLE_KEY não configurada no Vercel~~ — configurada
- ~~handleFinancas consultava /financas e /transacoes (inexistentes)~~ — migrado para dados_assistente
