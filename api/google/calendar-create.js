// POST /api/google/calendar-create — cria evento no Google Calendar

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, message: 'calendar-create endpoint online' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { title, date, time, description, duration_minutes = 60 } = req.body || {};
    if (!title || !date) return res.status(400).json({ error: 'title and date are required' });

    const clientId     = process.env.GOOGLE_CLIENT_ID     || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Google credentials not configured' });

    // Lê refresh_token do Supabase (server-side — nunca aceito do cliente)
    const refresh_token = await fetchRefreshToken();
    if (!refresh_token) {
      console.error('[calendar-create] Token Google não encontrado no Supabase');
      return res.status(401).json({ error: 'Google token not found. Reconnect Google Calendar in the dashboard.' });
    }

    // Renova token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token, grant_type: 'refresh_token' }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) return res.status(401).json({ error: 'Token refresh failed', details: tokenData.error });
    const accessToken = tokenData.access_token;

    // Monta o evento
    let startDateTime, endDateTime;
    if (time) {
      startDateTime = new Date(`${date}T${time}:00-03:00`);
    } else {
      startDateTime = new Date(`${date}T09:00:00-03:00`);
    }
    endDateTime = new Date(startDateTime.getTime() + duration_minutes * 60 * 1000);

    const event = {
      summary:     title,
      description: description || '',
      start: { dateTime: startDateTime.toISOString(), timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: endDateTime.toISOString(),   timeZone: 'America/Sao_Paulo' },
    };

    const createRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(event),
      }
    );
    const createData = await createRes.json();
    if (!createRes.ok) return res.status(createRes.status).json({ error: 'Failed to create event', details: createData.error });

    return res.status(200).json({
      ok:       true,
      event_id: createData.id,
      title:    createData.summary,
      start:    createData.start?.dateTime,
      link:     createData.htmlLink,
    });
  } catch (err) {
    console.error('[calendar-create] Erro:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
