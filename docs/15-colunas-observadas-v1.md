# Colunas Observadas v1 — Tabelas Críticas

> Criado em: 2026-05-10
> Etapa: SP-1.5 — Database Discovery (continuação)
> Fonte: inspeção do código-fonte dos arquivos `api/*.js` + spec `docs/superpowers/specs/2026-05-10-segundo-eu-design.md`
> Nota: MCP Supabase retornou erro de permissão (sem acesso via API de management).
> Schema inferido exclusivamente via queries e referências de campo no código.

---

## Legenda de tipos inferidos

| Símbolo | Significado |
|---|---|
| `text` | string |
| `numeric` | número decimal |
| `boolean` | true/false |
| `timestamptz` | timestamp com timezone |
| `jsonb` | objeto/array JSON |
| `bigserial` | inteiro auto-incremento |
| `date` | data sem hora |
| ⚠️ | campo suspeito / discrepância entre arquivos |
| 🔒 | campo sensível |
| 📦 | campo JSON complexo |

---

## 1. `dados_assistente`

### Colunas visíveis (inferidas do código)

| Coluna | Tipo inferido | Fonte |
|---|---|---|
| `tipo` | `text` (PK ou UNIQUE) | `assistente.js:178`, `assistente.js:125` |
| `dados` | `jsonb` | `assistente.js:126` |
| `atualizado_em` | `timestamptz` | `assistente.js:130` |

### Campos sensíveis
Nenhum campo diretamente sensível — mas `dados` pode conter dados financeiros pessoais em jsonb.

### Campos JSON
`dados` — campo central da tabela, com **estrutura variável por tipo**:

| `tipo` | Estrutura do `dados` |
|---|---|
| `financeiro` | `{ renda, despesas, lancamentos:[{tipo,valor,desc,ts}], mes, patrimonio }` |
| `instagram` | `{ usuario, seguidores, seguindo, posts, alcance, impressoes }` |
| `facebook` | `{ pagina, seguidores, curtidas, alcance }` |
| `youtube` | `{ canal, inscritos, views, assistido_min }` |
| `analytics` | `{ usuarios, sessoes, bounce }` |
| `calendario` | `{ hoje:[{hora, titulo}] }` |
| `acoes_pendentes` | `{ lista:[{acao, titulo, hora, ts}] }` |

### Riscos
- **ALTO**: Esta tabela é um anti-padrão — funciona como um key-value store jsonb sem tipagem, dificultando queries, validações e migrações.
- Qualquer campo financeiro salvo aqui (`renda`, `despesas`) pode estar **desatualizado** em relação a `lancamentos_financeiros`.

### Divergências com o Plano B
- O Plano B (seção 4.10 do spec) determina: `DROP TABLE dados_assistente` após migrar para tabelas tipadas.
- Enquanto não migrada, `api/assistente.js` ainda depende fortemente desta tabela (leitura e escrita de financeiro, redes sociais, calendário, ações pendentes).

### ⚠️ Inconsistência interna no código
`cron.js` acessa `dados_assistente?select=*&limit=1` e lê campos **planos** como `m.ig_seguidores`, `m.fb_curtidas`, `m.tt_seguidores`, `m.yt_inscritos`.
`assistente.js` acessa `dados_assistente?tipo=eq.instagram` e lê campos **dentro do jsonb** `dados.seguidores`.

Duas leituras, dois esquemas. Uma delas está quebrada ou aponta para uma linha diferente.

### A definir
- Qual é o PK real? (`tipo` como text ou há um `id serial`?)
- A linha lida pelo `cron.js` com `limit=1` — é a mesma base do `assistente.js`?
- Há dados financeiros relevantes aqui não presentes em `lancamentos_financeiros`?

---

## 2. `oauth_tokens`

### Colunas visíveis (inferidas do código)

| Coluna | Tipo inferido | Fonte |
|---|---|---|
| `servico` | `text` (UNIQUE) | `supervisor.js:55`, `assistente.js:205` |
| `access_token` | `text` | `supervisor.js:55`, `cron.js` |
| `refresh_token` | `text` | `supervisor.js:55`, `comandos.js:55` |
| `expires_at` | `timestamptz` | spec seção 4.8 |
| `scopes` | `text[]` | spec seção 4.8 |
| `atualizado_em` | `timestamptz` | spec seção 4.8 |

