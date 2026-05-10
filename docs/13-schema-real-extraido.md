# Schema Real Extraído — Supabase

> Documento criado em: 2026-05-10
> Etapa: SP-1.5 — Database Discovery
> Método: inspeção visual do painel Supabase (sem execução de SQL)

---

## Projeto Supabase

| Item | Valor |
|---|---|
| Project ID | `jaewjscbigfwjiaeavft` |
| URL | `https://jaewjscbigfwjiaeavft.supabase.co` |
| Região | (a confirmar) |
| Status | Ativo |

---

## Tabelas Reais Confirmadas (22 tabelas)

```
chat_assistente
comandos
dados_assistente
fin_categorias
fin_orcamento
financas
gmb_reviews
infra_logs
infra_servicos
lancamentos_financeiros
metas
morning_briefing
notas
oauth_tokens
supervisor_logs
tarefas
transacoes
wa_analyses
wa_chats
wa_connections
wa_requests
widget_scripts
```

---

## Domínios Identificados

### 1. WhatsApp / Comunicação
| Tabela | Papel provável |
|---|---|
| `comandos` | Histórico de comandos recebidos via WA/OpenClaw |
| `wa_chats` | Histórico de conversas brutas do WhatsApp |
| `wa_connections` | Estado de conexões WhatsApp ativas |
| `wa_requests` | Log de requisições WA (diagnóstico/debug) |
| `wa_analyses` | Análises de mensagens WA (intenção, sentimento?) |

### 2. IA / Assistente
| Tabela | Papel provável |
|---|---|
| `chat_assistente` | Histórico de perguntas/respostas com o assistente IA |
| `dados_assistente` | Cache jsonb legado (a remover — ver seção legado) |

### 3. Financeiro
| Tabela | Papel provável |
|---|---|
| `lancamentos_financeiros` | Tabela principal de receitas e despesas |
| `financas` | Tabela legada (a migrar e remover) |
| `transacoes` | Tabela legada (a migrar e remover) |
| `fin_categorias` | Categorias financeiras (nome antigo de `categorias_financeiras`) |
| `fin_orcamento` | Orçamentos por categoria (não está no spec atual) |
| `metas` | Metas financeiras e pessoais |

### 4. Produtividade
| Tabela | Papel provável |
|---|---|
| `tarefas` | Lista de tarefas |
| `notas` | Notas rápidas |

### 5. Google Meu Negócio
| Tabela | Papel provável |
|---|---|
| `gmb_reviews` | Avaliações GMB coletadas pelo cron |

### 6. Infraestrutura / Sistema
| Tabela | Papel provável |
|---|---|
| `supervisor_logs` | Logs do agente Supervisor IA |
| `infra_logs` | Logs de infraestrutura (possivelmente duplica `supervisor_logs`) |
| `infra_servicos` | Registro de serviços monitorados (não está no spec) |
| `morning_briefing` | Briefings matinais enviados |

### 7. Autenticação / Integrações
| Tabela | Papel provável |
|---|---|
| `oauth_tokens` | Tokens OAuth (Google, TikTok, etc.) |

### 8. UI / Frontend
| Tabela | Papel provável |
|---|---|
| `widget_scripts` | Scripts ou configurações de widgets do dashboard |

---

## Comparação: Real vs. Planejado

> Referências: `docs/10-inventario-tecnico-atual.md` e `docs/superpowers/specs/2026-05-10-segundo-eu-design.md` (seções 4 e 12)
> (docs/11 e docs/12 como arquivos separados ainda não existem)

### Tabelas do Plano B que JÁ EXISTEM no Supabase

| Tabela planejada | Tabela real | Status |
|---|---|---|
| `chat_assistente` | `chat_assistente` | ✅ Coincide |
| `comandos` | `comandos` | ✅ Coincide |
| `lancamentos_financeiros` | `lancamentos_financeiros` | ✅ Coincide |
| `metas` | `metas` | ✅ Coincide |
| `morning_briefing` | `morning_briefing` | ✅ Coincide |
| `notas` | `notas` | ✅ Coincide |
| `oauth_tokens` | `oauth_tokens` | ✅ Coincide |
| `supervisor_logs` | `supervisor_logs` | ✅ Coincide |
| `tarefas` | `tarefas` | ✅ Coincide |
| `gmb_reviews` | `gmb_reviews` | ✅ Coincide |
| `categorias_financeiras` | `fin_categorias` | ⚠️ Nome diferente |

### Tabelas do Plano B que AINDA NÃO EXISTEM

| Tabela planejada | Status |
|---|---|
| `perfil` | ❌ Ausente |
| `pessoas` | ❌ Ausente |
| `memorias_ia` | ❌ Ausente |
| `documentos` | ❌ Ausente |
| `exames` | ❌ Ausente |
| `consultas` | ❌ Ausente |
| `medicamentos` | ❌ Ausente |
| `habitos` | ❌ Ausente |
| `habitos_registro` | ❌ Ausente |
| `metricas_sociais` | ❌ Ausente |
| `dashboard_alerts` | ❌ Ausente |

### Tabelas reais SEM equivalente no Plano B (desconhecidas/legadas)

