/**
 * api/supervisor.js — Supervisor IA do Dashboard Pessoal
 *
 * Agente Claude com ferramentas reais: monitora, diagnostica e corrige
 * automaticamente os componentes do dashboard do Dr. Edson Barroso.
 *
 * POST /api/supervisor
 *   Body: { "mensagem": "verifique tudo", "historico": [...] }
 *   Headers: X-Webhook-Token: oc_edson_2026_secure
 *
 * GET /api/supervisor/status
 *   Retorna última varredura e saúde geral
 */

const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY || '';
const SUPABASE_URL   = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON  = process.env.SUPABASE_ANON_KEY  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZXdqc2NiaWdmd2ppYWVhdmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTUwNDksImV4cCI6MjA4Nzg5MTA0OX0.xLo3VVkQmItv9Q7vQ_U_i60FXQj8FzSogwVBfbAPbfU';
const GOOGLE_ID      = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_SECRET  = process.env.GOOGLE_CLIENT_SECRET || '';
const WEBHOOK_TOKEN  = process.env.WEBHOOK_TOKEN || 'oc_edson_2026_secure';

// ── Supabase helper ───────────────────────────────────────
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  try { return await r.json(); } catch { return null; }
}

// ── Google OAuth helpers ──────────────────────────────────
async function getRefreshToken() {
  const rows = await sb('/oauth_tokens?select=refresh_token&servico=eq.google&limit=1');
  return rows?.[0]?.refresh_token || null;
}

async function refreshGoogleToken(rt) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET,
      refresh_token: rt, grant_type: 'refresh_token',
    }).toString(),
  });
  return await r.json();
}

// ══ FERRAMENTAS DO AGENTE ════════════════════════════════

const TOOLS = [
  {
    name: 'verificar_google_oauth',
    description: 'Verifica se o token OAuth do Google está válido e tenta renová-lo automaticamente se expirado. Retorna status e escopos disponíveis.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'verificar_supabase',
    description: 'Verifica o estado do banco Supabase: tabelas existentes, tokens OAuth salvos, tarefas, finanças e metas.',
    input_schema: {
      type: 'object',
      properties: {
        tabela: { type: 'string', description: 'Tabela específica para inspecionar (opcional). Ex: oauth_tokens, tarefas, financas, metas' },
      },
      required: [],
    },
  },
  {
    name: 'executar_comando_dashboard',
    description: 'Executa um comando do dashboard e retorna o resultado. Comandos: agenda, emails, drive, tarefas, financas, metas, resumo.',
    input_schema: {
      type: 'object',
      properties: {
        comando: { type: 'string', description: 'Comando a executar: agenda | emails | drive | tarefas | financas | metas | resumo' },
      },
      required: ['comando'],
    },
  },
  {
    name: 'verificar_saude_servicos',
    description: 'Faz ping nos serviços do dashboard: Supabase, Google OAuth, OpenClaw webhook, e verifica variáveis de ambiente críticas.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'registrar_incidente',
    description: 'Registra um incidente, alerta ou ação de reparo no log do Supabase para auditoria.',
    input_schema: {
      type: 'object',
      properties: {
        severidade: { type: 'string', enum: ['info', 'aviso', 'erro', 'corrigido'] },
        mensagem:   { type: 'string', description: 'Descrição do incidente ou ação' },
        componente: { type: 'string', description: 'Componente afetado: google, supabase, openclaw, dashboard, etc.' },
      },
      required: ['severidade', 'mensagem', 'componente'],
    },
  },
  {
    name: 'listar_logs',
    description: 'Lista os últimos incidentes e ações registrados pelo Supervisor.',
    input_schema: {
      type: 'object',
      properties: {
        limite: { type: 'number', description: 'Quantos registros retornar (padrão 10)' },
      },
      required: [],
    },
  },
];

// ══ IMPLEMENTAÇÃO DAS FERRAMENTAS ════════════════════════

