# Mapa de Comandos WhatsApp — /api/comandos

> Leitura pura. Nenhum codigo alterado.
> Data: 2026-05-11
> Fonte: api/comandos.js, docs/17, docs/24, docs/25, dashboard.html

---

## 1. Lista completa de comandos

| Aliases aceitos | Handler | Tipo de dependencia |
|----------------|---------|---------------------|
| `agenda`, `calendar`, `eventos` | `handleAgenda()` | Google Calendar API + OAuth |
| `email`, `emails`, `e-mail`, `inbox` | `handleEmails()` | Gmail API + OAuth |
| `drive`, `arquivos`, `docs` | `handleDrive()` | Google Drive API + OAuth |
| `tarefas`, `tasks`, `todo` | `handleTarefas()` | Supabase `tarefas` |
| `financas`, `financas`, `saldo`, `dinheiro` | `handleFinancas()` | Supabase `financas` + `transacoes` |
| `metas`, `goals`, `objetivos` | `handleMetas()` | Supabase `metas` |
| `resumo`, `resume`, `dia`, `hoje` | `handleResumo()` | Todos acima (agenda + tarefas + financas) |
| `alertas`, `alerta`, `ver alertas`, `listar alertas` | `handleAlertas()` | HTTP fetch para propria Vercel prod |
| `ajuda`, `help`, `comandos`, `menu` | `handleAjuda()` | Nenhuma (string estatica) |

**Total:** 9 grupos de comandos, 27 aliases reconhecidos.

---

## 2. Quais parecem realmente usados

| Comando | Evidencia de uso | Justificativa |
|---------|-----------------|---------------|
| `ajuda` | Alta — chip no dashboard, alias `help` | Primeiro comando ensinado a qualquer usuario |
| `agenda` | Alta — chip no widget assistente | Medico consulta compromissos diariamente |
| `resumo` / `hoje` | Alta — chip no Supervisor IA | Substituto do morning briefing interativo |
| `alertas` | Media — botao Supervisor IA | Monitoramento de saude do sistema |
| `financas` / `saldo` | Media — chip `saldo do mes` no assistente | Consulta frequente mas via `/api/assistente`, nao `/api/comandos` |
| `tarefas` | Baixa — tabela vazia confirmada | Sem dados = sem uso real |
| `metas` | Baixa — tabela vazia confirmada | Sem dados = sem uso real |
| `emails` | Baixa — sem chip de atalho no dashboard | Google API pesada para consulta casual |
| `drive` | Baixa — sem chip de atalho no dashboard | Raramente consultado por voz |

---

## 3. Quais parecem legado

| Alias | Por que parece legado |
|-------|----------------------|
| `calendar` | Alias ingles; usuario fala portugues |
| `eventos` | Nunca documentado como uso ativo |
| `e-mail` | Variante hifenizada arcaica |
| `inbox` | Alias ingles |
| `docs` | Colide semanticamente com "documentos" no Segundo Eu |
| `tasks` / `todo` | Aliases ingleses; usuarios PT-BR usam `tarefas` |
| `goals` / `objetivos` | Aliases ingleses/formais; `metas` e mais natural |
| `resume` | Alias ingles de `resumo` |
| `ver alertas` / `listar alertas` | Multi-palavra; dificil de digitar no WhatsApp |
| `dinheiro` | Alias informal; `saldo` e mais usado |

---

## 4. Quais dependem de banco (Supabase)

| Comando | Tabela | Colunas lidas | Risco atual |
|---------|--------|---------------|-------------|
| `tarefas` | `tarefas` | `texto`, `done` | ALTO — `done` pode nao existir (ver doc 17) |
| `financas` | `financas` | `saldo` | MEDIO — tabela legada; pode estar vazia |
| `financas` | `transacoes` | `descricao`, `valor`, `tipo`, `data` | MEDIO — tabela legada |
| `metas` | `metas` | `nome`, `atual`, `meta`, `icone` | ALTO — `atual`/`meta` podem nao existir |
| `resumo` | (todas acima) | — | ALTO — herda todos os riscos acima |
| `agenda` | `oauth_tokens` | `refresh_token` | MEDIO — se tabela vazia, falha silenciosa |

---

## 5. Quais dependem de Google / API externa

| Comando | API externa | Ponto de falha |
|---------|------------|----------------|
| `agenda` | Google Calendar v3 | Token expirado → mensagem amigavel mascarando erro |
| `emails` | Gmail v1 | Idem |
| `drive` | Google Drive v3 | Idem |
| `resumo` | Google Calendar v3 (via agenda) | Idem; 3 renovacoes independentes de token |
| `alertas` | `dashboard-pessoal-edson.vercel.app/api/alerts` | Auto-chamada; falha em dev sem internet |

**Observacao:** `handleEmails` e `handleDrive` sempre recebem `accessToken=null` no
dispatch — renovam o token do Supabase a cada chamada, mesmo em `resumo` que
chama os tres ao mesmo tempo.

