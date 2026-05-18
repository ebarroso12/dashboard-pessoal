import { REGISTRY } from './_registry.js';
import { respond }  from './_respond.js';

const SUPA_URL = process.env.SUPABASE_URL ?? 'https://jaewjscbigfwjiaeavft.supabase.co';
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function latestLogPerApp() {
  if (!SVC_KEY) return {};
  try {
    const rows = await fetch(
      `${SUPA_URL}/rest/v1/integration_logs?select=app,status,created_at&order=created_at.desc&limit=100`,
      { headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } }
    ).then(r => r.json());
    const map = {};
    for (const row of rows) if (!map[row.app]) map[row.app] = row;
    return map;
  } catch (_) { return {}; }
}

function deriveStatus(app, last) {
  if (!REGISTRY[app].active) return { status: 'offline', lastCheck: null };
  if (!last)                  return { status: 'indeterminado', lastCheck: null };
  const stale = Date.now() - new Date(last.created_at).getTime() > 30 * 60 * 1000;
  return {
    status:    stale ? 'indeterminado' : last.status === 'success' ? 'online' : 'degradado',
    lastCheck: last.created_at,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();
  const latest = await latestLogPerApp();
  const apps   = Object.fromEntries(
    Object.keys(REGISTRY).map(app => [app, deriveStatus(app, latest[app] ?? null)])
  );
  return respond(res, { ok: true, app: 'gateway', status: 'online', data: { apps } });
}