### Campos sensíveis
🔒 `access_token` — token de acesso Google, expira em ~1 hora. Se vazado, dá acesso ao Gmail, Calendar, Drive do Dr. Edson.
🔒 `refresh_token` — token de renovação Google. Se vazado, acesso permanente à conta Google até ser revogado manualmente.

### Campos JSON
Nenhum.

### Riscos
- **CRÍTICO**: Esta tabela está sem RLS (Row Level Security) documentado. A `SUPABASE_ANON_KEY` tem acesso de leitura e escrita.
- Qualquer requisição à Vercel com a `SUPABASE_ANON_KEY` pode ler os tokens diretamente via REST API do Supabase.
- Se a `SUPABASE_ANON_KEY` for comprometida, os tokens OAuth também estarão.

### Divergências com o Plano B
Coincide com o spec — esta tabela é mantida no Plano B sem alteração estrutural.

### A definir
- RLS está ativado nesta tabela? (não verificável sem acesso ao painel)
- Os campos `expires_at` e `scopes` realmente existem ou são apenas planejados no spec?

---

## 3. `tarefas`

### Colunas visíveis (inferidas do código)

| Coluna | Tipo inferido | Fonte | Conflito |
|---|---|---|---|
| `id` | `bigserial` | spec | — |
| `texto` | `text` | `assistente.js`, `cron.js`, `comandos.js` | — |
| `concluida` | `boolean` | `assistente.js:`, `cron.js` | ⚠️ vs `done` em `comandos.js` |
| `done` | `boolean`? | `comandos.js:164` | ⚠️ vs `concluida` |
| `criado_em` | `timestamptz` | `assistente.js`, `cron.js` | ⚠️ vs `created_at` |
| `created_at` | `timestamptz`? | `comandos.js:161` | ⚠️ vs `criado_em` |
| `descricao` | `text` | `cron.js:32` (`t.descricao`) | — |
| `prioridade` | `text` | spec seção 4.7 | — |
| `prazo` | `date` | spec seção 4.7 | — |
| `concluida_em` | `timestamptz` | spec seção 4.7 | — |

### Campos sensíveis
Nenhum.

### Campos JSON
Nenhum.

### Riscos
- **ALTO**: `comandos.js` lê `done` e `created_at`; `assistente.js` e `cron.js` leem `concluida` e `criado_em`. Se a tabela real só tem um dos dois conjuntos, metade do código está silenciosamente retornando `undefined`.

### Divergências com o Plano B
O spec define: `concluida boolean`, `criado_em timestamptz`. O `comandos.js` usa `done` e `created_at`, que parece ser código legado escrito antes do schema ser padronizado.

### A definir
- A tabela real tem `concluida` ou `done` (ou ambos)?
- A tabela real tem `criado_em` ou `created_at` (ou ambos)?
- Existe `descricao` na tabela real ou só no spec?

---

## 4. `metas`

### Colunas visíveis (inferidas do código)

| Coluna | Tipo inferido | Fonte | Conflito |
|---|---|---|---|
| `nome` | `text` | `cron.js`, `ask.js`, `comandos.js` | — |
| `icone` | `text` | `cron.js`, `ask.js`, `comandos.js` | — |
| `valor_meta` | `numeric` | `cron.js`, `ask.js` | ⚠️ vs `meta` em `comandos.js` |
| `meta` | `numeric`? | `comandos.js:204` | ⚠️ vs `valor_meta` |
| `valor_atual` | `numeric` | `cron.js`, `ask.js` | ⚠️ vs `atual` em `comandos.js` |
| `atual` | `numeric`? | `comandos.js:204` | ⚠️ vs `valor_atual` |
| `ativa` | `boolean` | `cron.js`, `ask.js` | — |
| `criado_em` | `timestamptz` | `cron.js`, `ask.js` | ⚠️ vs `created_at` |
| `created_at` | `timestamptz`? | `comandos.js:200` | ⚠️ vs `criado_em` |
| `descricao` | `text` | spec seção 4.6 | — |
| `tipo` | `text` | spec seção 4.6 | — |
| `unidade` | `text` | spec seção 4.6 | — |
| `prazo` | `date` | spec seção 4.6 | — |

### Campos sensíveis
Nenhum.

### Campos JSON
Nenhum.

