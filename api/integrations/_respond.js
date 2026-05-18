export function respond(res, { ok, app, status, data = null, error = null }) {
  const code = ok ? 200 : (error === 'not_found' ? 404 : error === 'unauthorized' ? 401 : 400);
  res.setHeader('Content-Type', 'application/json');
  res.status(code).json({ ok, app, status, data, error, ts: new Date().toISOString() });
}
export const respondNotFound     = (res, app) => respond(res, { ok: false, app, status: 'offline',        error: 'not_found'    });
export const respondUnauthorized = (res, app) => respond(res, { ok: false, app, status: 'indeterminado', error: 'unauthorized' });
