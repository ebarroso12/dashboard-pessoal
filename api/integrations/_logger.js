const SUPA_URL = process.env.SUPABASE_URL ?? 'https://jaewjscbigfwjiaeavft.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function logIntegrationCall({ app, action, status, latency_ms, error_msg = null }) {
  if (!SVC_KEY) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/integration_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SVC_KEY,
        'Authorization': `Bearer ${SVC_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ app, action, status, latency_ms, error_msg }),
    });
  } catch (_) {} // log nunca quebra o handler principal
}
