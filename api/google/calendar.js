// POST /api/google/calendar — busca eventos dos próximos 7 dias (refresh automático server-side)

const SUPABASE_URL = 'https://jaewjscbigfwjiaeavft.supabase.co';

async function fetchRefreshToken() {
  const anon = process.env.SUPABASE_ANON_KEY || '';
  if (!anon) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/oauth_tokens?servico=eq.google&select=refresh_token&limit=1`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
    );
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) ? (rows[0]?.refresh_token || null) : null;
  } catch {
    return null;
  }
}

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
    const { calendarId = 'primary' } = req.body || {};

    const clientId     = process.env.GOOGLE_CLIENT_ID     || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      console.error('[calendar] Credenciais Google ausentes nas env vars');
      return res.status(500).json({ error: 'Google credentials not configured' });
    }

    // Lê refresh_token do Supabase (server-side — nunca aceito do cliente)
    const refresh_token = await fetchRefreshToken();
    if (!refresh_token) {
      console.error('[calendar] Token Google não encontrado no Supabase');
      return res.status(401).json({ error: 'Google token not found. Reconnect Google Calendar in the dashboard.' });
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
      success: true,
      events:  eventsData.items || [],
    });

  } catch (err) {
    console.error('[calendar] Erro interno:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
