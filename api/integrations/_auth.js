export function validateAppToken(req, app) {
  const token    = req.headers['x-integration-token'];
  const expected = process.env[`INTEGRATION_TOKEN_${app.toUpperCase()}`];
  if (!expected || !token) return false;
  return token === expected;
}
