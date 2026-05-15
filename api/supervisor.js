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

import { adminFetch } from './_supabase-admin.js';

const OPENAI_KEY     = process.env.OPENAI_API_KEY || '';
const SUPABASE_URL   = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON  = process.env.SUPABASE_ANON_KEY || '';
const GOOGLE_ID      = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_SECRET  = process.env.GOOGLE_CLIENT_SECRET || '';

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
  const rows = await adminFetch('/oauth_tokens?select=refresh_token&servico=eq.google&limit=1');
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
    type: 'function',
    function: {
      name: 'verificar_google_oauth',
      description: 'Verifica se o token OAuth do Google está válido e tenta renová-lo automaticamente se expirado. Retorna status e escopos disponíveis.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_supabase',
      description: 'Verifica o estado do banco Supabase: tabelas existentes, tokens OAuth salvos, tarefas, finanças e metas.',
      parameters: {
        type: 'object',
        properties: {
          tabela: { type: 'string', description: 'Tabela específica para inspecionar (opcional). Ex: oauth_tokens, tarefas, financas, metas' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'executar_comando_dashboard',
      description: 'Executa um comando do dashboard e retorna o resultado. Comandos: agenda, emails, drive, tarefas, financas, metas, resumo.',
      parameters: {
        type: 'object',
        properties: {
          comando: { type: 'string', description: 'Comando a executar: agenda | emails | drive | tarefas | financas | metas | resumo' },
        },
        required: ['comando'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_saude_servicos',
      description: 'Faz ping nos serviços do dashboard: Supabase, Google OAuth, OpenClaw webhook, e verifica variáveis de ambiente críticas.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_incidente',
      description: 'Registra um incidente, alerta ou ação de reparo no log do Supabase para auditoria.',
      parameters: {
        type: 'object',
        properties: {
          severidade: { type: 'string', enum: ['info', 'aviso', 'erro', 'corrigido'] },
          mensagem:   { type: 'string', description: 'Descrição do incidente ou ação' },
          componente: { type: 'string', description: 'Componente afetado: google, supabase, openclaw, dashboard, etc.' },
        },
        required: ['severidade', 'mensagem', 'componente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_logs',
      description: 'Lista os últimos incidentes e ações registrados pelo Supervisor.',
      parameters: {
        type: 'object',
        properties: {
          limite: { type: 'number', description: 'Quantos registros retornar (padrão 10)' },
        },
        required: [],
      },
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
      resultados[t] = { ok: true, registros: rows.length };
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
        'X-Webhook-Token': process.env.WEBHOOK_TOKEN || '',
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
    const rows = await adminFetch('/oauth_tokens?select=id&limit=1');
    checks.supabase = { ok: rows !== null, status: rows !== null ? 200 : 403 };
  } catch (e) {
    checks.supabase = { ok: false, erro: e.message };
  }

  // Google OAuth
  const rt = await getRefreshToken();
  checks.google_token = { ok: !!rt, mensagem: rt ? 'Refresh token presente' : 'Token não encontrado' };

  // Variáveis de ambiente
  checks.env = {
    OPENAI_API_KEY: !!OPENAI_KEY,
    GOOGLE_CLIENT_ID:  !!GOOGLE_ID,
    GOOGLE_CLIENT_SECRET: !!GOOGLE_SECRET,
    WEBHOOK_TOKEN:     !!process.env.WEBHOOK_TOKEN,
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

// Redacts strings that look like tokens/secrets before writing or returning logs.
function scrubSecrets(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/EAA[A-Za-z0-9]{30,}/g, '[TOKEN_REDACTED]')
    .replace(/ya29\.[A-Za-z0-9._-]{30,}/g, '[TOKEN_REDACTED]')
    .replace(/ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]{10,}/g, '[TOKEN_REDACTED]')
    .replace(/[A-Za-z0-9]{50,}/g, '[TOKEN_REDACTED]');
}

async function tool_registrar_incidente({ severidade, mensagem, componente }) {
  await sb('/supervisor_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      severidade,
      mensagem: scrubSecrets(mensagem),
      componente,
      criado_em: new Date().toISOString(),
    }),
  });
  return { ok: true, registrado: true };
}

async function tool_listar_logs({ limite = 10 }) {
  const rows = await sb(`/supervisor_logs?select=*&order=criado_em.desc&limit=${limite}`);
  if (Array.isArray(rows)) {
    const safe = rows.map(r => ({ ...r, mensagem: scrubSecrets(r.mensagem) }));
    return { ok: true, logs: safe };
  }
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

const SYSTEM = `Você é o Supervisor IA do Dashboard Pessoal do Dr. Edson Barroso.
Modelo: GPT-4.1-mini. Foco: diagnóstico operacional e auto-reparo pragmático.

FLUXO OBRIGATÓRIO:
SCAN → DIAGNÓSTICO → TENTATIVA DE REPARO → VALIDAÇÃO → RELATÓRIO

CLASSIFICAÇÃO DE SEVERIDADE:
- CRÍTICO: serviço offline, token inválido, dados inacessíveis — reparo imediato
- MÉDIO: endpoint lento, sync falhou, cache corrompido — reparo na próxima rodada
- AVISO: serviço degradado, configuração incorreta — monitorar
- INFORMATIVO: atualização disponível, otimização possível — opcional

CATEGORIAS DE ERRO QUE VOCÊ DETECTA:
- endpoint offline / timeout / HTTP 5xx
- token expirado / auth inválido / OAuth quebrado
- sync falhou / dados desatualizados
- erro de API externa (Google, Meta, OpenAI)
- erro de OCR / análise de foto
- erro mobile/PWA / service worker
- erro de integração webhook
- crescimento de tabela / sem TTL

COMPONENTES SOB SUPERVISÃO:
- Google: Calendar, Gmail, Drive (tokens OAuth no Supabase)
- Meta: Instagram, Facebook (token 60min no localStorage)
- Supabase: tabelas, sync, dados_assistente
- APIs: OpenAI (GPT), WhatsApp Business
- Dashboard Vercel: dashboard-pessoal-edson.vercel.app

COMPORTAMENTO:
1. Siga o fluxo SCAN→DIAGNÓSTICO→REPARO→VALIDAÇÃO→RELATÓRIO sempre
2. Classifique cada problema com CRÍTICO/MÉDIO/AVISO/INFORMATIVO
3. Tente reparar automaticamente o que for seguro
4. Registre com registrar_incidente todos os incidentes e reparos
5. Se não resolver: forneça prompt pronto para escalar ao desenvolvedor
6. Responda em português brasileiro, objetivo, sem verbosidade

RESTRIÇÕES — NUNCA FAÇA:
- SQL que destrói dados ou schema (qualquer DDL/DML irreversível)
- Alterar OAuth, RLS, certificados ou chaves de ambiente
- Deletar dados de produção
- Refatoração automática de código
- Operações irreversíveis sem confirmação humana

SEGURANÇA: nunca inclua tokens, senhas ou strings longas de autenticação nas mensagens. Use '[TOKEN PRESENTE]' para indicar credenciais.

FORMATO DE RESPOSTA PARA INCIDENTES:
Causa raiz: [descrição objetiva]
Severidade: [CRÍTICO|MÉDIO|AVISO|INFORMATIVO]
Ação executada: [o que foi feito]
Resultado: [resolvido|falhou|pendente]
Próximo passo: [ação recomendada se necessário]`;

async function rodarAgente(mensagens) {
  if (!OPENAI_KEY) {
    return '⚠️ OPENAI_API_KEY não configurada. Adicione nas variáveis de ambiente do Vercel.';
  }

  let msgs = [{ role: 'system', content: SYSTEM }, ...mensagens];
  let iteracoes = 0;
  const MAX_ITER = 8;

  while (iteracoes < MAX_ITER) {
    iteracoes++;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        max_tokens: 4096,
        tools: TOOLS,
        messages: msgs,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) break;

    // Adiciona resposta ao histórico
    msgs.push(msg);

    // Terminou
    if (choice.finish_reason === 'stop') {
      return msg.content || '';
    }

    // Processa tool_calls
    if (choice.finish_reason === 'tool_calls' && msg.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        let resultado;
        try {
          const input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          resultado = await executarFerramenta(tc.function.name, input);
        } catch (e) {
          resultado = { erro: e.message };
        }
        msgs.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(resultado),
        });
      }
      continue;
    }

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

  // Autenticação — obrigatória para GET e POST
  const webhookToken = process.env.WEBHOOK_TOKEN || '';
  if (!webhookToken) return res.status(500).json({ error: 'WEBHOOK_TOKEN nao configurado' });
  const token = req.headers['x-webhook-token'] || req.body?.token;
  if (token !== webhookToken) return res.status(401).json({ error: 'Token inválido' });

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

export { tool_verificar_supabase };
