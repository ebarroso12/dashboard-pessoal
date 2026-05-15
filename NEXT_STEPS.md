# Próximos Passos — Dashboard Pessoal

> Prioridade: uso diário estável antes de novas features.

---

## Curto Prazo (operacional)

### 1. Meta Token Persistente
**Problema:** Token Meta expira em 60 min. Reconexão manual a cada sessão.  
**Solução:** Migrar para server-side OAuth com Long-Lived Token (60 dias).  
**Complexidade:** Média. Requer backend intermediário para troca de token.  
**Impacto:** Alta — elimina reconexão manual diária.

### 2. RLS nas tabelas principais
**Problema:** `dados_assistente`, `tarefas`, `notas` sem RLS — acessíveis via anon key.  
**Pré-requisito:** Migrar `sbSyncTarefas` e `sbSyncMetrica` do dashboard para endpoints service_role (padrão já aplicado no financeiro).  
**Complexidade:** Baixa após migração dos syncs.

### 3. Dashboard Clínica — Agenda Real
**Status:** Integração básica existe (Google Calendar). Falta UI dedicada para agenda médica.  
**Funcionalidades:**
- Visualização semanal/mensal de consultas
- Adicionar consultas pelo dashboard
- Integração com Google Calendar
- Lembretes via WhatsApp

---

## Médio Prazo

### 4. Módulo Médico (ver roadmap detalhado)
- Histórico de consultas
- Pacientes frequentes
- Anotações clínicas pessoais
- Documentos e exames (próprios)
- Rotinas e protocolos

### 5. Módulo Familiar
- Agenda familiar compartilhada
- Gastos familiares categorizados
- Metas familiares
- Saúde familiar básica

### 6. Automações WhatsApp
- Briefing matinal automático às 7h (via Vercel Cron)
- Alertas críticos em tempo real
- Resumo semanal automático
- Lembretes de consulta

### 7. Mobile Polish Real
- Validação em dispositivo físico
- Touch targets refinados
- Swipe para fechar drawer
- Haptic feedback (onde suportado)
- iOS Safari específico

---

## Longo Prazo

### 8. Supervisor IA — Autonomia Limitada
- Retry automático de endpoints com falha
- Renovação proativa de tokens antes de expirar
- Alertas WhatsApp para falhas críticas
- Relatório semanal de saúde do sistema

### 9. Análise Financeira Avançada
- Gráficos de tendência (6-12 meses)
- Projeção de saldo futuro
- Categorização automática por foto
- Exportação para planilha

### 10. Integração Supabase Auth Real
- Login com email/senha real (hoje é localStorage)
- Multi-device sem perda de estado
- Sessão compartilhada entre mobile e desktop
