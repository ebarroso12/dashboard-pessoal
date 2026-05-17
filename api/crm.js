// api/crm.js
// Backend proxy para CRM Kanban. Substitui chamadas diretas ao Supabase no frontend.
// Usa service_role server-side — anon key nunca exposta ao browser.

const CRM_URL        = 'https://zlrydmfwsobheajaeael.supabase.co';
const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';

function crmSB(path, opts = {}) {
  const key = (process.env.CRM_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) throw new Error('CRM_SUPABASE_SERVICE_ROLE_KEY nao configurado');
  return fetch(`${CRM_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(8000),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const key = (process.env.CRM_SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) return res.status(500).json({ ok: false, error: 'CRM_SUPABASE_SERVICE_ROLE_KEY nao configurado' });

  try {
    // GET — lista leads + contacts joined
    if (req.method === 'GET') {
      const [lRes, cRes] = await Promise.all([
        crmSB('/whatsapp_leads?select=*&order=created_at.desc'),
        crmSB('/whatsapp_contacts?select=*'),
      ]);
      if (!lRes.ok) {
        const detail = await lRes.text().catch(() => '');
        return res.status(502).json({ ok: false, error: 'GET leads falhou', detail, status: lRes.status });
      }
      const leads    = await lRes.json().catch(() => []);
      const contacts = cRes.ok ? await cRes.json().catch(() => []) : [];
      const contactMap = {};
      contacts.forEach(c => { contactMap[c.id] = c; });
      return res.status(200).json({
        ok:    true,
        leads: leads.map(l => ({ ...l, _contact: contactMap[l.contact_id] || {} })),
      });
    }

    if (req.method === 'POST') {
      const { action, payload = {} } = req.body || {};

      // action=create — INSERT contact + lead
      if (action === 'create') {
        const { contactId, leadId, name, status, interesse, resumo, now } = payload;
        if (!contactId || !leadId || !status) {
          return res.status(400).json({ ok: false, error: 'contactId, leadId, status obrigatorios' });
        }
        const rC = await crmSB('/whatsapp_contacts', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ id: contactId, name: name || 'Sem nome', phone: null }),
        });
        if (!rC.ok) {
          const detail = await rC.text().catch(() => '');
          return res.status(502).json({ ok: false, error: 'INSERT contact falhou', detail, status: rC.status });
        }
        const rL = await crmSB('/whatsapp_leads', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ id: leadId, contact_id: contactId, status, interesse: interesse || '', resumo: resumo || '', created_at: now, updated_at: now }),
        });
        if (!rL.ok) {
          const detail = await rL.text().catch(() => '');
          return res.status(502).json({ ok: false, error: 'INSERT lead falhou', detail, status: rL.status });
        }
        return res.status(200).json({ ok: true });
      }

      // action=update — PATCH lead + opcionalmente contact name
      if (action === 'update') {
        const { leadId, contactId, name, status, interesse, resumo, now } = payload;
        if (!leadId) return res.status(400).json({ ok: false, error: 'leadId obrigatorio' });
        const ops = [
          crmSB(`/whatsapp_leads?id=eq.${leadId}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ status, interesse, resumo, updated_at: now }),
          }),
        ];
        if (contactId && name) {
          ops.push(crmSB(`/whatsapp_contacts?id=eq.${contactId}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ name }),
          }));
        }
        const results = await Promise.all(ops);
        const failed = results.find(r => !r.ok);
        if (failed) {
          const detail = await failed.text().catch(() => '');
          return res.status(502).json({ ok: false, error: 'PATCH falhou', detail, status: failed.status });
        }
        return res.status(200).json({ ok: true });
      }

      // action=move — PATCH status apenas (drag-drop)
      if (action === 'move') {
        const { leadId, status, now } = payload;
        if (!leadId || !status) return res.status(400).json({ ok: false, error: 'leadId e status obrigatorios' });
        const rM = await crmSB(`/whatsapp_leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status, updated_at: now }),
        });
        if (!rM.ok) {
          const detail = await rM.text().catch(() => '');
          return res.status(502).json({ ok: false, error: 'PATCH move falhou', detail, status: rM.status });
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: `action desconhecida: ${action}` });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
}
