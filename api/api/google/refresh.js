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
          const { refresh_token } = req.body;

          if (!refresh_token) {
                  return res.status(400).json({ error: 'Missing refresh_token' });
                }

          const response = await fetch('https://oauth2.googleapis.com/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                            client_id: process.env.GOOGLE_CLIENT_ID,
                            client_secret: process.env.GOOGLE_CLIENT_SECRET,
                            refresh_token: refresh_token,
                            grant_type: 'refresh_token'
                          }).toString()
                });

          const data = await response.json();

          if (!response.ok) {
                  return res.status(response.status).json({ error: data.error_description || data.error });
                }

          // Armazena novo access_token e refresh_token na config
          return res.status(200).json({
                  access_token: data.access_token,
                  expires_in: data.expires_in,
                  refresh_token: data.refresh_token || refresh_token
                });

        } catch (err) {
          return res.status(500).json({ error: 'Internal server error', details: err.message });
        }
  }
