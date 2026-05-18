import { isAppAllowed, isActionAllowed } from '../_registry.js';
import { validateAppToken }              from '../_auth.js';
import { logIntegrationCall }            from '../_logger.js';
import { respond, respondNotFound, respondUnauthorized } from '../_respond.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();
  const { app } = req.query;
  if (!isAppAllowed(app))               return respondNotFound(res, app ?? 'unknown');
  if (!isActionAllowed(app, 'summary')) return respondNotFound(res, app);
  if (!validateAppToken(req, app))      return respondUnauthorized(res, app);
  const t = Date.now();
  try {
    const mod    = await import(`../../${app}/summary.js`);
    const result = await mod.getSummary();
    await logIntegrationCall({ app, action: 'summary', status: 'success', latency_ms: Date.now() - t });
    return respond(res, { ok: true, app, status: 'online', data: result });
  } catch (err) {
    await logIntegrationCall({ app, action: 'summary', status: 'error', latency_ms: Date.now() - t, error_msg: err.message });
    return respond(res, { ok: false, app, status: 'degradado', error: err.message });
  }
}
