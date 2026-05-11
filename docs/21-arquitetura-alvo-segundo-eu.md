# Arquitetura-Alvo Mínima — Segundo Eu

> Documento criado em: 2026-05-11  
> Objetivo: evoluir sem quebrar a operação atual  
> Escopo: visão arquitetural enxuta, sem SQL, sem rewrite, sem alteração de código

---

## 1. Núcleo operacional atual

O núcleo operacional atual é a parte que já sustenta a rotina real do sistema.
Ele inclui dashboard, APIs serverless, integrações externas, WhatsApp/OpenClaw, CRM, comandos, logs, briefing, monitoramento e dados de operação da clínica.

Componentes principais:

- `/api/comandos` e contratos usados por WhatsApp/OpenClaw.
- Fluxos de WhatsApp e CRM baseados em tabelas `wa_*`.
- Logs de Supervisor IA e infraestrutura.
- Briefing e automações operacionais.
- Integrações Google e demais tokens OAuth.
- Tabelas financeiras, tarefas, metas, notas e assistente já existentes.

Esse núcleo deve ser tratado como produção viva. Mesmo quando houver inconsistências, o primeiro objetivo é entender e encapsular antes de corrigir.

---

## 2. Núcleo pessoal/família futuro

O núcleo pessoal/família futuro será a camada tipada e organizada do "Segundo Eu".
Ela deve cobrir vida pessoal, família, esposa, filhos, saúde, documentos, finanças pessoais, agenda, tarefas, hábitos e memória da IA.

Domínios esperados:

- Perfil principal do usuário.
- Pessoas e familiares.
- Documentos e anexos.
- Saúde, exames, consultas e medicamentos.
- Finanças consolidadas.
- Tarefas, metas, hábitos e agenda.
- Memória de IA com contexto estruturado.

Esse núcleo deve nascer de forma incremental, coexistindo com o legado. Ele não deve substituir tabelas operacionais enquanto elas ainda forem usadas por fluxos reais.

---

## 3. Onde OpenClaw se encaixa

O OpenClaw fica na borda de comunicação do sistema.
Ele conecta WhatsApp, comandos, CRM, análises e possíveis automações externas.

Papel arquitetural:

- Canal de entrada e saída via WhatsApp.
- Ponte entre conversas e APIs internas.
- Fonte provável de registros em `wa_chats`, `wa_connections` e `wa_requests`.
- Dependência crítica para atendimento, CRM e uso diário.

Na arquitetura-alvo, OpenClaw deve continuar estável e ser protegido por contratos documentados. Mudanças internas no "Segundo Eu" não podem exigir mudança imediata no OpenClaw.

---

## 4. Onde Supervisor IA se encaixa

O Supervisor IA fica na camada de observabilidade e diagnóstico.
Ele acompanha eventos, falhas, reparos, logs e riscos operacionais.

Papel arquitetural:

- Registrar diagnósticos e eventos em `supervisor_logs`.
- Relacionar falhas técnicas com impacto operacional.
- Apoiar investigações antes de alterações sensíveis.
- Servir como histórico de decisões, reparos e alertas.

Na arquitetura-alvo, o Supervisor IA deve continuar acoplado à operação, mas com fronteiras mais claras entre log técnico, diagnóstico de IA e ação sugerida.

---

## 5. Onde CRM WhatsApp se encaixa

O CRM WhatsApp fica entre o canal de conversa e a operação da clínica.
Ele organiza relacionamento, histórico, análise de conversas e oportunidades de ação.

Papel arquitetural:

- Manter histórico de interações.
- Apoiar acompanhamento de leads, pacientes e contatos.
- Alimentar análises, alertas, tarefas e briefing.
- Servir como memória operacional separada da memória pessoal da IA.

O CRM WhatsApp deve coexistir com o "Segundo Eu" sem virar uma tabela genérica de memória. Conversas operacionais e memória pessoal precisam de fronteiras explícitas.

---

## 6. Quais partes devem permanecer estáveis

Devem permanecer estáveis até validação explícita:

- Contratos atuais do OpenClaw/WhatsApp.
- `/api/comandos` e formato de resposta esperado por integrações externas.
- Tabelas `wa_*`.
- `supervisor_logs`, `infra_logs` e `infra_servicos`.
- `oauth_tokens` e fluxos de autenticação externa.
- Tabelas com dados financeiros reais.
- Tabelas usadas por briefing, automações e diagnóstico.
- Deploy atual na Vercel.
- Estrutura geral sem migração para outro framework.

Estabilidade aqui significa não renomear, remover, migrar ou reinterpretar dados antes de mapear consumidores reais.

---

## 7. Quais partes podem ganhar adapters

Adapters podem ser usados para reduzir acoplamento sem quebrar produção.
Eles devem traduzir contratos antigos para contratos novos, mantendo a borda externa estável.

Candidatos a adapters:

- `/api/comandos`: adapter entre comandos legados e serviços internos tipados.
- Tarefas: adapter para lidar com `done`/`concluida` e `created_at`/`criado_em` até validar colunas reais.
- Metas: adapter para lidar com `meta`/`valor_meta` e `atual`/`valor_atual`.
- Financeiro: adapter entre `financas`, `transacoes` e `lancamentos_financeiros`.
- IA/memória: adapter para leitura de `dados_assistente` enquanto a memória tipada nasce.
- WhatsApp/CRM: adapter para normalizar dados vindos de `wa_*` sem alterar a origem.
- Logs: adapter para consolidar leitura de `supervisor_logs`, `infra_logs` e `infra_servicos`.

Adapters devem começar como código pequeno e testável, não como uma nova plataforma paralela.

---

## 8. Estratégia incremental segura

A evolução segura deve seguir uma sequência curta:

1. Documentar contratos reais antes de alterar código.
2. Validar colunas reais no Supabase antes de qualquer migration.
3. Criar testes de contrato para fluxos críticos.
4. Introduzir adapters em pontos de divergência.
5. Fazer leituras compatíveis com legado e novo formato.
6. Criar novas tabelas somente quando houver contrato claro.
7. Migrar dados apenas após backup, validação e rollback definido.
8. Só depois simplificar código legado.

Cada passo deve preservar o comportamento atual de produção.

---

## 9. O que NÃO mexer agora

Não mexer agora:

- Não reescrever o projeto.
- Não migrar para Next.js.
- Não criar microserviços complexos.
- Não alterar `api/comandos.js` sem validação de contrato e fixtures.
- Não alterar tabelas `wa_*`.
- Não remover `dados_assistente`, `financas` ou `transacoes`.
- Não alterar `oauth_tokens`.
- Não criar migrations para saúde, documentos ou memória sem validar o schema real.
- Não remodelar Supervisor IA ou logs sem entender consumidores atuais.
- Não fazer deploy como parte desta fase arquitetural.

O foco agora é proteger a operação e reduzir incerteza.

---

## 10. Próxima evolução mínima recomendada

A próxima evolução mínima recomendada é validar o núcleo operacional antes de introduzir novas estruturas.

Microtarefa sugerida:

- Criar um inventário de colunas observadas das tabelas `wa_*`, `supervisor_logs`, `infra_logs` e `infra_servicos`.
- Identificar quais arquivos do repositório usam essas tabelas.
- Marcar integrações externas prováveis como "A definir".
- Separar o que é canal, CRM, análise, log e diagnóstico.
- Definir quais contratos precisam de teste antes de qualquer refatoração.

Depois disso, a primeira mudança de arquitetura deve ser um adapter pequeno e protegido por teste, não uma alteração direta nas tabelas ou no OpenClaw.
