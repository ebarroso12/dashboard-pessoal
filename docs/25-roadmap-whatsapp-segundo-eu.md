# Roadmap WhatsApp — Segundo Eu

> Documento criado em: 2026-05-11  
> Base: `docs/24-contrato-real-openclaw-webhook.md`  
> Escopo: roadmap curto, sem SQL, sem código, sem alteração de banco

---

## 1. Estado atual do WhatsApp/OpenClaw

O WhatsApp já funciona como canal operacional via OpenClaw, mas ainda em dois fluxos separados:

- `/api/webhook`: registra mensagens, transcrições e respostas na tabela `comandos`.
- `/api/comandos`: processa comandos por texto e retorna `{ resposta, ok: true }`.

Hoje o Vercel não envia mensagens diretamente ao usuário nesse fluxo. Quem entrega no WhatsApp é o OpenClaw.

---

## 2. O que já funciona

- Recebimento de texto/transcrição pelo webhook.
- Registro de `tipo`, `texto`, `resposta`, `de`, `status` e `ts`.
- Exibição no dashboard com polling da tabela `comandos`.
- Autenticação por `X-Webhook-Token` ou `body.token`.
- Comandos por keyword em `/api/comandos`.
- Envio ativo por OpenClaw WebSocket em alertas.
- Envio ativo por Meta API em rotinas específicas.

---

## 3. O que falta para virar entrada principal do Segundo Eu

- Unificar histórico de mensagens, comandos e respostas.
- Adicionar memória IA consultável antes de responder.
- Persistir remetente/contato com mais contexto.
- Suportar anexos, documentos e imagens.
- Preservar áudio original, não apenas transcrição.
- Criar contratos e testes antes de mudar OpenClaw ou endpoints.

---

## 4. Prioridade 1: comandos texto

Consolidar comandos de texto como primeira entrada confiável do "Segundo Eu".

Foco:

- Preservar contrato atual de `/api/comandos`.
- Mapear comandos usados de fato no WhatsApp.
- Garantir registro do comando e da resposta no histórico.
- Evitar mudança em `api/comandos.js` antes de validar colunas reais e fixtures.

---

## 5. Prioridade 2: memória IA

Usar histórico para respostas com contexto, sem trocar a arquitetura atual.

Foco:

- Definir onde o histórico conversacional deve ser lido.
- Separar memória pessoal da memória operacional/CRM.
- Avaliar uso de `chat_assistente`, `comandos` e tabelas `wa_*`.
- Não migrar `dados_assistente` ainda.

---

## 6. Prioridade 3: anexos/documentos

Permitir que WhatsApp receba documentos úteis ao "Segundo Eu".

Foco:

- Definir contrato para `tipo: "documento"`.
- Registrar metadados do arquivo antes de qualquer análise.
- Planejar suporte a PDF, imagens e laudos.
- Não criar migrations antes de validar fluxo real do OpenClaw.

---

## 7. Prioridade 4: áudio

Evoluir áudio além da transcrição.

Foco:

- Preservar transcrição atual.
- Planejar armazenamento de URL/metadados do áudio original.
- Diferenciar áudio, texto, imagem e documento no histórico.
- Evitar quebrar o fallback atual `body.audio -> tipo: "voz"`.

---

## 8. Riscos

- Quebrar OpenClaw ao mudar contratos do webhook.
- Misturar `/api/webhook` e `/api/comandos` sem estratégia.
- Perder histórico ao remodelar `comandos`.
- Criar memória IA com dados sensíveis sem fronteiras.
- Assumir que `wa_*` não está em uso por serviço externo.
- Criar suporte a anexos sem política de privacidade e armazenamento.

---

## 9. Próxima microtarefa recomendada

Documentar o fluxo mínimo de WhatsApp texto:

- Entrada em `/api/comandos`.
- Resposta esperada pelo OpenClaw.
- Registro futuro em histórico.
- Campos mínimos de contato/remetente.
- Casos que precisam de fixture antes de qualquer alteração.

Objetivo: preparar o primeiro passo seguro para transformar WhatsApp em entrada principal do "Segundo Eu", sem alterar produção.
