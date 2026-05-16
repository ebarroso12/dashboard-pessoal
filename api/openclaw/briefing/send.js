import { sendWhatsApp } from '../../lib/openclaw.js';
import { adminFetch } from '../../_supabase-admin.js';

const BASE_URL = 'https://dashboard-pessoal-edson.vercel.app';

function mask(msg) {
  return String(msg).replace(/Bearer \S+/g, 'Bearer [masked]').slice(0, 200);
}

async function log(status, wa_id, erro, ts) {
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await adminFetch(`/dados_assistente?tipo=eq.briefing_wa_log&atualizado_em=lt.${cutoff}`, { method: 'DELETE' });
    await adminFetch('/dados_assistente', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ tipo: 'briefing_wa_log', dados: { status, wa_id, erro }, atualizado_em: ts }),
    });
  } catch (_) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, status: 'method_not_allowed' });
  }

  const token = req.headers['x-webhook-token'];
  if (!token || token !== process.env.WEBHOOK_TOKEN) {
    return res.status(401).json({ ok: false, status: 'unauthorized' });
  }

  const ts = new Date().toISOString();

  let briefingText;
  try {
    const r = await fetch(BASE_URL + '/api/briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`briefing HTTP ${r.status}`);
    const data = await r.json();
    briefingText = data.briefing;
  } catch (e) {
    return res.status(500).json({ ok: false, status: 'erro_briefing', erro: mask(e.message) });
  }

  if (!briefingText) {
    return res.status(200).json({ ok: false, status: 'briefing_vazio', ts });
  }

  const phone = process.env.PHONE_BRIEFING;
  const delay = parseInt(process.env.RETRY_DELAY_MS || '2000');

  let result;
  try {
    result = await sendWhatsApp(phone, briefingText);
  } catch (e1) {
    await new Promise(r => setTimeout(r, delay));
    try {
      result = await sendWhatsApp(phone, briefingText);
      const wa_id = result.messages?.[0]?.id || '';
      log('enviado_retry', wa_id, null, ts);
      return res.status(200).json({ ok: true, status: 'enviado_retry', wa_id, ts });
    } catch (e2) {
      const erro = mask(e2.message);
      log('falhou', null, erro, ts);
      return res.status(502).json({ ok: false, status: 'falhou', erro });
    }
  }

  const wa_id = result.messages?.[0]?.id || '';
  log('enviado', wa_id, null, ts);
  return res.status(200).json({ ok: true, status: 'enviado', wa_id, ts });
}
