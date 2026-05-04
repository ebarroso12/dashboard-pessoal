/**
 * api/alerts.js
 *
 * GET  /api/alerts          — ativos (resolved=false)
 * GET  /api/alerts?history  — histórico (resolved=true, últimos 50)
 * GET  /api/alerts/stats    — analytics: count/type, count/source, tempo médio resolução
 * POST /api/alerts/sync     — upsert + notificação WA (7.5B) com rate control (7.6)
 * POST /api/alerts/resolve  — resolver alerta por id ou "all" (7.8)
 *
 * Rate control (7.6):
 *   critical → sempre envia (sem cooldown)
 *   warn     → cooldown de 30 min por source (não repete mesma fonte em 30 min)
 */

const SUPABASE_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY    || '';
const WA_TOKEN      = process.env.WA_BUSINESS_TOKEN    || '';
const WA_PHONE_ID   = process.env.WA_BUSINESS_PHONE_ID || '';
const WA_DEST       = process.env.PHONE_BRIEFING        || '';

const NOTIFY_TYPES     = ['critical', 'warn'];
const WARN_COOLDOWN_MS = 30 * 60 * 1000; // 30 min entre warns da mesma source

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
      apikey:         SUPABASE_ANON,
      Authorization:  `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text ? JSON.parse(text) : null };
}

function sanitize(a) {
  const out = {
    id:          String(a.id      || '').slice(0, 100),
    type:        String(a.type    || 'warn').slice(0, 20),
    message:     String(a.message || '').slice(0, 500),
    source:      String(a.source  || '').slice(0, 100),
    created_at:  a.createdAt || a.created_at || new Date().toISOString(),
    resolved:    !!a.resolved,
    resolved_at: a.resolved ? (a.resolvedAt || a.resolved_at || new Date().toISOString()) : null,
  };
  if (typeof a.notified === 'boolean') out.notified = a.notified;
  if (a.notified_at) out.notified_at = a.notified_at;
  return out;
}

// ── WhatsApp ──────────────────────────────────────────────────────
async function sendWhatsAppAlert(alert) {
  if (!WA_TOKEN || !WA_PHONE_ID || !WA_DEST) return false;
  const icon  = alert.type === 'critical' ? '🔴' : '🟡';
  const texto = `${icon} *Alerta do Dashboard*\n\nTipo: ${alert.type}\nOrigem: ${alert.source}\nMensagem: ${alert.message}\n\nPara ver todos: envie *alertas*\nPara resolver: envie *resolver 1*`;
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messaging_product: 'whatsapp', to: WA_DEST, type: 'text', text: { body: texto } }),
    });
    const d = await r.json();
    if (!r.ok) { console.error('[alerts] WA failed:', r.status, d?.error?.message || ''); return false; }
    return !!d.messages?.[0]?.id;
  } catch (e) { console.error('[alerts] WA error:', e.message); return false; }
}

async function markNotified(id) {
  await sb(`/dashboard_alerts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body:   JSON.stringify({ notified: true, notified_at: new Date().toISOString() }),
  });
}

// ── 7.6 Rate control ─────────────────────────────────────────────
// Para warn: verifica se algum alerta da mesma source foi notificado nos últimos 30 min
async function isInCooldown(alert) {
  if (alert.type === 'critical') return false; // critical nunca tem cooldown
  const since = new Date(Date.now() - WARN_COOLDOWN_MS).toISOString();
  const result = await sb(
    `/dashboard_alerts?source=eq.${encodeURIComponent(alert.source)}&type=eq.warn&notified=eq.true&notified_at=gte.${since}&limit=1&select=id`,
    { headers: { Prefer: 'return=representation' } }
  );
  return Array.isArray(result.body) && result.body.length > 0;
}

// ── Pendentes (notified=false, não resolvidos) ────────────────────
async function fetchPendingNotification(ids) {
  if (!ids.length) return [];
  const inClause = ids.map(id => `"${id}"`).join(',');
  const result = await sb(
    `/dashboard_alerts?id=in.(${inClause})&resolved=eq.false&notified=eq.false&select=id,type,source`,
    { headers: { Prefer: 'return=representation' } }
  );
  return Array.isArray(result.body) ? result.body : [];
}

