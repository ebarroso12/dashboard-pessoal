/**
 * api/webhook.js — Vercel Serverless Function
 * Recebe comandos de voz do OpenClaw via WhatsApp
 * Armazena permanentemente no Supabase
 *
 * POST /api/webhook
 *   Headers: X-Webhook-Token: <token>
 *   Body JSON: { tipo, texto, resposta, de, token }
 *
 * GET /api/webhook
 *   Retorna últimos 20 comandos do Supabase
 */

const SUPABASE_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Token',
  };
}

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

export default async function handler(req, res) {
  // CORS headers em todas as respostas
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!SUPABASE_ANON) {
    return res.status(500).json({ error: 'Configuração incompleta: SUPABASE_ANON_KEY ausente' });
  }

  // ── GET — retorna últimos 20 comandos
  if (req.method === 'GET') {
    const result = await supabaseFetch('/comandos?select=*&order=ts.desc&limit=20');
    if (!result.ok) {
      res.status(500).json({ error: 'Erro ao buscar comandos', detail: result.data });
      return;
    }
    res.status(200).json(result.data);
    return;
  }

  // ── POST — recebe novo comando do OpenClaw
  if (req.method === 'POST') {
    const body          = req.body || {};
    const webhookToken = process.env.WEBHOOK_TOKEN || '';
    if (!webhookToken) { res.status(500).json({ error: 'WEBHOOK_TOKEN nao configurado' }); return; }
    const tokenRecebido = req.headers['x-webhook-token'] || body.token || '';

    // Valida token de segurança
    if (tokenRecebido !== webhookToken) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }

    // Insere no Supabase
    const novo = {
      tipo:     body.tipo     || (body.audio ? 'voz' : 'texto'),
      texto:    body.texto    || body.text     || '',
      resposta: body.resposta || body.response || '',
      de:       body.de       || body.from     || 'WhatsApp',
      status:   body.status   || 'ok',
    };

    const result = await supabaseFetch('/comandos', {
      method: 'POST',
      body:   JSON.stringify(novo),
    });

    if (!result.ok) {
      res.status(500).json({ error: 'Erro ao salvar comando', detail: result.data });
      return;
    }

    const salvo = Array.isArray(result.data) ? result.data[0] : result.data;
    console.log(`🦞 OpenClaw [${novo.tipo.toUpperCase()}]: "${novo.texto.substring(0, 60)}"`);
    res.status(200).json({ ok: true, id: salvo?.id });
    return;
  }

  res.status(405).json({ error: 'Método não permitido' });
}
