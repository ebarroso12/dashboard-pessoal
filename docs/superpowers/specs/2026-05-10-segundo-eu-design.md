# Spec: Sistema "Segundo Eu" — Dashboard Pessoal Dr. Edson Barroso
**Data:** 2026-05-10
**Versão:** 1.0
**Abordagem escolhida:** Plano B — Schema limpo do zero

---

## 1. VISÃO GERAL

O Dashboard Pessoal do Dr. Edson Barroso é um sistema de vida completo — um "segundo eu" digital que:
- Recebe comandos por **WhatsApp** (texto e voz) e pelo **painel web**
- Armazena documentos pessoais, profissionais e familiares (exames, contratos, fotos)
- Gerencia saúde pessoal e de familiares (esposa, filhos)
- Controla financeiro pessoal e profissional
- Monitora redes sociais e Google Meu Negócio
- Tem **memória de longo prazo** sobre o Dr. Edson — aprende com o uso
- Opera com IA (Claude) como cérebro central

**Infraestrutura fixa (não mudar):**
- Frontend: Vercel — `dashboard-pessoal-edson.vercel.app`
- Banco: Supabase — `https://jaewjscbigfwjiaeavft.supabase.co`
- WhatsApp: OpenClaw WebSocket — `wss://openclaw.n8ndredson.com`
- Automações: n8n self-hosted no Hostinger
- IA: Anthropic API (claude-sonnet-4-6)
- Token WebSocket OpenClaw: via env `OPENCLAW_TOKEN`
- Webhook token: `oc_edson_2026_secure` (env `WEBHOOK_TOKEN`)

---

## 2. ESTADO ATUAL — O QUE EXISTE

### 2.1 Arquivos API (Vercel Serverless, ESM)

| Arquivo | Função | Status |
|---|---|---|
| `api/alerts.js` | CRUD alertas + notificação WA | ✅ Funciona |
| `api/ask.js` | Consulta unificada para OpenClaw | ⚠️ Falta na vercel.json |
| `api/assistente.js` | Assistente linguagem natural (15 intents) | ⚠️ Dados inconsistentes |
| `api/cron.js` | Briefing matinal, reviews GMB, relatório semanal | ⚠️ Usa Meta API (diferente do resto) |
| `api/supervisor.js` | Agente Claude com 6 ferramentas | ⚠️ Checa tabelas erradas |
| `api/analisa-foto.js` | OCR nota fiscal via Claude Vision | ✅ Funciona |
| `api/webhook.js` | Recebe comandos OpenClaw → Supabase | ✅ Funciona |
| `api/comandos.js` | Feed de comandos (legado) | ⚠️ Duplicado com webhook |
| `api/config.js` | Config pública sem secrets | ✅ Funciona |
| `api/legendarios.js` | TOPs + Feed RSS IA | ⚠️ Falta na vercel.json |
| `api/google/token.js` | Troca code por tokens Google | ✅ Funciona |
| `api/google/refresh.js` | Renova access_token | ✅ Funciona |
| `api/google/calendar.js` | Lê eventos Calendar | ✅ Funciona |
| `api/google/calendar-create.js` | Cria evento Calendar | ⚠️ Falta na vercel.json |
| `api/google/gmail.js` | Lê emails não lidos | ✅ Funciona |
| `api/google/drive.js` | Lista arquivos Drive | ✅ Funciona |
| `api/oauth/google.js` | Callback OAuth Google | ✅ Funciona |
| `api/oauth/tiktok.js` | Callback OAuth TikTok | ✅ Funciona |
| `api/tiktok/token.js` | Troca code TikTok | ✅ Funciona |
| `api/whatsapp/test.js` | Diagnóstico WA | ✅ Funciona |
| `api/lib/openclaw.js` | Helper WebSocket OpenClaw | ✅ Funciona |

### 2.2 Problemas críticos no código atual

**1. Função `sb()` duplicada em 8 arquivos**
```js
// Copiada em: alerts, ask, assistente, cron, supervisor, webhook, assistente, supervisor
async function sb(path, opts = {}) { ... }
// → Precisa virar api/lib/supabase.js
```

