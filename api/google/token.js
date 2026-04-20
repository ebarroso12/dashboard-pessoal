export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }

    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

    try {
          const { code, code_verifier, redirect_uri } = req.body;

          if (!code) {
                  return res.status(400).json({ error: 'Missing code parameter' });
                }

          const params = new URLSearchParams({
                  code,
                  client_id:     process.env.GOOGLE_CLIENT_ID,
                  client_secret: process.env.GOOGLE_CLIENT_SECRET,
                  redirect_uri:  redirect_uri || '',
                  grant_type:    'authorization_code'
                });

          if (code_verifier) {
                  params.set('code_verifier', code_verifier);
                }

          const response = await fetch('https://oauth2.googleapis.com/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: params.toString()
                });

          const data = await response.json();
          return res.status(response.status).json(data);

        } catch (err) {
          return res.status(500).json({ error: 'Internal server error', details: err.message });
        }
  }
