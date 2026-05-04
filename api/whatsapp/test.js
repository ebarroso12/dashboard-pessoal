/**
 * POST /api/whatsapp/test
 * Envia mensagem de teste para PHONE_BRIEFING para verificar integração WA.
 * Requer X-Webhook-Token para evitar uso indevido.
 */

const WA_TOKEN    = process.env.WA_BUSINESS_TOKEN    || '';
const WA_PHONE_ID = process.env.WA_BUSINESS_PHONE_ID || '';
const WA_DEST     = process.env.PHONE_BRIEFING        || '';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN       || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-webhook-token'] || req.body?.token;
  if (token !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Token inválido' });

  // Diagnóstico de variáveis (sem expor valores)
  const envCheck = {
    WA_BUSINESS_TOKEN:    WA_TOKEN    ? `✅ configurado (${WA_TOKEN.length} chars)` : '❌ ausente',
    WA_BUSINESS_PHONE_ID: WA_PHONE_ID ? `✅ ${WA_PHONE_ID}` : '❌ ausente',
    PHONE_BRIEFING:       WA_DEST     ? `✅ ${WA_DEST}` : '❌ ausente',
  };

  if (!WA_TOKEN || !WA_PHONE_ID || !WA_DEST) {
    return res.status(200).json({ ok: false, reason: 'env_missing', env: envCheck });
  }

  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messaging_product: 'whatsapp',
        to:                WA_DEST,
        type:              'text',
        text:              { body: '✅ Teste WhatsApp Dashboard OK\n\nIntegração funcionando corretamente.' },
      }),
    });

    const d = await r.json();

    if (!r.ok) {
      // Loga apenas código e mensagem — sem expor token
      console.error('[wa/test] Meta API error:', r.status, d?.error?.code, d?.error?.type);
      return res.status(200).json({
        ok:     false,
        reason: 'meta_api_error',
        status: r.status,
        code:   d?.error?.code,
        type:   d?.error?.type,
        msg:    d?.error?.message,
        env:    envCheck,
      });
    }

    const msgId = d.messages?.[0]?.id;
    console.log('[wa/test] Enviado com sucesso. msgId:', msgId);
    return res.status(200).json({ ok: true, message_id: msgId, env: envCheck });

  } catch (e) {
    console.error('[wa/test] Erro de rede:', e.message);
    return res.status(200).json({ ok: false, reason: 'network_error', msg: e.message, env: envCheck });
  }
}