**2. Dois mecanismos de WhatsApp**
- `cron.js` → Meta Business API (`graph.facebook.com`) via `WA_BUSINESS_TOKEN`
- Todos os outros → OpenClaw WebSocket via `OPENCLAW_TOKEN`
- → Unificar tudo em OpenClaw

**3. Token Google em dois lugares**
- `ask.js` → recebe `refresh_token` do cliente no body
- `supervisor.js`, `assistente.js` → busca do Supabase (`oauth_tokens`)
- → Sempre buscar do Supabase

**4. Dados financeiros inconsistentes**
- `assistente.js` → lê de `dados_assistente` (jsonb/cache)
- `ask.js` e `cron.js` → leem de `lancamentos_financeiros`
- → Eliminar `dados_assistente`, usar só tabelas tipadas

**5. Rotas faltando no vercel.json**
```
❌ /api/ask
❌ /api/legendarios
❌ /api/google/calendar-create
```

**6. `server.js` local salva em arquivo `comandos.json`**
- Produção (Vercel) salva no Supabase
- → Alinhar servidor local com Supabase também

---

## 3. ARQUITETURA ALVO

```
┌─────────────────────────────────────────────────────────┐
│                    INTERFACES                           │
│  WhatsApp (voz + texto)    Dashboard Web (Vercel)      │
└────────────────┬────────────────────┬───────────────────┘
                 │                    │
                 ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                   API LAYER (Vercel)                    │
│  /api/webhook   /api/ask   /api/assistente              │
│  /api/supervisor  /api/cron  /api/docs  /api/saude      │
│  /api/familia   /api/financeiro  /api/alertas           │
│                                                         │
│  libs compartilhadas:                                   │
│  api/lib/supabase.js    api/lib/openclaw.js             │
│  api/lib/google-auth.js api/lib/ia.js                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                   SUPABASE                              │
│  Banco PostgreSQL + Storage (arquivos/docs)             │
│  Row Level Security ativado                             │
└─────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│              INTEGRAÇÕES EXTERNAS                       │
│  Google (Calendar/Gmail/Drive)   OpenClaw/WhatsApp      │
│  Instagram/Facebook/TikTok/YouTube                      │
│  Google Meu Negócio              Anthropic API          │
└─────────────────────────────────────────────────────────┘
```

---

## 4. SCHEMA SUPABASE — PLANO B (LIMPO DO ZERO)

### 4.1 GRUPO: IDENTIDADE

```sql
-- Perfil principal do Dr. Edson
CREATE TABLE perfil (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL DEFAULT 'Dr. Edson Barroso',
  email         text,
  telefone      text,
  especialidade text DEFAULT 'Médico',
  data_nasc     date,
  cidade        text,
  preferencias  jsonb DEFAULT '{}',  -- timezone, idioma, etc.
  contexto_ia   text,                -- descrição em texto para dar contexto à IA
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- Família (esposa, filhos, etc.)
CREATE TABLE pessoas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  relacao       text NOT NULL,  -- 'esposa' | 'filho' | 'filha' | 'outro'
  data_nasc     date,
  observacoes   text,
  criado_em     timestamptz DEFAULT now()
);
-- Exemplos: { nome: 'Fulana', relacao: 'esposa' }
--           { nome: 'Joãozinho', relacao: 'filho' }
```

### 4.2 GRUPO: MEMÓRIA DA IA

```sql
-- O que a IA aprendeu sobre o Dr. Edson ao longo do tempo
CREATE TABLE memorias_ia (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria     text NOT NULL,     -- 'saude' | 'preferencia' | 'familia' | 'profissional' | 'financeiro' | 'habito'
  conteudo      text NOT NULL,     -- "Dr. Edson prefere consultas às 14h"
  fonte         text,              -- 'whatsapp' | 'dashboard' | 'automatico'
  importancia   int DEFAULT 3,     -- 1-5 (5 = crítico)
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);
-- Índice para busca por categoria
CREATE INDEX idx_memorias_categoria ON memorias_ia(categoria);
```

### 4.3 GRUPO: COMUNICAÇÃO