| Tabela real | Classificação | Notas |
|---|---|---|
| `dados_assistente` | Legado confirmado | Spec diz: eliminar após migração para tabelas tipadas |
| `financas` | Legado confirmado | Spec diz: migrar para `lancamentos_financeiros` e DROP |
| `transacoes` | Legado confirmado | Spec diz: migrar para `lancamentos_financeiros` e DROP |
| `fin_categorias` | Legado — renomear | Pode ser a `categorias_financeiras` do spec com nome antigo |
| `fin_orcamento` | Não documentado | Pode ter dados válidos — investigar antes de qualquer ação |
| `infra_logs` | Não documentado | Possível duplicata de `supervisor_logs` — investigar |
| `infra_servicos` | Não documentado | Pode ser monitoramento de uptime — investigar |
| `wa_chats` | Não documentado | Pode duplicar `chat_assistente` ou ser complementar |
| `wa_connections` | Não documentado | Estado de conexões WA (talvez do OpenClaw) |
| `wa_requests` | Não documentado | Log de requisições WA — pode ser debug |
| `wa_analyses` | Não documentado | Análises de mensagens WA — pode ter valor |
| `widget_scripts` | Não documentado | Configuração de widgets no dashboard |

---

## Tabelas Críticas (não tocar sem análise)

| Tabela | Por que é crítica |
|---|---|
| `oauth_tokens` | Contém tokens Google ativos — perder quebra todas as integrações Google |
| `lancamentos_financeiros` | Dados financeiros primários do sistema |
| `comandos` | Histórico de comandos WA — usado pelo dashboard em tempo real |
| `chat_assistente` | Histórico de conversas com IA — memória de uso |
| `gmb_reviews` | Reviews coletadas automaticamente — perder perde histórico |
| `morning_briefing` | Histórico de briefings enviados |
| `wa_chats` | Pode conter histórico de conversas WA não replicado em outro lugar |
| `fin_orcamento` | Pode ter dados de orçamento ativos |

---

## Tabelas Legadas Prováveis

Baseado no spec `docs/superpowers/specs/2026-05-10-segundo-eu-design.md` seção 4.10:

| Tabela | Risco de remover | Ação recomendada |
|---|---|---|
| `dados_assistente` | Baixo (cache jsonb) | Verificar se código ativo ainda lê → depois DROP |
| `financas` | Médio | Verificar se tem dados únicos não em `lancamentos_financeiros` → migrar → DROP |
| `transacoes` | Médio | Idem `financas` |
| `fin_categorias` | Baixo | Verificar dados → renomear para `categorias_financeiras` ou criar nova e migrar |

---

## Riscos de Migração

### Risco 1 — Duplicação financeira (MÉDIO)
`financas`, `transacoes` e `lancamentos_financeiros` podem conter dados sobrepostos ou complementares.
Remover qualquer uma sem verificar pode causar perda de histórico financeiro.

### Risco 2 — Duplicação WA (MÉDIO)
`wa_chats` e `chat_assistente` podem registrar o mesmo histórico de fontes diferentes.
Entender qual é usada pelo código antes de qualquer DROP.

### Risco 3 — Dependência de código ativo em tabelas legadas (ALTO)
`api/assistente.js` ainda lê `dados_assistente` (confirmado no spec).
`api/cron.js` pode ainda ler `financas` ou `transacoes`.
Remover sem atualizar o código quebra produção silenciosamente.

### Risco 4 — Renomeação de fin_categorias (BAIXO)
Se `fin_categorias` tem dados de seed, criar `categorias_financeiras` sem migrar os dados
faz o código novo não encontrar categorias.

### Risco 5 — Tabelas sem documentação (BAIXO-MÉDIO)
`infra_logs`, `infra_servicos`, `wa_analyses`, `wa_connections`, `wa_requests`, `widget_scripts`
não estão no spec. Podem estar em uso por código não mapeado (n8n, OpenClaw, scripts externos).

---

## Próxima Ação Segura

**Inspecionar estrutura de colunas** das tabelas desconhecidas e legadas antes de qualquer ação.

Prioridade de inspeção (leitura apenas, sem SQL de escrita):

1. `dados_assistente` — confirmar se código ainda acessa e quais campos existem
2. `financas` + `transacoes` — verificar se têm dados que `lancamentos_financeiros` não tem
3. `fin_categorias` + `fin_orcamento` — entender estrutura para o SP-6 (financeiro)
4. `wa_chats` + `wa_analyses` — entender relação com `chat_assistente` e `comandos`
5. `infra_logs` + `infra_servicos` — verificar se são sistema de monitoramento externo
6. `widget_scripts` — verificar se o dashboard.html lê esta tabela

**Regra:** nenhuma tabela deve ser removida ou alterada até que:
- Sua estrutura real de colunas seja conhecida
- O código que a lê/escreve seja identificado
- Os dados sejam avaliados para migração ou descarte

---

## Resumo de Contagem

| Categoria | Qtd |
|---|---|
| Total de tabelas reais | 22 |
| Coincidentes com Plano B | 10 |
| Nome diferente (mesmo conceito) | 1 |
| Ausentes do Plano B (a criar) | 11 |
| Legadas confirmadas (spec) | 4 |
| Não documentadas (investigar) | 7 |