export default async function handler(req, res) {
  Object.entries(cors()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const url  = req.url || '';
  const qs   = new URL(url, 'https://x').searchParams;

  // ── GET /api/alerts/stats — 7.7 analytics ────────────────────────
  if (req.method === 'GET' && url.includes('/stats')) {
    try {
      const [active, hist] = await Promise.all([
        sb('/dashboard_alerts?resolved=eq.false&select=type,source', { headers: { Prefer: 'return=representation' } }),
        sb('/dashboard_alerts?resolved=eq.true&select=type,source,created_at,resolved_at&limit=200', { headers: { Prefer: 'return=representation' } }),
      ]);
      const all = [...(Array.isArray(active.body) ? active.body : []), ...(Array.isArray(hist.body) ? hist.body : [])];
      const byType   = all.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {});
      const bySource = all.reduce((acc, a) => { acc[a.source] = (acc[a.source] || 0) + 1; return acc; }, {});
      const resolved = Array.isArray(hist.body) ? hist.body : [];
      const avgMs    = resolved.length
        ? resolved.reduce((s, a) => s + (new Date(a.resolved_at) - new Date(a.created_at)), 0) / resolved.length
        : 0;
      return res.status(200).json({
        ok: true,
        total:        all.length,
        active:       Array.isArray(active.body) ? active.body.length : 0,
        resolved:     resolved.length,
        by_type:      byType,
        by_source:    bySource,
        avg_resolution_minutes: avgMs ? Math.round(avgMs / 60000) : null,
      });
    } catch (e) {
      return res.status(200).json({ ok: true, total: 0, error: e.message });
    }
  }

  // ── GET /api/alerts — ativos ou histórico (7.7) ───────────────────
  if (req.method === 'GET') {
    try {
      const isHistory = qs.has('history');
      const path = isHistory
        ? '/dashboard_alerts?resolved=eq.true&order=resolved_at.desc&limit=50'
        : '/dashboard_alerts?resolved=eq.false&order=created_at.desc&limit=20';
      const result = await sb(path, { headers: { Prefer: 'return=representation' } });
      if (!result.ok) return res.status(200).json({ ok: true, alerts: [] });
      return res.status(200).json({ ok: true, alerts: Array.isArray(result.body) ? result.body : [] });
    } catch (e) {
      return res.status(200).json({ ok: true, alerts: [], error: e.message });
    }
  }

  if (req.method === 'POST') {
    // ── POST /api/alerts/resolve — 7.8 resolver via WhatsApp ─────────
    if (url.includes('/resolve')) {
      const { id } = req.body || {};
      try {
        const path = id === 'all'
          ? '/dashboard_alerts?resolved=eq.false'
          : `/dashboard_alerts?id=eq.${encodeURIComponent(String(id).slice(0, 100))}`;
        const result = await sb(path, {
          method:  'PATCH',
          headers: { Prefer: 'return=minimal' },
          body:    JSON.stringify({ resolved: true, resolved_at: new Date().toISOString() }),
        });
        return res.status(200).json({ ok: result.ok });
      } catch (e) {
        return res.status(200).json({ ok: false, error: e.message });
      }
    }

    // ── POST /api/alerts/sync — upsert + notificação (7.5B + 7.6) ────
    const body = req.body || {};
    const raw  = Array.isArray(body.alerts) ? body.alerts : (Array.isArray(body) ? body : []);
    if (!raw.length) return res.status(200).json({ ok: true, synced: 0, notified: 0 });

    const alerts = raw
      .filter(a => a && typeof a.id === 'string' && a.id.length > 0)
      .map(sanitize)
      .slice(0, 50);

    try {
      const result = await sb('/dashboard_alerts', {
        method:  'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body:    JSON.stringify(alerts),
      });
      if (!result.ok) {
        console.error('[alerts/sync] upsert error:', result.status);
        return res.status(200).json({ ok: false, synced: 0, notified: 0 });
      }
    } catch (e) {
      return res.status(200).json({ ok: false, synced: 0, notified: 0, error: e.message });
    }

    const candidates = alerts.filter(a => !a.resolved && NOTIFY_TYPES.includes(a.type)).map(a => a.id);
    let notifiedCount = 0;

    if (candidates.length) {
      try {
        const pending = await fetchPendingNotification(candidates);
        for (const row of pending) {
          const alert = alerts.find(a => a.id === row.id);
          if (!alert) continue;
          if (await isInCooldown(alert)) { // 7.6 rate control
            console.log(`[alerts] cooldown ativo para warn source="${alert.source}" — ignorado`);
            continue;
          }
          const sent = await sendWhatsAppAlert(alert);
          if (sent) { await markNotified(alert.id); notifiedCount++; }
        }
      } catch (e) {
        console.error('[alerts/sync] WA notify:', e.message);
      }
    }

    return res.status(200).json({ ok: true, synced: alerts.length, notified: notifiedCount });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
