export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { refresh_token, calendarId = 'primary' } = req.body || {};

    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    // Step 1: Renovar access_token com refresh_token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              refresh_token: refresh_token,
              grant_type: 'refresh_token'
      }).toString()
      });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(401).json({ 
        error: 'Token refresh failed', 
        details: tokenData.error 
});
}

    const accessToken = tokenData.access_token;

    // Step 2: Buscar eventos do Google Calendar
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=10`,
{
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
}
}
    );

    const eventsData = await eventsResponse.json();

    if (!eventsResponse.ok) {
      return res.status(eventsResponse.status).json({
        error: 'Failed to fetch calendar events',
        details: eventsData.error
});
}

    return res.status(200).json({
      success: true,
      events: eventsData.items || [],
      newAccessToken: accessToken
        });

} catch (err) {
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: err.message 
});
}
}
