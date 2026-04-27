// POST /api/tiktok/token — troca authorization code por tokens TikTok

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin',  origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { code } = req.body || {};
  const clientKey    = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    res.status(400).json({ error: 'TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET não configurados' });
    return;
  }

  const proto       = req.headers['x-forwarded-proto'] || 'https';
  const host        = req.headers['x-forwarded-host']  || req.headers.host || '';
  const redirectUri = `${proto}://${host}/oauth/tiktok`;

  try {
    const params = new URLSearchParams({
      client_key:    clientKey,
      client_secret: clientSecret,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  redirectUri,
    });

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const result = await response.json();
    res.status(result.error ? 400 : 200).json(result);

  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
