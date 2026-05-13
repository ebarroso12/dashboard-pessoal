// POST /api/token/save
// Proxy seguro para salvar oauth tokens no Supabase via service_role.
// Nao exige secret do browser. Allowlist fixa de servicos e campos.

import { adminFetch } from '../_supabase-admin.js';

const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';

const GOOGLE_FIELDS = ['servico', 'access_token', 'refresh_token', 'scope', 'expires_at'];
const META_FIELDS   = ['servico', 'access_token', 'refresh_token', 'scope', 'expires_at',
                       'meta_user_id', 'meta_page_id', 'instagram_account_id'];

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

  const body = req.body || {};
  const { servico } = body;

  if (!servico || typeof servico !== 'string') {
    return res.status(400).json({ error: 'Campo servico obrigatorio' });
  }

  let allowed;

  if (servico === 'google') {
    if (!body.refresh_token || typeof body.refresh_token !== 'string' || !body.refresh_token.trim()) {
      return res.status(400).json({ error: 'refresh_token obrigatorio para servico google' });
    }
    allowed = GOOGLE_FIELDS;

  } else if (servico === 'meta') {
    if (!body.access_token || typeof body.access_token !== 'string' || !body.access_token.trim()) {
      return res.status(400).json({ error: 'access_token obrigatorio para servico meta' });
    }
    allowed = META_FIELDS;

  } else {
    return res.status(400).json({ error: `servico nao permitido: ${servico}` });
  }

  // Strip: somente campos da allowlist passam para o banco
  const payload = {};
  for (const field of allowed) {
    if (body[field] !== undefined) payload[field] = body[field];
  }

  try {
    await adminFetch('/oauth_tokens', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    if (e.message.includes('SERVICE_ROLE_KEY')) {
      return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY nao configurado' });
    }
    return res.status(502).json({ error: 'Erro ao salvar token', detail: e.message });
  }
}
