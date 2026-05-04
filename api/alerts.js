/**
 * api/alerts.js
 *
 * GET  /api/alerts        — lista alertas ativos (resolved=false)
 * POST /api/alerts/sync   — upsert de alertas vindos do frontend
 *
 * Tabela Supabase necessária (rodar uma vez no Supabase SQL Editor):
 *
 * create table if not exists dashboard_alerts (
 *   id          text primary key,
 *   type        text not null,
 *   message     text not null,
 *   source      text not null default '',
 *   created_at  timestamptz not null default now(),
 *   resolved    boolean not null default false,
 *   resolved_at timestamptz
 * );
 */

const SUPABASE_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

async function sb(path, opts = {}) {
  if (!SUPABASE_ANON) throw new Error('SUPABASE_ANON_KEY ausente');
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:        SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer:        'return=minimal',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text ? JSON.parse(text) : null };
}

// Campos aceitos — descarta qualquer campo extra
// notified/notified_at são gerenciados pelo backend (cron Phase 7.5B), não pelo frontend.
// Incluídos aqui apenas para não resetar o flag em caso de re-sync.
function sanitize(a) {
  const out = {
    id:          String(a.id        || '').slice(0, 100),
    type:        String(a.type      || 'warn').slice(0, 20),
    message:     String(a.message   || '').slice(0, 500),
    source:      String(a.source    || '').slice(0, 100),
    created_at:  a.createdAt || a.created_at || new Date().toISOString(),
    resolved:    !!a.resolved,
    resolved_at: a.resolved ? (a.resolvedAt || a.resolved_at || new Date().toISOString()) : null,
  };
  // Preserva notified se vier do frontend (não força reset)
  if (typeof a.notified === 'boolean') out.notified = a.notified;
  if (a.notified_at) out.notified_at = a.notified_at;
  return out;
}

export default async function handler(req, res) {
  Object.entries(cors()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── GET /api/alerts — alertas ativos ─────────────────────────────
  if (req.method === 'GET') {
    try {
      const result = await sb('/dashboard_alerts?resolved=eq.false&order=created_at.desc&limit=20', {
        headers: { Prefer: 'return=representation' },
      });
      if (!result.ok) return res.status(200).json({ ok: true, alerts: [] });
      const alerts = Array.isArray(result.body) ? result.body : [];
      return res.status(200).json({ ok: true, alerts });
    } catch (e) {
      return res.status(200).json({ ok: true, alerts: [], error: e.message });
    }
  }

  // ── POST /api/alerts/sync — upsert do frontend ────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const raw  = Array.isArray(body.alerts) ? body.alerts : (Array.isArray(body) ? body : []);

    if (!raw.length) return res.status(200).json({ ok: true, synced: 0 });

    const alerts = raw
      .filter(a => a && typeof a.id === 'string' && a.id.length > 0)
      .map(sanitize)
      .slice(0, 50); // máximo 50 por chamada

    try {
      const result = await sb('/dashboard_alerts', {
        method:  'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body:    JSON.stringify(alerts),
      });
      if (!result.ok) {
        console.error('[alerts/sync] Supabase error:', result.status, result.body);
        return res.status(200).json({ ok: false, synced: 0, error: 'Supabase error' });
      }
      return res.status(200).json({ ok: true, synced: alerts.length });
    } catch (e) {
      console.error('[alerts/sync]', e.message);
      return res.status(200).json({ ok: false, synced: 0, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
