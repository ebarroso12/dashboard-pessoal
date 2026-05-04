// POST /api/google/gmail — lista emails não lidos (máx 5), refresh automático server-side

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET')     return res.status(200).json({ ok: true, message: 'Gmail endpoint online' });
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

    // Passo 2 — buscar IDs dos emails não lidos
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (!listRes.ok) return res.status(listRes.status).json({ error: 'Failed to fetch messages', details: listData.error });

    const messages = listData.messages || [];
    if (!messages.length) return res.status(200).json({ ok: true, emails: [], total: 0, newAccessToken: accessToken });

    // Passo 3 — buscar metadados de cada email
    const emails = await Promise.all(messages.map(async ({ id }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = await msgRes.json();
      const h = (name) => (msg.payload?.headers || []).find(x => x.name === name)?.value || '';
      const from = h('From').replace(/<[^>]+>/, '').trim() || h('From');
      return {
        id,
        from,
        subject: h('Subject') || '(sem assunto)',
        date:    h('Date'),
        snippet: (msg.snippet || '').substring(0, 100),
        link:    `https://mail.google.com/mail/u/0/#inbox/${id}`,
      };
    }));

    return res.status(200).json({
      ok:             true,
      emails:         emails.filter(Boolean),
      total:          listData.resultSizeEstimate || messages.length,
      newAccessToken: accessToken,
    });

  } catch (err) {
    console.error('[gmail] Erro:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
