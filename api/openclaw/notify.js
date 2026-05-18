import { sendWhatsApp } from '../lib/openclaw.js';

/**
 * Chamado por api/integrations/[app]/notify.js quando app === 'openclaw'.
 * payload esperado: { message: string, to?: string }
 * Se to nao vier no payload, usa OPENCLAW_PHONE do env.
 */
export async function sendNotify({ action, payload, ts }) {
  const to      = payload?.to ?? process.env.OPENCLAW_PHONE;
  const message = payload?.message ?? `[${action}] ${ts ?? new Date().toISOString()}`;

  if (!to) throw new Error('OPENCLAW_PHONE nao configurado e payload.to ausente');

  await sendWhatsApp(to, message);
}
