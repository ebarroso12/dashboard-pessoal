/**
 * api/ask.js
 * Endpoint chamado pelo OpenClaw via skill HTTP
 * Recebe uma pergunta e retorna dados reais do dashboard
 *
 * POST /api/ask
 * Body: { action, refresh_token, ...params }
 * action: 'gmail' | 'calendar' | 'drive' | 'alerts' | 'metas' | 'financeiro' | 'instagram' | 'dashboard'
 */

const SUPABASE_URL = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || '';

function cors() {
    return {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Token',
    };
}

async function sb(path, opts = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
          ...opts,
          headers: {
                  apikey: SUPABASE_ANON,
                  Authorization: `Bearer ${SUPABASE_ANON}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=representation',
                  ...(opts.headers || {}),
          },
    });
    const t = await r.text();
    try { return { ok: r.ok, data: JSON.parse(t) }; } catch { return { ok: r.ok, data: t }; }
}

async function refreshGoogleToken(refresh_token) {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token, grant_type: 'refresh_token' }).toString(),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('Token refresh failed: ' + (d.error_description || d.error));
    return d.access_token;
}

async function getGmail(refresh_token) {
    const token = await refreshGoogleToken(refresh_token);
    const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5', {
          headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    const messages = listData.messages || [];
    const totalUnread = listData.resultSizeEstimate || 0;
    const emails = await Promise.all(messages.map(async ({ id }) => {
          const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
                  headers: { Authorization: `Bearer ${token}` }
          });
          const m = await r.json();
          const h = (name) => (m.payload?.headers || []).find(x => x.name === name)?.value || '';
          const from = h('From').replace(/<[^>]+>/, '').trim();
          return { from, subject: h('Subject') || '(sem assunto)', date: h('Date'), snippet: (m.snippet || '').substring(0, 120) };
    }));
    return { total_nao_lidos: totalUnread, ultimos_emails: emails };
}

async function getCalendar(refresh_token) {
    const token = await refreshGoogleToken(refresh_token);
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const r = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=10`,
      { headers: { Authorization: `Bearer ${token}` } }
        );
    const d = await r.json();
    const events = (d.items || []).map(e => ({
          titulo: e.summary || '(sem titulo)',
          inicio: e.start?.dateTime || e.start?.date,
          fim: e.end?.dateTime || e.end?.date,
          descricao: (e.description || '').substring(0, 100),
          link: e.htmlLink,
    }));
    return { proximos_7_dias: events };
}

async function createCalendarEvent(refresh_token, { title, date, time, description, duration_minutes = 60 }) {
    const token = await refreshGoogleToken(refresh_token);
    const start = time ? new Date(`${date}T${time}:00-03:00`) : new Date(`${date}T09:00:00-03:00`);
    const end = new Date(start.getTime() + duration_minutes * 60 * 1000);
    const event = {
          summary: title,
          description: description || '',
          start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
          end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
    };
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
    });
    const d = await r.json();
    if (!r.ok) throw new Error('Erro ao criar evento: ' + JSON.stringify(d.error));
    return { criado: true, titulo: d.summary, inicio: d.start?.dateTime, link: d.htmlLink };
}

async function getDrive(refresh_token) {
    const token = await refreshGoogleToken(refresh_token);
    const r = await fetch(
          'https://www.googleapis.com/drive/v3/files?orderBy=modifiedTime desc&pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink)',
      { headers: { Authorization: `Bearer ${token}` } }
        );
    const d = await r.json();
    return { arquivos_recentes: (d.files || []).map(f => ({ nome: f.name, tipo: f.mimeType, modificado: f.modifiedTime, link: f.webViewLink })) };
}

async function getAlerts() {
    const r = await sb('/dashboard_alerts?resolved=eq.false&order=created_at.desc&limit=10');
    return { alertas_ativos: r.data || [] };
}

async function getMetas() {
    const r = await sb('/metas?ativa=eq.true&order=criado_em.desc');
    const metas = (r.data || []).map(m => ({
          nome: m.nome,
          progresso: m.valor_meta > 0 ? Math.round((m.valor_atual / m.valor_meta) * 100) : 0,
          atual: m.valor_atual,
          meta: m.valor_meta,
          icone: m.icone,
    }));
    return { metas };
}

async function getFinanceiro() {
    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
    const r = await sb(`/lancamentos_financeiros?data=gte.${inicio}&order=data.desc&limit=50`);
    const lancamentos = r.data || [];
    const receitas = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    const despesas = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
    return {
          mes: `${mes}/${ano}`,
          receitas: receitas.toFixed(2),
          despesas: despesas.toFixed(2),
          saldo: (receitas - despesas).toFixed(2),
          lancamentos_recentes: lancamentos.slice(0, 5),
    };
}

async function getTarefas() {
    const r = await sb('/tarefas?concluida=eq.false&order=criado_em.desc&limit=10');
    return { tarefas_pendentes: r.data || [] };
}

async function getDashboardSummary(refresh_token) {
    const [alertas, metas, financeiro, tarefas] = await Promise.all([
          getAlerts(),
          getMetas(),
          getFinanceiro(),
          getTarefas(),
        ]);
    let calendar = null;
    if (refresh_token) {
          try { calendar = await getCalendar(refresh_token); } catch {}
    }
    return { alertas, metas, financeiro, tarefas, agenda_hoje: calendar };
}

export default async function handler(req, res) {
    Object.entries(cors()).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method === 'GET') return res.status(200).json({ ok: true, message: 'ask endpoint online', acoes: ['gmail','calendar','calendar_criar','drive','alerts','metas','financeiro','tarefas','dashboard'] });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || '';
    if (!WEBHOOK_TOKEN) return res.status(500).json({ error: 'WEBHOOK_TOKEN nao configurado' });
    const tokenRecebido = req.headers['x-webhook-token'] || req.body?.token || '';
    if (tokenRecebido !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Token invalido' });

  const { action, refresh_token } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action e obrigatorio' });

  try {
        let resultado;
        switch (action) {
          case 'gmail':
                    resultado = await getGmail(refresh_token);
                    break;
          case 'calendar':
                    resultado = await getCalendar(refresh_token);
                    break;
          case 'calendar_criar':
                    resultado = await createCalendarEvent(refresh_token, req.body);
                    break;
          case 'drive':
                    resultado = await getDrive(refresh_token);
                    break;
          case 'alerts':
                    resultado = await getAlerts();
                    break;
          case 'metas':
                    resultado = await getMetas();
                    break;
          case 'financeiro':
                    resultado = await getFinanceiro();
                    break;
          case 'tarefas':
                    resultado = await getTarefas();
                    break;
          case 'dashboard':
                    resultado = await getDashboardSummary(refresh_token);
                    break;
          default:
                    return res.status(400).json({ error: `action desconhecida: ${action}` });
        }
        return res.status(200).json({ ok: true, action, resultado });
  } catch (err) {
        console.error('[ask]', err.message);
        return res.status(500).json({ ok: false, error: err.message });
  }
}
