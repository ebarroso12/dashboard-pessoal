/**
 * api/alerts.js
 *
 * GET  /api/alerts        — lista alertas ativos (resolved=false)
 * POST /api/alerts/sync   — upsert de alertas vindos do frontend + envia WA para novos critical/warn
 *
 * Tabela Supabase:
 *   id, type, message, source, created_at, resolved, resolved_at, notified, notified_at
 */

const SUPABASE_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY     || '';
const WA_TOKEN      = process.env.WA_BUSINESS_TOKEN     || '';
const WA_PHONE_ID   = process.env.WA_BUSINESS_PHONE_ID  || '';
const WA_DEST       = process.env.PHONE_BRIEFING         || '';

const NOTIFY_TYPES  = ['critical', 'warn'];

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

// ── Campos aceitos — descarta qualquer campo extra ────────────────
// notified/notified_at são gerenciados pelo backend; preservados se vierem do frontend
// para não resetar o flag em re-sync.
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

// ── WhatsApp via Meta Cloud API ───────────────────────────────────
async function sendWhatsAppAlert(alert) {
  if (!WA_TOKEN || !WA_PHONE_ID || !WA_DEST) {
    console.warn('[alerts] WA env vars ausentes — notificação ignorada');
    return false;
  }
  const icon = alert.type === 'critical' ? '🔴' : '🟡';
  const texto = `${icon} *Alerta do Dashboard*\n\nTipo: ${alert.type}\nOrigem: ${alert.source}\nMensagem: ${alert.message}\n\nPara ver todos: envie *alertas*`;

  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messaging_product: 'whatsapp',
        to:                WA_DEST,
        type:              'text',
        text:              { body: texto },
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      console.error('[alerts] WA send failed:', r.status, d?.error?.message || '');
      return false;
    }
    return !!d.messages?.[0]?.id;
  } catch (e) {
    console.error('[alerts] WA send error:', e.message);
    return false;
  }
}

// ── Marcar como notificado no Supabase ────────────────────────────
async function markNotified(id) {
  await sb(`/dashboard_alerts?id=eq.${encodeURIComponent(id)}`, {
    method:  'PATCH',
    headers: { Prefer: 'return=minimal' },
    body:    JSON.stringify({ notified: true, notified_at: new Date().toISOString() }),
  });
}

// ── Buscar alertas que ainda não foram notificados no Supabase ────
async function fetchPendingNotification(ids) {
  if (!ids.length) return [];
  const inClause = ids.map(id => `"${id}"`).join(',');
  const result = await sb(
    `/dashboard_alerts?id=in.(${inClause})&resolved=eq.false&notified=eq.false&select=id,type`,
    { headers: { Prefer: 'return=representation' } }
  );
  return Array.isArray(result.body) ? result.body : [];
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

  // ── POST /api/alerts/sync — upsert + notificação WA ──────────────
  if (req.method === 'POST') {
    const body = req.body || {};
    const raw  = Array.isArray(body.alerts) ? body.alerts : (Array.isArray(body) ? body : []);

    if (!raw.length) return res.status(200).json({ ok: true, synced: 0, notified: 0 });

    const alerts = raw
      .filter(a => a && typeof a.id === 'string' && a.id.length > 0)
      .map(sanitize)
      .slice(0, 50);

    // 1 — Upsert no Supabase
    try {
      const result = await sb('/dashboard_alerts', {
        method:  'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body:    JSON.stringify(alerts),
      });
      if (!result.ok) {
        console.error('[alerts/sync] Supabase upsert error:', result.status);
        return res.status(200).json({ ok: false, synced: 0, notified: 0, error: 'Supabase error' });
      }
    } catch (e) {
      console.error('[alerts/sync]', e.message);
      return res.status(200).json({ ok: false, synced: 0, notified: 0, error: e.message });
    }

    // 2 — Identificar quais precisam de notificação WA
    // Filtra candidatos: active, tipo notificável, não resolvidos pelo frontend
    const candidates = alerts
      .filter(a => !a.resolved && NOTIFY_TYPES.includes(a.type))
      .map(a => a.id);

    let notifiedCount = 0;

    if (candidates.length) {
      try {
        // Consulta Supabase para confirmar notified=false (evita reenvio em reload)
        const pending = await fetchPendingNotification(candidates);

        for (const row of pending) {
          const alert = alerts.find(a => a.id === row.id);
          if (!alert) continue;
          const sent = await sendWhatsAppAlert(alert);
          if (sent) {
            await markNotified(alert.id);
            notifiedCount++;
          }
        }
      } catch (e) {
        console.error('[alerts/sync] notificação WA:', e.message);
        // Não falha o sync por erro de notificação
      }
    }

    return res.status(200).json({ ok: true, synced: alerts.length, notified: notifiedCount });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