```sql
-- Histórico de comandos recebidos pelo WhatsApp/OpenClaw
CREATE TABLE comandos (
  id            bigserial PRIMARY KEY,
  tipo          text NOT NULL DEFAULT 'texto',  -- 'texto' | 'voz' | 'imagem' | 'documento'
  texto         text NOT NULL DEFAULT '',
  resposta      text DEFAULT '',
  de            text DEFAULT 'WhatsApp',
  status        text DEFAULT 'ok',
  origem        text DEFAULT 'whatsapp',  -- 'whatsapp' | 'dashboard'
  ts            timestamptz DEFAULT now()
);
CREATE INDEX idx_comandos_ts ON comandos(ts DESC);

-- Histórico de conversas com o Assistente IA
CREATE TABLE chat_assistente (
  id            bigserial PRIMARY KEY,
  origem        text DEFAULT 'whatsapp',  -- 'whatsapp' | 'dashboard'
  pergunta      text NOT NULL,
  resposta      text NOT NULL,
  intencao      text,              -- intent detectado
  pessoa_id     uuid REFERENCES pessoas(id),  -- NULL = Dr. Edson
  criado_em     timestamptz DEFAULT now()
);
```

### 4.4 GRUPO: DOCUMENTOS E ARQUIVOS

```sql
-- Metadados de todos os arquivos (o arquivo físico fica no Supabase Storage)
CREATE TABLE documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text NOT NULL,
  descricao     text,
  categoria     text NOT NULL,
  -- categorias: 'exame' | 'receita' | 'laudo' | 'contrato' | 'identidade'
  --             'certidao' | 'imposto' | 'seguro' | 'foto' | 'outro'
  pessoa_id     uuid REFERENCES pessoas(id),  -- NULL = Dr. Edson
  arquivo_path  text,             -- path no Supabase Storage bucket 'documentos'
  arquivo_nome  text,             -- nome original do arquivo
  arquivo_tipo  text,             -- MIME type: 'image/jpeg', 'application/pdf', etc.
  arquivo_tamanho bigint,         -- bytes
  data_doc      date,             -- data do documento (ex: data do exame)
  tags          text[],           -- ['cardiologia', 'anual', '2026']
  texto_ocr     text,             -- conteúdo extraído por OCR (para busca)
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);
CREATE INDEX idx_documentos_categoria ON documentos(categoria);
CREATE INDEX idx_documentos_pessoa    ON documentos(pessoa_id);
CREATE INDEX idx_documentos_data      ON documentos(data_doc DESC);
-- Full-text search no título, descrição e OCR
CREATE INDEX idx_documentos_fts ON documentos
  USING gin(to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(descricao,'') || ' ' || coalesce(texto_ocr,'')));
```

### 4.5 GRUPO: SAÚDE

```sql
-- Exames laboratoriais estruturados (além do documento PDF/foto)
CREATE TABLE exames (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id  uuid REFERENCES documentos(id),  -- link para o arquivo
  pessoa_id     uuid REFERENCES pessoas(id),      -- NULL = Dr. Edson
  tipo          text NOT NULL,    -- 'hemograma' | 'glicemia' | 'colesterol' | etc.
  laboratorio   text,
  medico_req    text,             -- médico que requisitou
  data_coleta   date,
  resultados    jsonb DEFAULT '{}',  -- { "glicemia": { "valor": 95, "unidade": "mg/dL", "referencia": "70-99" } }
  observacoes   text,
  criado_em     timestamptz DEFAULT now()
);

-- Consultas médicas
CREATE TABLE consultas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id     uuid REFERENCES pessoas(id),  -- NULL = Dr. Edson
  especialidade text NOT NULL,
  medico        text,
  data_consulta date NOT NULL,
  hora          time,
  local         text,
  motivo        text,
  diagnostico   text,
  prescricao    text,
  retorno_em    date,
  documento_id  uuid REFERENCES documentos(id),
  criado_em     timestamptz DEFAULT now()
);
CREATE INDEX idx_consultas_pessoa ON consultas(pessoa_id);
CREATE INDEX idx_consultas_data   ON consultas(data_consulta DESC);

-- Medicamentos em uso
CREATE TABLE medicamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id     uuid REFERENCES pessoas(id),  -- NULL = Dr. Edson
  nome          text NOT NULL,
  dosagem       text,            -- '500mg'
  frequencia    text,            -- '2x ao dia' | 'manhã e noite'
  inicio        date,
  fim           date,            -- NULL = uso contínuo
  prescrito_por text,
  observacoes   text,
  ativo         boolean DEFAULT true,
  criado_em     timestamptz DEFAULT now()
);
```

