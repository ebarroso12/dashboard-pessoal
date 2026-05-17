// GET /api/token/status
// Retorna apenas se google/meta estao conectados — nunca retorna valores de token.
// Usa service_role para ler oauth_tokens. Sem secret no browser.

import { adminFetch } from '../_supabase-admin.js';

const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'HEAD')    return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Seleciona somente servico — nunca colunas de token
    const rows = await adminFetch('/oauth_tokens?select=servico&limit=10');
    const connected = rows ? new Set(rows.map(r => r.servico)) : new Set();

    return res.status(200).json({
      google: { connected: connected.has('google') },
      meta:   { connected: connected.has('meta') },
    });
  } catch (e) {
    if (e.message.includes('SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nao configurado' });
    }
    return res.status(502).json({ error: 'Erro ao verificar status', detail: e.message });
  }
}