### Riscos
- **MÉDIO**: Mesmo padrão da tabela `tarefas` — `comandos.js` usa nomes de colunas diferentes (`meta`, `atual`, `created_at`) do que os demais arquivos usam (`valor_meta`, `valor_atual`, `criado_em`). Leituras provavelmente retornam `undefined` em pelo menos um dos caminhos.

### Divergências com o Plano B
O spec define `valor_meta`, `valor_atual`, `criado_em`. O `comandos.js` usa `meta`, `atual`, `created_at`. É o mesmo padrão de `tarefas`: `comandos.js` parece ser código antigo com nomes de colunas diferentes.

### A definir
- Quais nomes de colunas realmente existem no banco?
- `tipo`, `unidade` e `prazo` já existem ou são só spec?

---

## 5. `financas`

### Colunas visíveis (inferidas do código)

| Coluna | Tipo inferido | Fonte |
|---|---|---|
| `saldo` | `numeric` | `comandos.js:174,180` |
| `updated_at` | `timestamptz` | `comandos.js:174` (usado para `order`) |

### Campos sensíveis
`saldo` — valor financeiro pessoal.

### Campos JSON
Nenhum.

### Riscos
- **MÉDIO**: Tabela legada. Apenas `comandos.js` lê desta tabela. Nenhum arquivo faz escrita documentada.
- O dado de `saldo` pode estar desatualizado (snapshot estático) enquanto os lançamentos reais estão em `lancamentos_financeiros`.
- Se o `saldo` desta tabela for o único ponto de verdade financeira para o `comandos.js`, e os lançamentos não atualizarem este campo, o painel WA mostrará saldo incorreto.

### Divergências com o Plano B
O spec (seção 4.10) lista `financas` como tabela **a remover** após migração para `lancamentos_financeiros`.
O `cron.js` já usa `lancamentos_financeiros` corretamente. Apenas `comandos.js` ainda depende de `financas`.

### A definir
- A tabela tem mais colunas além de `saldo` e `updated_at`?
- Quem escreve nesta tabela? (não encontrado no código do repo)
- Os dados de `financas.saldo` são manualmente inseridos via painel Supabase ou atualizados por algum script externo (n8n)?

---

## 6. `lancamentos_financeiros`

### Colunas visíveis (inferidas do código)

| Coluna | Tipo inferido | Fonte |
|---|---|---|
| `id` | `bigserial` | spec seção 4.6 |
| `tipo` | `text` (`'receita'`\|`'despesa'`) | `cron.js:26`, `ask.js` |
| `valor` | `numeric` | `cron.js:26`, `ask.js` |
| `data` | `date` | `cron.js`, `ask.js` (filtro `data=gte.`) |
| `descricao` | `text` | spec seção 4.6 |
| `categoria_id` | `int` FK | spec seção 4.6 |
| `conta` | `text` | spec seção 4.6 |
| `comprovante_id` | `uuid` FK | spec seção 4.6 |
| `criado_em` | `timestamptz` | spec seção 4.6 |

### Campos sensíveis
`valor`, `descricao` — dados financeiros pessoais.

### Campos JSON
Nenhum.

### Riscos
- **BAIXO**: Esta é a tabela correta do Plano B para dados financeiros. Risco baixo de perda.
- **MÉDIO**: `assistente.js` ainda escreve dados financeiros em `dados_assistente` (cache jsonb) em vez de diretamente nesta tabela. Os dados podem divergir.
- Colunas `categoria_id` e `comprovante_id` estão no spec mas não são usadas por nenhum arquivo de código atual — provavelmente não existem ainda na tabela real.

### Divergências com o Plano B
Tabela coincide com o Plano B. Colunas `categoria_id` e `comprovante_id` são adições planejadas para SP-6 (Financeiro Completo) — provavelmente ausentes agora.

### A definir
- `descricao` existe na tabela real? (não usado em queries, só no spec)
- `categoria_id` já foi criada ou é futura?
- Há dados financeiros nesta tabela? (quantidade de registros desconhecida)

---

## 7. `wa_chats`

### Colunas visíveis
**Nenhuma coluna inferida** — esta tabela **não é referenciada em nenhum arquivo** do repositório `dashboard-pessoal`.

| Coluna | Tipo inferido | Fonte |
|---|---|---|
| *(desconhecido)* | — | Tabela não encontrada no código |