### 4.6 GRUPO: FINANCEIRO

```sql
-- Categorias financeiras
CREATE TABLE categorias_financeiras (
  id    serial PRIMARY KEY,
  nome  text NOT NULL UNIQUE,
  tipo  text NOT NULL,  -- 'receita' | 'despesa' | 'ambos'
  icone text DEFAULT '💰'
);
-- Seed inicial:
-- receita: Consultas, Procedimentos, Investimentos, Outros
-- despesa: Moradia, Alimentação, Saúde, Educação, Transporte, Lazer, Funcionários, Impostos, Outros

-- Lançamentos financeiros (MANTÉM o nome, refina os campos)
CREATE TABLE lancamentos_financeiros (
  id            bigserial PRIMARY KEY,
  tipo          text NOT NULL,   -- 'receita' | 'despesa'
  valor         numeric(12,2) NOT NULL,
  descricao     text NOT NULL,
  categoria_id  int REFERENCES categorias_financeiras(id),
  data          date NOT NULL DEFAULT CURRENT_DATE,
  conta         text DEFAULT 'principal',  -- 'principal' | 'poupança' | 'investimento'
  comprovante_id uuid REFERENCES documentos(id),  -- link para nota fiscal
  criado_em     timestamptz DEFAULT now()
);
CREATE INDEX idx_lancamentos_data ON lancamentos_financeiros(data DESC);
CREATE INDEX idx_lancamentos_tipo ON lancamentos_financeiros(tipo);

-- Metas (financeiras e pessoais)
CREATE TABLE metas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  descricao     text,
  icone         text DEFAULT '🎯',
  tipo          text DEFAULT 'financeiro',  -- 'financeiro' | 'saude' | 'habito' | 'pessoal'
  valor_meta    numeric(12,2) DEFAULT 0,
  valor_atual   numeric(12,2) DEFAULT 0,
  unidade       text DEFAULT 'R$',  -- 'R$' | 'kg' | 'dias' | '%' | etc.
  prazo         date,
  ativa         boolean DEFAULT true,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);
```

### 4.7 GRUPO: PRODUTIVIDADE

```sql
-- Tarefas
CREATE TABLE tarefas (
  id            bigserial PRIMARY KEY,
  texto         text NOT NULL,
  descricao     text,
  prioridade    text DEFAULT 'normal',  -- 'baixa' | 'normal' | 'alta' | 'urgente'
  concluida     boolean DEFAULT false,
  prazo         date,
  pessoa_id     uuid REFERENCES pessoas(id),  -- NULL = próprio
  criado_em     timestamptz DEFAULT now(),
  concluida_em  timestamptz
);

-- Anotações / notas rápidas
CREATE TABLE notas (
  id            bigserial PRIMARY KEY,
  texto         text NOT NULL,
  categoria     text DEFAULT 'geral',  -- 'geral' | 'clinica' | 'familia' | 'ideia'
  pessoa_id     uuid REFERENCES pessoas(id),
  criado_em     timestamptz DEFAULT now()
);

-- Hábitos diários
CREATE TABLE habitos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  descricao     text,
  icone         text DEFAULT '✅',
  frequencia    text DEFAULT 'diario',  -- 'diario' | 'semanal'
  dias_semana   int[],  -- [1,2,3,4,5] = seg a sex
  ativo         boolean DEFAULT true,
  criado_em     timestamptz DEFAULT now()
);

CREATE TABLE habitos_registro (
  id         bigserial PRIMARY KEY,
  habito_id  uuid REFERENCES habitos(id) ON DELETE CASCADE,
  data       date NOT NULL DEFAULT CURRENT_DATE,
  feito      boolean DEFAULT true,
  UNIQUE(habito_id, data)
);
```

### 4.8 GRUPO: INTEGRAÇÕES

