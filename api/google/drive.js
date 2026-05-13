// POST /api/google/drive — lista 10 arquivos mais recentes do Google Drive

import { adminFetch } from '../_supabase-admin.js';

async function fetchRefreshToken() {
  try {
    const rows = await adminFetch('/oauth_tokens?servico=eq.google&select=refresh_token&limit=1');
    return Array.isArray(rows) ? (rows[0]?.refresh_token || null) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET')     return res.status(200).json({ ok: true, message: 'Drive endpoint online' });
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const clientId     = process.env.GOOGLE_CLIENT_ID     || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Google credentials not configured' });

    const refresh_token = await fetchRefreshToken();
    if (!refresh_token) {
      console.error('[drive] Token Google nao encontrado no Supabase');
      return res.status(401).json({ error: 'Google token not found. Reconnect Google in the dashboard.' });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token, grant_type: 'refresh_token' }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      const code = tokenData.error === 'invalid_grant' ? 'token_expired' : 'token_refresh_failed';
      return res.status(401).json({ error: 'Token refresh failed', error_code: code, details: tokenData.error_description || tokenData.error });
    }

    const accessToken = tokenData.access_token;

    const driveRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink)',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const driveData = await driveRes.json();
    if (!driveRes.ok) {
      const code = driveRes.status === 403 ? 'insufficient_scope' : 'api_error';
      return res.status(driveRes.status).json({ error: 'Failed to fetch drive files', error_code: code, details: driveData.error });
    }

    return res.status(200).json({
      ok:    true,
      files: driveData.files || [],
    });

  } catch (err) {
    console.error('[drive] Erro:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
