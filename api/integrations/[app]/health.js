import { isAppAllowed }       from '../_registry.js';
import { validateAppToken }   from '../_auth.js';
import { logIntegrationCall } from '../_logger.js';
import { respond, respondNotFound, respondUnauthorized } from '../_respond.js';
const SUPA_URL = process.env.SUPABASE_URL ?? 'https://jaewjscbigfwjiaeavft.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();
  const { app } = req.query;
  if (!isAppAllowed(app))          return respondNotFound(res, app ?? 'unknown');
  if (!validateAppToken(req, app)) return respondUnauthorized(res, app);
  const t = Date.now();
  let last = null;
  if (SVC_KEY) {
    const rows = await fetch(
      `${SUPA_URL}/rest/v1/integration_logs?app=eq.${app}&status=eq.success&order=created_at.desc&limit=1`,
      { headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } }
    ).then(r => r.json()).catch(() => []);
    last = rows[0] ?? null;
  }
  const latency_ms = Date.now() - t;
  const stale  = last && (Date.now() - new Date(last.created_at).getTime() > 30 * 60 * 1000);
  const status = !last ? 'indeterminado' : stale ? 'indeterminado' : 'online';
  await logIntegrationCall({ app, action: 'health', status: 'success', latency_ms });
  return respond(res, { ok: true, app, status, data: { latency_ms, lastSuccess: last?.created_at ?? null } });
}
