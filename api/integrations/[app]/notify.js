import { isAppAllowed, isActionAllowed } from '../_registry.js';
import { validateAppToken }              from '../_auth.js';
import { logIntegrationCall }            from '../_logger.js';
import { respond, respondNotFound, respondUnauthorized } from '../_respond.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();
  const { app } = req.query;
  if (!isAppAllowed(app))              return respondNotFound(res, app ?? 'unknown');
  if (!isActionAllowed(app, 'notify')) return respondNotFound(res, app);
  if (!validateAppToken(req, app))     return respondUnauthorized(res, app);
  const { action, payload = {}, ts } = req.body ?? {};
  if (!action) return respond(res, { ok: false, app, status: 'indeterminado', error: 'missing_action' });
  const t = Date.now();
  try {
    const mod = await import(`../../${app}/notify.js`).catch(() => null);
    if (!mod) {
      await logIntegrationCall({ app, action, status: 'success', latency_ms: Date.now() - t });
      return respond(res, { ok: true, app, status: 'online', data: { dispatched: false, reason: 'no_handler' } });
    }
    await mod.sendNotify({ action, payload, ts });
    await logIntegrationCall({ app, action, status: 'success', latency_ms: Date.now() - t });
    return respond(res, { ok: true, app, status: 'online', data: { dispatched: true } });
  } catch (err) {
    await logIntegrationCall({ app, action, status: 'error', latency_ms: Date.now() - t, error_msg: err.message });
    return respond(res, { ok: false, app, status: 'degradado', error: err.message });
  }
}