### Campos sensíveis
Provavelmente sensível — conversas de WhatsApp.

### Campos JSON
Provavelmente — mensagens WA costumam ser armazenadas como jsonb.

### Riscos
- **MÉDIO**: Tabela existe no Supabase mas não está no código deste repo. Pode estar sendo escrita por serviço externo (n8n, Evolution API, Chatwoot, OpenClaw) e pode conter histórico de conversas WA.
- Remover esta tabela sem saber quem a escreve pode quebrar um serviço externo silenciosamente.

### Divergências com o Plano B
Não está no Plano B. Pode ser substituída por `chat_assistente`, pode ser complementar, ou pode ser de um sistema paralelo (Chatwoot / Evolution API).

### A definir
- Quem escreve nesta tabela? (n8n? OpenClaw? Evolution API?)
- Tem alguma relação com `chat_assistente` ou `comandos`?
- Quais são as colunas reais?
- Pode ser a tabela de histórico do bot de atendimento (diferente do assistente pessoal)?

---

## 8. `comandos`

### Colunas visíveis (inferidas do código)

| Coluna | Tipo inferido | Fonte |
|---|---|---|
| `id` | `bigserial` | `webhook.js:76` (`salvo?.id`) |
| `tipo` | `text` (`'texto'`\|`'voz'`\|`'imagem'`\|`'documento'`) | `webhook.js:65` |
| `texto` | `text` | `webhook.js:66` |
| `resposta` | `text` | `webhook.js:67` |
| `de` | `text` (ex: `'WhatsApp'`) | `webhook.js:68` |
| `status` | `text` (ex: `'ok'`) | `webhook.js:69` |
| `ts` | `timestamptz` | `webhook.js:54` (order: `ts.desc`) |

### Campos sensíveis
`texto` — pode conter comandos de voz transcritos com informações pessoais ou financeiras.
`resposta` — pode conter dados pessoais retornados pelo assistente.

### Campos JSON
Nenhum.

### Riscos
- **BAIXO**: Tabela bem definida e usada de forma consistente.
- **ATENÇÃO**: O `server.cjs` local mantém um arquivo `comandos.json` separado — dados locais **não são sincronizados** com esta tabela Supabase.

### Divergências com o Plano B
O spec (seção 4.3) coincide quase totalmente. O spec adiciona campo `origem` (`'whatsapp'`|`'dashboard'`) que não aparece nas queries do `webhook.js`. Pode já existir na tabela ou ser adição futura.

### A definir
- O campo `origem` já existe na tabela real?
- O campo `ts` tem default `now()` no banco? (não visto no insert do `webhook.js`)

---

## Resumo de Divergências Críticas

| Tabela | Divergência | Risco |
|---|---|---|
| `dados_assistente` | `cron.js` lê campos planos (`ig_seguidores`); `assistente.js` lê jsonb nested (`dados.seguidores`) | ALTO |
| `tarefas` | `comandos.js` usa `done`/`created_at`; outros usam `concluida`/`criado_em` | ALTO |
| `metas` | `comandos.js` usa `meta`/`atual`/`created_at`; outros usam `valor_meta`/`valor_atual`/`criado_em` | ALTO |
| `financas` | Nenhum arquivo escreve nela; apenas `comandos.js` lê; pode estar com saldo desatualizado | MÉDIO |
| `oauth_tokens` | RLS não verificado; tokens OAuth acessíveis via `SUPABASE_ANON_KEY` | CRÍTICO |
| `wa_chats` | Zero referências no código; origem e propósito desconhecidos | MÉDIO |
| `lancamentos_financeiros` | `assistente.js` ainda escreve financeiro em `dados_assistente` (cache) em vez desta tabela | MÉDIO |

---

## Tabelas não inspecionadas neste documento

As seguintes tabelas foram identificadas em `docs/13-schema-real-extraido.md` mas não foram inspecionadas aqui:
`chat_assistente`, `fin_categorias`, `fin_orcamento`, `gmb_reviews`, `infra_logs`, `infra_servicos`, `morning_briefing`, `notas`, `supervisor_logs`, `transacoes`, `wa_analyses`, `wa_connections`, `wa_requests`, `widget_scripts`

Ficam para inspeção na próxima etapa.
