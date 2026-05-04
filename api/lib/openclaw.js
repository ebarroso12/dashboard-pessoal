/**
 * api/lib/openclaw.js
 * Envia mensagem WhatsApp via OpenClaw WebSocket (deliver:false = sem Claude responder)
 */

import { createRequire } from 'module';
import { randomUUID }    from 'crypto';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const GATEWAY = 'wss://openclaw.n8ndredson.com';
const TOKEN   = process.env.OPENCLAW_TOKEN || '';

export async function sendWhatsApp(to, message, timeoutMs = 15000) {
  if (!TOKEN) throw new Error('OPENCLAW_TOKEN não configurado');

  return new Promise((resolve, reject) => {
    const ws      = new WebSocket(GATEWAY);
    const timer   = setTimeout(() => { ws.terminate(); reject(new Error('OpenClaw timeout')); }, timeoutMs);
    let   reqId   = 1;
    let   authed  = false;

    ws.on('open',  ()  => { console.log('[openclaw] connected'); });
    ws.on('error', (e) => { console.error('[openclaw] ws error:', e.message); clearTimeout(timer); reject(e); });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      console.log('[openclaw] msg:', JSON.stringify(msg).slice(0, 200));

      // Passo 1 — desafio de conexão
      if (msg.event === 'connect.challenge') {
        ws.send(JSON.stringify({
          type: 'req', id: reqId++, method: 'connect',
          params: {
            minProtocol: 3, maxProtocol: 3,
            role: 'operator',
            scopes: ['control', 'chat'],
            caps: ['tool-events'],
            auth: { authToken: TOKEN },
            client: { name: 'dashboard-proxy', version: '1.0' },
            userAgent: 'node-proxy',
            locale: 'pt-BR',
          },
        }));
        return;
      }

      // Passo 2 — autenticado: envia a mensagem
      if (msg.type === 'res' && msg.ok && !authed) {
        authed = true;
        const number     = String(to).replace(/\D/g, '');
        const sessionKey = `agent:main:whatsapp:direct:+${number}`;
        ws.send(JSON.stringify({
          type: 'req', id: reqId++, method: 'chat.send',
          params: {
            sessionKey,
            message,
            deliver: false,       // envia sem acionar o Claude
            idempotencyKey: randomUUID(),
          },
        }));
        return;
      }

      // Passo 3 — resposta do chat.send
      if (msg.type === 'res' && authed) {
        clearTimeout(timer);
        ws.close();
        if (msg.ok) resolve(msg.payload || {});
        else reject(new Error(msg.error?.message || 'OpenClaw chat.send failed'));
      }
    });
  });
}
