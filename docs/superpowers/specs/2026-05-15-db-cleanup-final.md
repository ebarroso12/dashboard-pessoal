# DB Cleanup — Checkpoint 2026-05-15

## SQL aplicado

```sql
DROP TABLE IF EXISTS fin_categorias, fin_orcamento, infra_logs, infra_servicos,
  wa_analyses, wa_chats, wa_connections, wa_requests, widget_scripts;
```

**Resultado Supabase:** `Success. No rows returned.`

## Tabelas removidas (9)

| Tabela | Motivo |
|---|---|
| fin_categorias | Zero referências no código |
| fin_orcamento | Zero referências no código |
| infra_logs | Zero referências no código |
| infra_servicos | Zero referências no código |
| wa_analyses | WhatsApp integração antiga, abandonada |
| wa_chats | Idem |
| wa_connections | Idem |
| wa_requests | Idem |
| widget_scripts | Antiga referência de health check removida |

## Tabelas preservadas (intactas)

`oauth_tokens` · `dados_assistente` · `tarefas` · `metas` · `notas`
`comandos` · `chat_assistente` · `dashboard_alerts` · `supervisor_logs`
`morning_briefing` · `gmb_reviews`

## Tabelas legado preservadas por segurança

`financas` · `transacoes` · `lancamentos_financeiros`
Motivo: existem dados históricos potenciais. Não são usadas pelo dashboard atual.
Ação futura: verificar se estão vazias e remover em próxima janela de manutenção.

## Riscos residuais

- **dados_assistente genérica**: armazena financeiro + tarefas + métricas + histórico num campo `tipo` livre. Sem índice explícito, sem TTL geral. Risco de crescimento desordenado a longo prazo.
- **SB_ANON residual**: `sbSyncTarefas` e `sbSyncMetrica` em `dashboard.html` ainda usam anon key para escrever em `dados_assistente`. Não é risco imediato (uso pessoal), mas viola o padrão service_role adotado para o financeiro.
- **supervisor_logs**: TTL de 30 dias adicionado via cron passivo — efetivo apenas quando o cron roda. Sem pg_cron ativo, limpeza depende de chamadas manuais ao endpoint.
- **Meta token**: dura 60 minutos. Reconexão manual necessária a cada sessão nova no browser.

## Recomendação

Usar o dashboard em produção por pelo menos 2 semanas antes de qualquer nova mudança estrutural no banco. Observar logs, briefings matinais e comportamento do assistente de voz para confirmar estabilidade.
