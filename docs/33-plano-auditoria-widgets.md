# Plano de Auditoria de Widgets

> Documento criado em: 2026-05-11  
> Escopo: análise curta, sem alteração de código, banco, testes ou arquitetura

---

## 1. Quais widgets parecem críticos

- Morning Briefing.
- OpenClaw / WhatsApp.
- Supervisor IA.
- Monitor IA / infraestrutura.
- Alertas.
- Google Calendar.
- Gmail.
- Google Drive.
- Financeiro.
- Tarefas e metas.

Esses widgets influenciam operação, rotina, agenda, diagnóstico ou decisões do usuário.

---

## 2. Quais widgets parecem apenas visuais

- Instagram.
- Facebook.
- YouTube.
- TikTok.
- WhatsApp marketing.
- LinkedIn.
- Cards com imagens/tema/layout.
- Contatos, se não houver integração real ativa.

Podem ser úteis para navegação ou leitura rápida, mas não devem ser tratados como fonte confiável sem validar origem dos dados.

---

## 3. Quais dependem de APIs externas

- Google Calendar: Google Calendar API.
- Gmail: Gmail API.
- Google Drive: Drive API.
- Morning Briefing: envio WhatsApp/Meta ou OpenClaw, conforme fluxo ativo.
- OpenClaw / WhatsApp: OpenClaw/Vercel.
- Alertas por WhatsApp: OpenClaw WebSocket.
- Marketing social: Meta/Instagram/Facebook/TikTok/YouTube, se os dados forem reais.

---

## 4. Quais dependem de Supabase

- OpenClaw / histórico: `comandos`.
- Morning Briefing: `morning_briefing`.
- Supervisor IA: `supervisor_logs`.
- Monitor IA / infraestrutura: `infra_logs`, `infra_servicos`.
- Alertas: `dashboard_alerts` ou fallback atual.
- Tarefas: `tarefas`.
- Metas: `metas`.
- Financeiro: `financas`, `transacoes`, `lancamentos_financeiros`.
- Notas: `notas`.
- OAuth: `oauth_tokens`.

---

## 5. Quais têm maior risco de "falso funcionamento"

- Supervisor IA: pode exibir diagnóstico com falso negativo de Supabase ou logs antigos.
- Morning Briefing: pode parecer presente, mas estar parado.
- OpenClaw: pode mostrar registros antigos/teste como se fosse fluxo ativo.
- Alertas: pode retornar vazio por tabela ausente, não por ausência real de alertas.
- Instagram/Facebook: podem exibir dados hardcoded.
- Tarefas/metas/financeiro/notas: podem parecer widgets vivos mesmo com tabelas vazias.

---

## 6. Ordem ideal de auditoria

1. Morning Briefing.
2. Supervisor IA.
3. OpenClaw / WhatsApp.
4. Alertas.
5. Google Calendar.
6. Gmail.
7. Google Drive.
8. Financeiro.
9. Tarefas e metas.
10. Widgets de marketing/social.

Priorizar primeiro o que parece funcional mas pode estar parado, vazio ou mostrando dado falso.

---

## 7. Critério para considerar widget "confiável"

Um widget só deve ser considerado confiável quando:

- Carrega sem erro visual.
- Mostra dado vindo da fonte correta.
- Informa estado vazio de forma honesta.
- Não depende de dado hardcoded sem aviso.
- Tem data/hora ou sinal de atualização quando relevante.
- Falha de API ou Supabase aparece como erro claro, não como sucesso vazio.
- Não expõe tokens, secrets ou dados sensíveis indevidos.

---

## 8. Próximos 3 widgets prioritários

1. **Morning Briefing** — validar se ainda roda, quando rodou pela última vez e por qual canal envia.
2. **Supervisor IA** — validar autenticação, logs, falso negativo de Supabase e exposição de dados sensíveis.
3. **OpenClaw / WhatsApp** — validar se o fluxo real está ativo ou se o widget mostra apenas registros antigos/testes.

Esses três têm maior impacto operacional e maior risco de confiança falsa.