```sql
-- Tokens OAuth (Google, TikTok, etc.)
CREATE TABLE oauth_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico       text NOT NULL UNIQUE,  -- 'google' | 'tiktok' | 'meta'
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  scopes        text[],
  atualizado_em timestamptz DEFAULT now()
);

-- Snapshots diários de métricas sociais
CREATE TABLE metricas_sociais (
  id            bigserial PRIMARY KEY,
  plataforma    text NOT NULL,   -- 'instagram' | 'facebook' | 'youtube' | 'tiktok'
  data          date NOT NULL DEFAULT CURRENT_DATE,
  seguidores    bigint,
  seguindo      bigint,
  posts         int,
  curtidas      bigint,
  alcance       bigint,
  impressoes    bigint,
  views         bigint,
  extras        jsonb DEFAULT '{}',  -- dados específicos da plataforma
  UNIQUE(plataforma, data)
);

-- Avaliações Google Meu Negócio
CREATE TABLE gmb_reviews (
  id              bigserial PRIMARY KEY,
  review_id       text UNIQUE NOT NULL,
  autor           text,
  nota            text,  -- 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comentario      text,
  data_avaliacao  timestamptz,
  respondida      boolean DEFAULT false,
  notificado      boolean DEFAULT false,
  criado_em       timestamptz DEFAULT now()
);
```

### 4.9 GRUPO: SISTEMA

```sql
-- Alertas do sistema
CREATE TABLE dashboard_alerts (
  id          text PRIMARY KEY,  -- ID gerado pelo cliente
  type        text NOT NULL,     -- 'critical' | 'warn' | 'info'
  message     text NOT NULL,
  source      text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  resolved    boolean DEFAULT false,
  resolved_at timestamptz,
  notified    boolean DEFAULT false,
  notified_at timestamptz
);
CREATE INDEX idx_alerts_resolved ON dashboard_alerts(resolved);

-- Briefings matinais enviados
CREATE TABLE morning_briefing (
  id          bigserial PRIMARY KEY,
  data        date UNIQUE NOT NULL,
  texto       text NOT NULL,
  enviado_wa  boolean DEFAULT false,
  criado_em   timestamptz DEFAULT now()
);

-- Logs do Supervisor IA
CREATE TABLE supervisor_logs (
  id          bigserial PRIMARY KEY,
  severidade  text NOT NULL,    -- 'info' | 'aviso' | 'erro' | 'corrigido'
  mensagem    text NOT NULL,
  componente  text NOT NULL,
  criado_em   timestamptz DEFAULT now()
);
```

### 4.10 TABELAS A REMOVER (após migração)

```sql
-- Estas tabelas existem hoje mas serão substituídas:
DROP TABLE IF EXISTS dados_assistente;  -- → substituída pelas tabelas tipadas acima
-- financas    → se existir, migrar para lancamentos_financeiros e DROP
-- transacoes  → se existir, migrar para lancamentos_financeiros e DROP
```

---

## 5. VARIÁVEIS DE AMBIENTE (Vercel)

```env
# Supabase
SUPABASE_URL=https://jaewjscbigfwjiaeavft.supabase.co
SUPABASE_ANON_KEY=<chave pública>
SUPABASE_SERVICE_KEY=<chave de serviço — para migrations e admin>

# Webhook / Auth
WEBHOOK_TOKEN=oc_edson_2026_secure

# IA
ANTHROPIC_API_KEY=<chave Anthropic>

# Google OAuth
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>

# Analytics / Social
GA4_PROPERTY_ID=<property id>
META_APP_ID=<app id>

# WhatsApp — USAR APENAS OpenClaw (remover Meta API do cron)
OPENCLAW_TOKEN=<token OpenClaw>
PHONE_BRIEFING=5516992943215

# Storage
SUPABASE_STORAGE_BUCKET=documentos
```

---

## 6. LIBS COMPARTILHADAS A CRIAR

### `api/lib/supabase.js`
```js
// Centraliza toda comunicação com Supabase
// Exporta: sb(path, opts), sbGet(table, query), sbPost(table, data), sbPatch(table, id, data)
// Usado por: todos os handlers
```