async function tool_verificar_google_oauth() {
  const rt = await getRefreshToken();
  if (!rt) return { ok: false, status: 'token_nao_encontrado', mensagem: 'Refresh token do Google não encontrado no Supabase. O Dr. Edson precisa reconectar o Google no dashboard.' };

  const data = await refreshGoogleToken(rt);
  if (data.access_token) {
    // Testa o token buscando perfil
    const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    }).then(r => r.json()).catch(() => null);

    return {
      ok: true,
      status: 'token_valido',
      email: profile?.email || 'desconhecido',
      escopos: data.scope || 'não informado',
      expira_em: data.expires_in ? `${Math.floor(data.expires_in / 60)} minutos` : 'desconhecido',
      mensagem: `Token Google válido para ${profile?.email || 'conta desconhecida'}`,
    };
  }

  return {
    ok: false,
    status: 'falha_renovacao',
    erro: data.error || 'desconhecido',
    mensagem: `Falha ao renovar token Google: ${data.error_description || data.error || 'erro desconhecido'}. Reconecte o Google no dashboard.`,
  };
}

async function tool_verificar_supabase({ tabela }) {
  const tabelas = tabela
    ? [tabela]
    : ['oauth_tokens', 'tarefas', 'financas', 'metas', 'transacoes', 'supervisor_logs'];

  const resultados = {};
  for (const t of tabelas) {
    const rows = await sb(`/${t}?select=*&limit=3`);
    if (Array.isArray(rows)) {
      resultados[t] = { ok: true, registros: rows.length, amostra: rows.slice(0, 2) };
    } else {
      resultados[t] = { ok: false, erro: rows?.message || rows?.code || 'tabela não existe ou sem acesso' };
    }
  }

  return { ok: true, tabelas: resultados };
}

