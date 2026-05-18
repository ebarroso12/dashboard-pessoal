import { isAppAllowed }     from '../_registry.js';
import { validateAppToken } from '../_auth.js';
import { respond, respondNotFound, respondUnauthorized } from '../_respond.js';
const SUPA_URL = process.env.SUPABASE_URL ?? 'https://jaewjscbigfwjiaeavft.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();
  const { app, limit = '20', since } = req.query;
  if (!isAppAllowed(app))          return respondNotFound(res, app ?? 'unknown');
  if (!validateAppToken(req, app)) return respondUnauthorized(res, app);
  if (!SVC_KEY) return respond(res, { ok: false, app, status: 'indeterminado', error: 'misconfigured' });
  const n = Math.min(parseInt(limit, 10) || 20, 100);
  let url = `${SUPA_URL}/rest/v1/integration_logs?app=eq.${app}&order=created_at.desc&limit=${n}`;
  if (since) url += `&created_at=gte.${encodeURIComponent(since)}`;
  const rows   = await fetch(url, { headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } }).then(r => r.json());
  const events = rows.map(({ action, status, latency_ms, created_at }) => ({ action, status, latency_ms, ts: created_at }));
  return respond(res, { ok: true, app, status: 'online', data: { events } });
}
