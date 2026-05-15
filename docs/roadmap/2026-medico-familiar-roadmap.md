# Roadmap Módulo Médico e Familiar — 2026

> Status: PLANEJAMENTO. NÃO IMPLEMENTAR ainda.  
> Último review: 2026-05-15

---

## Contexto

O Dr. Edson é médico psiquiatra. O dashboard pessoal está estável. A próxima fase natural é um módulo médico para gestão do consultório e um módulo familiar para vida pessoal. Ambos envolvem dados sensíveis que exigem segurança adicional.

**Critério para iniciar implementação:**
1. Dashboard base estável por 2+ semanas sem regressões
2. Meta Long-Lived Token implementado
3. RLS nas tabelas principais aplicado
4. Supabase Auth real com email/senha implementado

---

## Módulo Médico

### Escopo

Gestão pessoal do consultório do Dr. Edson. **NÃO é prontuário clínico oficial (HIPAA/CFM).** É uma ferramenta de produtividade pessoal.

### Features Prioritárias

**1. Agenda Clínica**
- Visualização semanal de consultas (integração Google Calendar)
- Marcação rápida de consultas pelo dashboard
- Categorias: consulta, retorno, supervisão, reunião
- Duração padrão configurável
- Alertas 24h antes via WhatsApp

**2. Anotações Pessoais de Consulta**
- Notas do médico sobre a sessão (não prontuário)
- Campo livre de texto
- Tags configuráveis
- Busca por data/tag
- Nunca vinculado ao paciente por nome — apenas referência numérica ou pseudônimo

**3. Dashboard de Produtividade Clínica**
- Consultas por semana/mês
- Taxa de retorno
- Distribuição por horário
- Receita estimada por período

**4. Rotinas e Protocolos Pessoais**
- Checklist pré-consulta
- Formulários de anamnese pessoal (templates)
- Protocolos de tratamento (referência pessoal)

### Segurança Necessária

- Dados em tabelas separadas com RLS obrigatório
- Nunca armazenar nome de paciente real — apenas ID ou pseudônimo
- Campo de notas criptografado em repouso (Supabase vault ou AES no cliente)
- Acesso apenas autenticado (Supabase Auth obrigatório antes desta fase)
- Backup separado dos dados clínicos

### Tabelas Novas Propostas

```sql
-- Apenas planejamento, nao executar
CREATE TABLE agenda_clinica (
  id SERIAL PRIMARY KEY,
  data DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  tipo TEXT, -- consulta, retorno, supervisao, reuniao
  notas TEXT,
  referencia TEXT, -- pseudonimo ou ID anonimo, nunca nome real
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rotinas_clinicas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT, -- checklist, protocolo, formulario
  conteudo JSONB,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

### Riscos

- **Dados sensíveis de pacientes:** risco legal se nome real for armazenado → sempre usar pseudônimo
- **CFM compliance:** prontuário oficial não pode ser digital sem sistema homologado → este módulo é apenas notas pessoais
- **Vazamento:** se RLS falhar, notas pessoais estariam expostas → criptografia adicional necessária
- **Backup:** dados clínicos precisam de backup separado e mais frequente

---

## Módulo Familiar

### Escopo

Gestão da vida pessoal e familiar. Dados menos sensíveis que o clínico.

### Features Prioritárias

**1. Agenda Familiar**
- Eventos da família (consultas, escola, aniversários)
- Compartilhamento via Google Calendar
- Visualização unificada (pessoal + familiar)

**2. Gastos Familiares**
- Categorias separadas por pessoa (Dr. Edson, cônjuge, filhos, dependentes)
- Meta de gasto por categoria familiar
- Comparação mês a mês
- Divisão de responsabilidades

**3. Saúde Familiar Básica**
- Próximas consultas médicas (família)
- Vacinas pendentes (referência)
- Medicamentos em uso (família)
- Lembretes de exames periódicos

**4. Documentos Importantes**
- Referências de documentos (não os documentos em si)
- Localização física de documentos
- Datas de vencimento (CNH, passaporte, etc.)

### Tabelas Novas Propostas

```sql
-- Apenas planejamento, nao executar
CREATE TABLE familia_agenda (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  data DATE NOT NULL,
  hora TIME,
  pessoa TEXT, -- dr_edson, conjuge, filho1, etc.
  tipo TEXT,
  notas TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE familia_gastos (
  id SERIAL PRIMARY KEY,
  pessoa TEXT,
  categoria TEXT,
  valor DECIMAL(10,2),
  descricao TEXT,
  data DATE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

### Riscos

- **Privacidade do cônjuge:** dados de terceiros requerem consentimento
- **Complexidade:** módulo familiar pode crescer indefinidamente — manter escopo pequeno inicialmente
- **Supabase Auth:** necessário antes desta fase para distinguir membros

---

## Automações WhatsApp

### Features Planejadas

**1. Briefing Matinal Automático (7h)**
- Vercel Cron trigger às 7h (BRT)
- Chama `/api/cron?tipo=morning`
- Envia via WhatsApp Business API
- Já parcialmente implementado — falta ativar o cron

**2. Alertas Críticos em Tempo Real**
- Supervisor detecta problema crítico → envia WA
- Integração com `/api/alerts.js`
- Throttle: máximo 1 alerta por hora por componente

**3. Resumo Semanal (segunda 7h)**
- Já implementado em `runWeekly()` no cron.js
- Falta ativar o trigger automático

**4. Lembretes de Consulta**
- 24h antes de cada consulta agendada
- Integração agenda_clinica → WhatsApp

### Configuração Necessária

```
Vercel Cron (vercel.json):
{
  "crons": [
    { "path": "/api/cron?tipo=morning", "schedule": "0 10 * * *" },
    { "path": "/api/cron?tipo=weekly", "schedule": "0 10 * * 1" }
  ]
}
```

**Nota:** Vercel Cron requer plano Pro ($20/mês). Alternativa: n8n no VPS Hostinger (já disponível).

---

## Melhorias Mobile/PWA Futuras

- Swipe gestures no drawer (swipe esquerda para fechar)
- Pull-to-refresh no feed
- Notificações push via service worker (requer backend de push notifications)
- Modo offline para tarefas e notas (service worker com cache)
- Share sheet nativo para envio de relatórios

---

## Priorização Recomendada

```
Fase 1 (2026 Q2): Estabilização
  - Meta Long-Lived Token
  - RLS completo nas tabelas
  - Supabase Auth básico

Fase 2 (2026 Q3): Clínica Básica
  - Agenda Clínica (Google Calendar)
  - Notas pessoais de consulta (sem prontuário)
  - Dashboard de produtividade clínica

Fase 3 (2026 Q3-Q4): Família e Automações
  - Agenda familiar
  - Gastos familiares
  - Briefing matinal automático (Vercel Cron)
  - Alertas WhatsApp

Fase 4 (2026 Q4+): Expansão
  - Documentos importantes
  - Saúde familiar
  - Notificações push
  - Modo offline
```
