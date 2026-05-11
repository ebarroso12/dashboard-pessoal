# Estratégia de Testes — Segundo Eu

> Documento criado em: 2026-05-11  
> Escopo: visão curta, sem alteração de código, testes, banco ou SQL

---

## 1. O que já está protegido por testes

- `/api/comandos` P0: 15/15 passando.
- `/api/comandos` P1: 22/22 passando.
- Autenticação por token.
- CORS, métodos aceitos e rejeitados.
- Comandos básicos e aliases.
- Shape de resposta `{ resposta, ok: true }`.
- Fluxo sem rede real, com `fetch` mockado.
- Compatibilidade do contrato atual sem alterar `api/comandos.js`.

---

## 2. O que ainda NÃO está protegido

- `/api/webhook` do OpenClaw.
- Persistência real na tabela `comandos`.
- Fluxos `wa_*`.
- Supervisor IA.
- Dashboard visual e polling.
- Morning briefing.
- Integrações Google reais.
- Uploads, anexos, documentos e áudio.
- Memória IA e histórico contextual.

---

## 3. Fluxos críticos do OpenClaw

- `POST /api/comandos` para comandos texto.
- `POST /api/webhook` para registrar texto, voz e resposta.
- Contrato de autenticação por `X-Webhook-Token` ou `body.token`.
- Separação entre responder comando e registrar histórico.
- Compatibilidade com payloads atuais e aliases legados.

---

## 4. Fluxos críticos do Supervisor IA

- Registro de eventos em `supervisor_logs`.
- Leitura de logs de infraestrutura.
- Diagnóstico sem alterar produção.
- Sinalização de falhas sem acionar mudanças destrutivas.
- Separação entre log técnico, recomendação e ação executada.

---

## 5. Fluxos críticos do dashboard

- Carregamento inicial sem quebrar UI.
- Polling de comandos e histórico OpenClaw.
- Exibição de briefing, tarefas, metas e alertas.
- Tratamento de APIs ausentes ou com erro.
- Preservação de compatibilidade com Supabase REST.

---

## 6. O que deve ganhar P2

- Casos de `/api/comandos` com dados reais simulados de Supabase.
- Divergências de colunas em `tarefas` e `metas`.
- Fluxo financeiro legado (`financas`, `transacoes`, `lancamentos_financeiros`).
- Contrato de `/api/webhook`.
- Registro histórico após comando WhatsApp.
- Erros de Supabase simulados.
- Cenários vazios e respostas silenciosamente incorretas.

---

## 7. O que NÃO precisa de teste agora

- UI completa fim a fim.
- Teste com rede real.
- Teste contra banco real.
- Testes de performance.
- Testes de anexos/documentos.
- Testes de áudio original.
- Testes de migrations futuras.
- Testes de nova memória IA antes do contrato existir.

---

## 8. Estratégia de mocks

- Manter `fetch` mockado.
- Não depender de rede real.
- Mockar Supabase REST por URL, tabela e resposta esperada.
- Mockar Google APIs apenas quando o comando exigir.
- Simular erros HTTP e payloads inesperados.
- Usar fixtures pequenas, explícitas e próximas do contrato real.

---

## 9. Estratégia para evitar regressões

- Todo comportamento legado crítico deve ter teste antes de refatoração.
- Não alterar `api/comandos.js` sem P0/P1 verdes.
- Não corrigir divergências de colunas sem validar o schema real.
- Separar testes de contrato de testes de implementação.
- Adicionar adapters somente com casos de antes/depois cobertos.
- Rodar P0/P1 antes de qualquer mudança em OpenClaw, comandos ou Supabase.

---

## 10. Próxima microtarefa recomendada

Criar o plano P2 de `/api/comandos` e `/api/webhook`, ainda sem implementar testes.

O plano deve listar:

- Casos com dados simulados de Supabase.
- Casos de erro e tabela vazia.
- Divergências de `tarefas` e `metas`.
- Payloads reais do OpenClaw.
- Critérios para liberar a primeira refatoração segura.
