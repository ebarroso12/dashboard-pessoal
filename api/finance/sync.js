// POST /api/finance/sync
// Salva dados financeiros em dados_assistente usando service_role.
// Substitui escrita direta com anon key no browser (que pode falhar com RLS).

import { adminFetch } from '../_supabase-admin.js';

const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { tipo, dados } = body;

  if (!tipo || dados === undefined) {
    return res.status(400).json({ error: 'Campos "tipo" e "dados" obrigatorios' });
  }

  try {
    await adminFetch('/dados_assistente', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        tipo,
        dados,
        atualizado_em: new Date().toISOString(),
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[finance/sync] Erro:', e.message);
    return res.status(500).json({ error: 'Falha ao sincronizar dados financeiros', detail: e.message });
  }
}