### `api/lib/google-auth.js`
```js
// Gerencia tokens Google
// Exporta: getRefreshToken(), refreshAccessToken(rt), getValidToken()
// Sempre busca refresh_token do Supabase (tabela oauth_tokens onde servico='google')
// Nunca aceita token do body do cliente
```

### `api/lib/openclaw.js`
```js
// Já existe — manter, é o único canal WhatsApp
// Remover envio via Meta API do cron.js
```

### `api/lib/ia.js`
```js
// Centraliza chamadas à Anthropic API
// Exporta: chat(messages, tools?), runAgent(messages, tools, maxIter)
// Usado por: supervisor.js, assistente.js, analisa-foto.js
```

---

## 7. VERCEL.JSON — VERSÃO CORRIGIDA

```json
{
  "version": 2,
  "name": "dashboard-pessoal-edson",
  "buildCommand": "",
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/oauth/google",               "destination": "/api/oauth/google" },
    { "source": "/oauth/tiktok",               "destination": "/api/oauth/tiktok" },
    { "source": "/api/webhook",                "destination": "/api/webhook" },
    { "source": "/api/comandos",               "destination": "/api/comandos" },
    { "source": "/api/ask",                    "destination": "/api/ask" },
    { "source": "/api/supervisor",             "destination": "/api/supervisor" },
    { "source": "/api/assistente",             "destination": "/api/assistente" },
    { "source": "/api/analisa-foto",           "destination": "/api/analisa-foto" },
    { "source": "/api/legendarios",            "destination": "/api/legendarios" },
    { "source": "/api/cron",                   "destination": "/api/cron" },
    { "source": "/api/alerts",                 "destination": "/api/alerts" },
    { "source": "/api/alerts/sync",            "destination": "/api/alerts" },
    { "source": "/api/alerts/resolve",         "destination": "/api/alerts" },
    { "source": "/api/alerts/stats",           "destination": "/api/alerts" },
    { "source": "/api/whatsapp/test",          "destination": "/api/whatsapp/test" },
    { "source": "/api/config",                 "destination": "/api/config" },
    { "source": "/api/google/token",           "destination": "/api/google/token" },
    { "source": "/api/google/refresh",         "destination": "/api/google/refresh" },
    { "source": "/api/google/calendar",        "destination": "/api/google/calendar" },
    { "source": "/api/google/calendar-create", "destination": "/api/google/calendar-create" },
    { "source": "/api/google/gmail",           "destination": "/api/google/gmail" },
    { "source": "/api/google/drive",           "destination": "/api/google/drive" },
    { "source": "/api/tiktok/token",           "destination": "/api/tiktok/token" },
    { "source": "/api/docs",                   "destination": "/api/docs" },
    { "source": "/api/saude",                  "destination": "/api/saude" },
    { "source": "/api/familia",                "destination": "/api/familia" },
    { "source": "/api/financeiro",             "destination": "/api/financeiro" },
    { "source": "/api/habitos",                "destination": "/api/habitos" },
    { "source": "/api/memorias",               "destination": "/api/memorias" },
    { "source": "/login",                      "destination": "/login.html" },
    { "source": "/",                           "destination": "/dashboard.html" }
  ]
}
```

---

## 8. NOVOS ENDPOINTS A CRIAR

### `POST /api/docs` — Upload e gestão de documentos
```
POST /api/docs/upload        → recebe arquivo (base64 ou multipart), salva no Storage, cria registro
GET  /api/docs               → lista documentos com filtros (categoria, pessoa, data)
GET  /api/docs/:id           → detalhe de um documento
POST /api/docs/from-whatsapp → recebe arquivo via webhook OpenClaw (foto/PDF do WA)
DELETE /api/docs/:id         → remove documento e arquivo do Storage
```

### `POST /api/saude` — Saúde pessoal e familiar
```
GET  /api/saude/exames          → lista exames (filtro por pessoa)
POST /api/saude/exames          → cria exame
GET  /api/saude/consultas       → lista consultas
POST /api/saude/consultas       → cria consulta
GET  /api/saude/medicamentos    → medicamentos ativos
POST /api/saude/medicamentos    → cria medicamento
```

### `GET /api/familia` — Pessoas da família
```
GET  /api/familia               → lista pessoas cadastradas
POST /api/familia               → cria pessoa (esposa, filho, etc.)
PUT  /api/familia/:id           → atualiza pessoa
```

