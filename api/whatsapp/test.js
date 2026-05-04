/**
 * POST /api/whatsapp/test
 * Envia mensagem de teste para PHONE_BRIEFING via OpenClaw WebSocket.
 * Requer X-Webhook-Token para evitar uso indevido.
 */

import { sendWhatsApp } from '../lib/openclaw.js';

const WA_DEST       = process.env.PHONE_BRIEFING || '';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN  || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-webhook-token'] || req.body?.token;
  if (token !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Token inválido' });

  const envCheck = {
    OPENCLAW_TOKEN: process.env.OPENCLAW_TOKEN ? `✅ configurado` : '❌ ausente',
    PHONE_BRIEFING: WA_DEST || '❌ ausente',
  };

  if (!WA_DEST) return res.status(200).json({ ok: false, reason: 'PHONE_BRIEFING ausente', env: envCheck });

  try {
    const result = await sendWhatsApp(WA_DEST, '✅ Teste WhatsApp Dashboard OK\n\nIntegração via OpenClaw funcionando.');
    return res.status(200).json({ ok: true, result, env: envCheck });
  } catch (e) {
    console.error('[wa/test]', e.message);
    return res.status(200).json({ ok: false, error: e.message, env: envCheck });
  }
}
