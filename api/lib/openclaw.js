/**
 * api/lib/openclaw.js
 * Envia mensagem WhatsApp via Meta Business API.
 * Mantém a interface sendWhatsApp(to, message) para compatibilidade com
 * api/alerts.js e api/whatsapp/test.js.
 */

export async function sendWhatsApp(to, message) {
  const token   = process.env.WA_BUSINESS_TOKEN    || '';
  const phoneId = process.env.WA_BUSINESS_PHONE_ID || '656678347527144';

  if (!token) throw new Error('WA_BUSINESS_TOKEN não configurado');

  const number = String(to).replace(/\D/g, '');

  const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:                number,
      type:              'text',
      text:              { body: message },
    }),
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || `Meta WA API error ${r.status}`);
  console.log('[meta-wa] sent ok, id:', data.messages?.[0]?.id);
  return data;
}