### `POST /api/financeiro` — Lançamentos financeiros
```
GET  /api/financeiro            → resumo do mês (receitas, despesas, saldo)
GET  /api/financeiro/lancamentos → lista lançamentos com filtros
POST /api/financeiro/lancamentos → cria lançamento
GET  /api/financeiro/relatorio  → relatório por período
```

### `GET /api/habitos` — Tracking de hábitos
```
GET  /api/habitos               → lista hábitos ativos
POST /api/habitos               → cria hábito
POST /api/habitos/:id/registrar → registra cumprimento do dia
GET  /api/habitos/hoje          → quais hábitos faltam hoje
```

### `GET /api/memorias` — Memória da IA
```
GET  /api/memorias              → lista memórias (filtro por categoria)
POST /api/memorias              → salva nova memória
DELETE /api/memorias/:id        → remove memória
```

---

## 9. FLUXO DE VOZ (WHATSAPP → IA)

```
Usuário envia áudio no WhatsApp
          ↓
OpenClaw recebe e transcreve (já faz isso nativamente)
          ↓
POST /api/webhook  { tipo: 'voz', texto: 'texto transcrito' }
          ↓
webhook.js → salva em comandos → chama assistente.js internamente
          ↓
assistente.js → detecta intent → executa ação → resposta
          ↓
api/lib/openclaw.js → sendWhatsApp(numero, resposta)
```

**Nota:** O OpenClaw já transcreve áudio automaticamente. O campo `texto` no webhook já chega como texto mesmo para mensagens de voz. Não é necessário integrar Whisper.

---

## 10. FLUXO DE DOCUMENTO (WHATSAPP → STORAGE)

```
Usuário envia foto/PDF no WhatsApp com legenda
Ex: "exame de sangue 2026" ou "conta de luz março"
          ↓
OpenClaw recebe → POST /api/docs/from-whatsapp
  body: { arquivo_base64, nome_arquivo, legenda, de }
          ↓
api/docs.js:
  1. Detecta categoria pela legenda (exame/conta/contrato/etc.)
  2. Faz OCR via Claude Vision (se imagem)
  3. Upload para Supabase Storage (bucket: documentos)
  4. Cria registro na tabela documentos
  5. Responde via WhatsApp: "✅ Documento salvo: Exame de Sangue - 10/05/2026"
```

---

## 11. SISTEMA DE MEMÓRIA DA IA

### Como funciona
A IA (assistente.js e supervisor.js) mantém memória de longo prazo via tabela `memorias_ia`.

### Gatilhos de criação de memória
- Usuário diz algo sobre si mesmo: "tenho diabetes tipo 2" → salva em `saude`
- Usuário revela preferência: "prefiro reuniões após as 15h" → salva em `preferencia`
- Padrão financeiro detectado: gasto recorrente identificado → salva em `financeiro`
- Dado familiar relevante: "meu filho tem 8 anos" → salva em `familia`

### Como a IA usa a memória
Antes de responder, `assistente.js` carrega as memórias mais relevantes (top 10 por importância) e injeta no system prompt do Claude:

```
Contexto sobre o Dr. Edson:
- [saude] Tem diabetes tipo 2 controlada
- [preferencia] Prefere reuniões após 15h
- [familia] Filho João, 8 anos; Esposa Ana
- [profissional] Cardiologista, consultório em São Paulo
```

---

## 12. SUB-PROJETOS E ORDEM DE IMPLEMENTAÇÃO

### SP-1: Schema Foundation ← COMEÇAR AQUI
**Entregável:** Todas as tabelas criadas no Supabase, dados existentes migrados
**Tarefas:**
1. Criar todas as tabelas novas (SQL acima)
2. Migrar dados de `dados_assistente` para tabelas tipadas
3. Migrar `financas`/`transacoes` para `lancamentos_financeiros` (se existirem)
4. Criar bucket `documentos` no Supabase Storage
5. Configurar RLS básico (anon key lê/escreve tudo por enquanto)
6. Dropar tabelas legadas após validar migração

