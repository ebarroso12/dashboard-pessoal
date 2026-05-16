/**
 * api/dashboard-proxy.js
 *
 * POST /api/dashboard-proxy
 * Body: { action, payload }
 *
 * Whitelist de actions:
 *   assistente        -> POST /api/assistente
 *   supervisor-chat   -> POST /api/supervisor
 *   supervisor-status -> GET  /api/supervisor
 *
 * Adiciona WEBHOOK_TOKEN internamente. Nao exige token do frontend.
 * CORS restrito ao dominio do dashboard.
 */

const BASE_URL       = 'https://dashboard-pessoal-edson.vercel.app';
const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';

function cors() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req, res) {
  Object.entries(cors()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.WEBHOOK_TOKEN || '';
  if (!token) return res.status(500).json({ error: 'WEBHOOK_TOKEN nao configurado' });

  const { action, payload = {} } = req.body || {};

  if (!action) return res.status(400).json({ error: 'action obrigatoria' });

  let targetUrl, targetMethod, targetBody;

  switch (action) {

    case 'assistente': {
      const { q, origem } = payload;
      if (!q || typeof q !== 'string' || !q.trim()) {
        return res.status(400).json({ error: 'payload.q obrigatorio para action assistente' });
      }
      targetUrl    = `${BASE_URL}/api/assistente`;
      targetMethod = 'POST';
      targetBody   = { q, ...(origem ? { origem: String(origem) } : {}) };
      break;
    }

    case 'supervisor-chat': {
      const { mensagem, historico } = payload;
      if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
        return res.status(400).json({ error: 'payload.mensagem obrigatorio para action supervisor-chat' });
      }
      targetUrl    = `${BASE_URL}/api/supervisor`;
      targetMethod = 'POST';
      targetBody   = {
        mensagem,
        ...(Array.isArray(historico) ? { historico } : {}),
      };
      break;
    }

    case 'supervisor-status': {
      targetUrl    = `${BASE_URL}/api/supervisor`;
      targetMethod = 'GET';
      targetBody   = undefined;
      break;
    }

    case 'briefing-send': {
      targetUrl    = `${BASE_URL}/api/openclaw/briefing/send`;
      targetMethod = 'POST';
      targetBody   = {};
      break;
    }

    default:
      return res.status(400).json({ error: `action desconhecida: ${action}` });
  }

  try {
    const fetchOpts = {
      method:  targetMethod,
      headers: { 'X-Webhook-Token': token },
    };
    if (targetBody !== undefined) {
      fetchOpts.headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(targetBody);
    }

    const r = await fetch(targetUrl, fetchOpts);
    let data;
    try {
      data = await r.json();
    } catch (e) {
      return res.status(502).json({ error: 'Resposta invalida do servico interno', detail: e.message });
    }
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Erro ao contatar servico interno', detail: e.message });
  }
}