async function tool_executar_comando_dashboard({ comando }) {
  // Chama o próprio endpoint /api/comandos internamente
  const baseUrl = 'https://dashboard-pessoal-edson.vercel.app';
  try {
    const r = await fetch(`${baseUrl}/api/comandos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Token': WEBHOOK_TOKEN,
      },
      body: JSON.stringify({ texto: comando }),
    });
    const data = await r.json();
    return { ok: true, resultado: data.resposta || data };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

async function tool_verificar_saude_servicos() {
  const checks = {};

  // Supabase
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/oauth_tokens?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      signal: AbortSignal.timeout(5000),
    });
    checks.supabase = { ok: r.ok, status: r.status };
  } catch (e) {
    checks.supabase = { ok: false, erro: e.message };
  }

  // Google OAuth
  const rt = await getRefreshToken();
  checks.google_token = { ok: !!rt, mensagem: rt ? 'Refresh token presente' : 'Token não encontrado' };

  // Variáveis de ambiente
  checks.env = {
    ANTHROPIC_API_KEY: !!ANTHROPIC_KEY,
    GOOGLE_CLIENT_ID:  !!GOOGLE_ID,
    GOOGLE_CLIENT_SECRET: !!GOOGLE_SECRET,
    WEBHOOK_TOKEN:     !!WEBHOOK_TOKEN,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  };

  const falhas = Object.entries(checks.env).filter(([, v]) => !v).map(([k]) => k);
  checks.env_status = falhas.length === 0
    ? 'Todas as variáveis configuradas ✅'
    : `Variáveis faltando: ${falhas.join(', ')}`;

  // Dashboard público
  try {
    const r = await fetch('https://dashboard-pessoal-edson.vercel.app/api/comandos', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    checks.dashboard_api = { ok: r.ok, status: r.status };
  } catch (e) {
    checks.dashboard_api = { ok: false, erro: e.message };
  }

  return checks;
}

async function tool_registrar_incidente({ severidade, mensagem, componente }) {
  await sb('/supervisor_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      severidade,
      mensagem,
      componente,
      criado_em: new Date().toISOString(),
    }),
  });
  return { ok: true, registrado: true };
}

async function tool_listar_logs({ limite = 10 }) {
  const rows = await sb(`/supervisor_logs?select=*&order=criado_em.desc&limit=${limite}`);
  if (Array.isArray(rows)) return { ok: true, logs: rows };
  // Tabela pode não existir ainda
  return { ok: false, mensagem: 'Tabela supervisor_logs não encontrada. Crie-a no Supabase com: id serial, severidade text, mensagem text, componente text, criado_em timestamptz.' };
}

// ── Executar ferramenta pelo nome ─────────────────────────
async function executarFerramenta(nome, input) {
  switch (nome) {
    case 'verificar_google_oauth':       return tool_verificar_google_oauth();
    case 'verificar_supabase':           return tool_verificar_supabase(input);
    case 'executar_comando_dashboard':   return tool_executar_comando_dashboard(input);
    case 'verificar_saude_servicos':     return tool_verificar_saude_servicos();
    case 'registrar_incidente':          return tool_registrar_incidente(input);
    case 'listar_logs':                  return tool_listar_logs(input);
    default: return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

// ══ LOOP AGENTE CLAUDE ════════════════════════════════════

const SYSTEM = `Você é o Supervisor IA do Dashboard Pessoal do Dr. Edson Barroso (médico).
Você monitora, diagnostica e corrige automaticamente todos os componentes do dashboard.

Componentes sob sua supervisão:
- Google Calendar, Gmail, Google Drive (tokens OAuth no Supabase)
- Supabase (banco de dados principal)
- OpenClaw/WhatsApp Business (webhooks e comandos)
- Widgets: Instagram, Facebook, TikTok, YouTube, Google Analytics
- Finanças, Tarefas, Metas pessoais
- VPS Hostinger + n8n + EasyPanel + Evolution API + Chatwoot
- Dashboard Vercel: dashboard-pessoal-edson.vercel.app

Seu comportamento:
1. Quando detectar problemas, tente corrigi-los automaticamente usando as ferramentas
2. Registre todos os incidentes e correções com registrar_incidente
3. Seja proativo: se algo puder quebrar, avise antes
4. Responda sempre em português brasileiro, de forma clara e objetiva
5. Para problemas que requerem ação humana, explique exatamente o que fazer

Você tem acesso ao Claude Code (meu criador) via integração — se um problema for complexo demais, indique que pode ser escalado para análise de código.`;

async function rodarAgente(mensagens) {
  if (!ANTHROPIC_KEY) {
    return '⚠️ ANTHROPIC_API_KEY não configurada. Adicione nas variáveis de ambiente do Vercel.';
  }

  let msgs = [...mensagens];
  let iteracoes = 0;
  const MAX_ITER = 8;

  while (iteracoes < MAX_ITER) {
    iteracoes++;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM,
        tools: TOOLS,
        messages: msgs,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${err}`);
    }

    const data = await resp.json();

    // Adiciona resposta do assistente ao histórico
    msgs.push({ role: 'assistant', content: data.content });

    // Terminou
    if (data.stop_reason === 'end_turn') {
      const texto = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
      return texto;
    }

    // Processa tool_use
    if (data.stop_reason === 'tool_use') {
      const toolUses = data.content.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const tu of toolUses) {
        let resultado;
        try {
          resultado = await executarFerramenta(tu.name, tu.input || {});
        } catch (e) {
          resultado = { erro: e.message };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(resultado),
        });
      }

      msgs.push({ role: 'user', content: toolResults });
      continue;
    }

    // Qualquer outro stop_reason
    break;
  }

  return '⚠️ Agente atingiu limite de iterações. Tente novamente com uma pergunta mais específica.';
}

// ══ CORS ══════════════════════════════════════════════════
function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Token',
  };
}

// ══ HANDLER PRINCIPAL ════════════════════════════════════

export default async function handler(req, res) {
  Object.entries(cors()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET /api/supervisor → status rápido
  if (req.method === 'GET') {
    try {
      const saude = await tool_verificar_saude_servicos();
      const logs  = await tool_listar_logs({ limite: 5 });
      return res.status(200).json({ ok: true, saude, logs: logs.logs || [], ts: new Date().toISOString() });
    } catch (e) {
      return res.status(200).json({ ok: false, erro: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Autenticação
  const token = req.headers['x-webhook-token'] || req.body?.token;
  if (token !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Token inválido' });

  const { mensagem, historico = [] } = req.body || {};
  if (!mensagem) return res.status(400).json({ error: 'Campo "mensagem" obrigatório' });

  try {
    // Monta histórico de conversas
    const msgs = [
      ...historico.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: mensagem },
    ];

    const resposta = await rodarAgente(msgs);
    return res.status(200).json({ ok: true, resposta, ts: new Date().toISOString() });
  } catch (e) {
    console.error('[supervisor] Erro:', e.message);
    return res.status(500).json({ ok: false, erro: e.message });
  }
}