### SP-2: API Layer Fix
**Entregável:** Código limpo, sem duplicações, todas as rotas funcionando
**Tarefas:**
1. Criar `api/lib/supabase.js` com função `sb()` compartilhada
2. Criar `api/lib/google-auth.js` centralizado
3. Criar `api/lib/ia.js` para chamadas Anthropic
4. Atualizar todos os handlers para usar as libs
5. Remover envio WhatsApp via Meta API do `cron.js` → usar OpenClaw
6. Corrigir `supervisor.js` para checar tabelas corretas
7. Atualizar `vercel.json` com todas as rotas
8. Corrigir `server.js` local para usar Supabase (não `comandos.json`)

### SP-3: Documentos & Storage
**Entregável:** Upload via WhatsApp e dashboard funcionando
**Tarefas:**
1. Criar `api/docs.js` com todos os endpoints
2. Integrar Claude Vision para OCR automático
3. Adaptar `api/analisa-foto.js` para usar o novo fluxo
4. Adicionar widget "Documentos" no dashboard.html
5. Testar fluxo WhatsApp → foto → storage

### SP-4: Saúde & Família
**Entregável:** Prontuário pessoal + familiar operacional
**Tarefas:**
1. Criar `api/saude.js`
2. Criar `api/familia.js`
3. Adicionar intents no `assistente.js`: `ler_saude`, `add_exame`, `ler_medicamentos`
4. Adicionar widgets no dashboard.html

### SP-5: Memória da IA
**Entregável:** IA que lembra e aprende
**Tarefas:**
1. Criar `api/memorias.js`
2. Modificar `assistente.js` para carregar memórias relevantes no system prompt
3. Adicionar detecção automática de memórias nas respostas
4. Criar `api/perfil.js` para gerenciar o perfil fixo
5. Expor tela de memórias no dashboard

### SP-6: Financeiro Completo
**Entregável:** Gestão financeira com categorias, relatórios e projeções
**Tarefas:**
1. Popular tabela `categorias_financeiras` com seed
2. Criar `api/financeiro.js` com relatórios por período
3. Migrar intents financeiros do `assistente.js` para usar novo schema
4. Adicionar widget financeiro expandido no dashboard

### SP-7: Hábitos & Rotina
**Entregável:** Tracking de hábitos com notificação diária
**Tarefas:**
1. Criar `api/habitos.js`
2. Adicionar no `cron.js` tipo `habitos` → cobra hábitos não registrados às 21h
3. Adicionar widget de hábitos no dashboard

---

## 13. CONTEXTO PARA OUTRA LLM

### O que passar junto com este documento:
1. O relatório completo do estado atual (gerado anteriormente)
2. Este spec
3. Os arquivos: `api/lib/openclaw.js`, `api/alerts.js`, `api/webhook.js` (referências de padrão)
4. O `vercel.json` atual (para comparar com o corrigido)

### Instrução para a LLM implementadora:
> "Você está implementando o sistema 'Segundo Eu' do Dr. Edson Barroso — um dashboard pessoal completo. O projeto está em `dashboard-pessoal/` no Vercel. O banco é Supabase. Use ESM (`export default`) em todas as Vercel Functions. Siga a ordem SP-1 → SP-2 → SP-3... Comece sempre pelo SP-1 (schema). Não quebre as APIs que já funcionam. O canal WhatsApp é OpenClaw exclusivamente — não use Meta Business API diretamente."

---

## 14. CHECKLIST DE VALIDAÇÃO (pós SP-1 e SP-2)

```
[ ] Todas as tabelas existem no Supabase com os campos corretos
[ ] Tabela dados_assistente removida após migração
[ ] api/lib/supabase.js criada e usada por todos os handlers
[ ] api/lib/google-auth.js sempre busca token do Supabase
[ ] vercel.json com todas as rotas
[ ] /api/ask responde em produção (Vercel)
[ ] /api/google/calendar-create responde em produção
[ ] cron.js enviando via OpenClaw (não Meta API)
[ ] supervisor.js checando tabelas corretas
[ ] Servidor local (server.js) usando Supabase (não comandos.json)
[ ] Bucket 'documentos' criado no Storage
[ ] Briefing matinal chegando no WhatsApp
[ ] Alertas críticos chegando no WhatsApp
```
