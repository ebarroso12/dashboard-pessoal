// POST /api/google/drive — lista 10 arquivos mais recentes do Google Drive

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET')     return res.status(200).json({ ok: true, message: 'Drive endpoint online' });
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { refresh_token } = req.body || {};
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token is required' });

    const clientId     = process.env.GOOGLE_CLIENT_ID     || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Google credentials not configured' });

    // Passo 1 — renovar access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token, grant_type: 'refresh_token' }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return res.status(401).json({ error: 'Token refresh failed', details: tokenData.error_description || tokenData.error });

    const accessToken = tokenData.access_token;

    // Passo 2 — buscar arquivos recentes
    const driveRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink)',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const driveData = await driveRes.json();
    if (!driveRes.ok) return res.status(driveRes.status).json({ error: 'Failed to fetch drive files', details: driveData.error });

    return res.status(200).json({
      ok:             true,
      files:          driveData.files || [],
      newAccessToken: accessToken,
    });

  } catch (err) {
    console.error('[drive] Erro:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
