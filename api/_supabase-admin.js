// api/_supabase-admin.js
// Server-side only. Uses SUPABASE_SERVICE_ROLE_KEY — never import in frontend.

const SUPABASE_URL = 'https://jaewjscbigfwjiaeavft.supabase.co';

export async function adminFetch(path, opts = {}) {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');

  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:        key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}