---

## 6. Quais tem maior risco de regressao

| Comando | Risco | Motivo |
|---------|-------|--------|
| `resumo` | CRITICO | Combina 3 handlers; qualquer falha silenciosa contamina o resumo inteiro |
| `tarefas` | ALTO | Coluna `done` provavelmente errada; retorna todas como pendentes |
| `metas` | ALTO | Colunas `atual`/`meta` provavelmente erradas; exibe 0% em tudo |
| `financas` | ALTO | Le `financas` + `transacoes` (legado); `lancamentos_financeiros` ignorado |
| `agenda` | MEDIO | Cadeia OAuth; qualquer falha vira mensagem amigavel sem log |
| `alertas` | MEDIO | Chama producao; auto-referencial; timeout silencioso |

---

## 7. Quais ja estao prontos para o Segundo Eu

| Comando | Alinhamento com Segundo Eu | O que ja funciona |
|---------|---------------------------|-------------------|
| `ajuda` | TOTAL — entry point de qualquer assistente | String estatica, sem deps, sempre seguro |
| `agenda` | TOTAL — calendario e pilar do Segundo Eu | Fluxo OAuth funcional se token valido |
| `resumo` | ALTO — digest diario e conceito central | Combina contexto util; formato WhatsApp bom |
| `alertas` | MEDIO — monitoramento operacional | Funciona como canal de avisos do sistema |
| `financas` | MEDIO — dados financeiros sao contexto pessoal | Logica presente; banco precisa de correcao |

---

## 8. Quais poderiam usar memoria IA no futuro

| Comando | Tipo de memoria util | Exemplo pratico |
|---------|---------------------|-----------------|
| `resumo` | Contexto historico + padrao diario | "Voce tinha 3 reunioes ontem, 2 concluidas" |
| `tarefas` | Padrao de criacao e conclusao | "Suas tarefas medicas ficam pendentes em media 4 dias" |
| `financas` | Comparacao temporal | "Despesas 18% acima da media dos ultimos 3 meses" |
| `metas` | Tendencia e projecao | "Nesse ritmo voce conclui a meta em 23 dias" |
| `agenda` | Contexto de recorrencia | "Voce tem reuniao semanal toda terca — quer agendar proxima?" |
| `alertas` | Padroes de incidente | "Este alerta ja ocorreu 3 vezes esta semana" |

---

## 9. Quais precisam de fixture/teste antes de mudar

| Comando | O que precisa de fixture | Por que |
|---------|--------------------------|---------|
| `tarefas` | Linha real em `tarefas` com coluna `done` OU `concluida` | Confirmar qual coluna existe antes de corrigir |
| `metas` | Linha real em `metas` com `atual`/`meta` OU `valor_atual`/`valor_meta` | Idem |
| `financas` | Linha real em `financas` com campo `saldo` | Confirmar se tabela legada tem dados |
| `resumo` | Fixtures dos tres acima | Depende de tarefas + metas + financas |
| `agenda` | Token Google valido no ambiente de teste | Sem token: handler sempre retorna mensagem de erro |
| `alertas` | Mock de `/api/alerts` | Chama producao; nao testavel localmente sem intercept |

**Nota:** `ajuda`, `emails` e `drive` nao precisam de fixture — `ajuda` e estatico;
`emails`/`drive` falham graciosamente sem token.

---

## 10. Proxima microtarefa recomendada

**Confirmar colunas reais de `tarefas` e `metas` no Supabase.**

Isso desbloqueia:
- Corrigir `handleTarefas()` e `handleMetas()` com seguranca (1 linha cada)
- Escrever fixtures P1 para ambos os handlers
- Corrigir `resumo` que depende dos dois

Acao do usuario (leitura, sem SQL, sem alteracao):
1. Abrir Supabase → Table Editor → `tarefas` → ver lista de colunas
2. Abrir Supabase → Table Editor → `metas` → ver lista de colunas
3. Reportar aqui: `done` ou `concluida`? `atual`/`meta` ou `valor_atual`/`valor_meta`?

Apos isso: uma correcao de 2 linhas em `api/comandos.js` resolve os dois
handlers mais riscosos do fluxo principal.

---

## Nota sobre numeracao de documentos

Existem conflitos de numeracao na pasta `docs/`:
- `docs/20-mapa-openclaw-crm-supervisor.md` e `docs/20-visao-openclaw-crm-supervisor.md`
- `docs/21-mapa-tabelas-operacionais.md` e `docs/21-arquitetura-alvo-segundo-eu.md`

Os arquivos de visao/arquitetura (20-visao, 21-arquitetura) parecem ser de uma
sessao anterior. Os arquivos de mapa/diagnostico (20-mapa, 21-mapa) foram criados
na sessao atual. Nao remover nem renomear sem decisao explicita.
