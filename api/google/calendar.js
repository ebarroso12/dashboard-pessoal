// POST /api/google/calendar — busca eventos dos próximos 7 dias (refresh automático server-side)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { return res.status(200).end(); }

  // GET simples para infra scan (verifica se o endpoint está vivo)
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Google Calendar endpoint online' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token, calendarId = 'primary' } = req.body || {};

    if (!refresh_token) {
      console.error('[calendar] refresh_token ausente no body');
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    const clientId     = process.env.GOOGLE_CLIENT_ID     || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      console.error('[calendar] Credenciais Google ausentes nas env vars');
      return res.status(500).json({ error: 'Google credentials not configured' });
    }

    // Passo 1: renovar access_token com refresh_token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token,
        grant_type:    'refresh_token',
      }).toString(),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[calendar] Token refresh falhou:', tokenData.error, tokenData.error_description);
      return res.status(401).json({
        error:   'Token refresh failed',
        details: tokenData.error_description || tokenData.error,
      });
    }

    const accessToken = tokenData.access_token;
    console.log('[calendar] Token renovado com sucesso, buscando eventos...');

    // Passo 2: buscar eventos do Google Calendar (próximos 7 dias)
    const now     = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&orderBy=startTime&maxResults=15`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
      }
    );

    const eventsData = await eventsResponse.json();

    if (!eventsResponse.ok) {
      console.error('[calendar] Erro ao buscar eventos:', eventsData.error);
      return res.status(eventsResponse.status).json({
        error:   'Failed to fetch calendar events',
        details: eventsData.error,
      });
    }

    console.log('[calendar] Eventos carregados:', (eventsData.items || []).length);

    return res.status(200).json({
      success:        true,
      events:         eventsData.items || [],
      newAccessToken: accessToken,
    });

  } catch (err) {
    console.error('[calendar] Erro interno:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
