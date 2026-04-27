/**
 * api/comandos.js — Central de Comandos via WhatsApp/Telegram
 *
 * Recebe comandos do OpenClaw e responde com dados do dashboard.
 *
 * POST /api/comandos
 *   Headers: X-Webhook-Token: oc_edson_2026_secure
 *   Body: { comando: "resumo", refresh_token: "..." }
 *   ou Body: { texto: "resumo" }  ← formato OpenClaw
 */

const SUPABASE_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZXdqc2NiaWdmd2ppYWVhdmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTUwNDksImV4cCI6MjA4Nzg5MTA0OX0.xLo3VVkQmItv9Q7vQ_U_i60FXQj8FzSogwVBfbAPbfU';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'oc_edson_2026_secure';
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Token',
  };
}

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
      ...(opts.headers || {}),
    },
  });
  try { return await res.json(); } catch { return null; }
}

async function getGoogleAccessToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }).toString(),
  });
  const d = await r.json();
  return d.access_token || null;
}

async function getGoogleRefreshToken() {
  const rows = await sbFetch('/oauth_tokens?select=refresh_token&servico=eq.google&limit=1');
  return rows?.[0]?.refresh_token || null;
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────

async function handleAgenda() {
  const refreshToken = await getGoogleRefreshToken();
  if (!refreshToken) return '📅 Agenda: token Google não encontrado. Reconecte o Google Calendar no dashboard.';

  const accessToken = await getGoogleAccessToken(refreshToken);
  if (!accessToken) return '📅 Agenda: erro ao renovar token Google.';

  const now     = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=8`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await r.json();
  const events = data.items || [];

  if (!events.length) return '📅 Agenda: nenhum evento nos próximos 7 dias.';

  const fmt = (e) => {
    const start = e.start?.dateTime || e.start?.date || '';
    const d = new Date(start);
    const hora = e.start?.dateTime
      ? d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return `• ${hora} — ${e.summary || 'Sem título'}`;
  };

  return `📅 *Agenda — próximos 7 dias*\n${events.map(fmt).join('\n')}`;
}

async function handleEmails(accessToken) {
  if (!accessToken) {
    const rt = await getGoogleRefreshToken();
    if (rt) accessToken = await getGoogleAccessToken(rt);
  }
  if (!accessToken) return '📧 Emails: token Google não encontrado.';

  const r = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await r.json();
  const msgs = data.messages || [];

  if (!msgs.length) return '📧 Emails: caixa limpa! Nenhum email não lido. ✅';

  const details = await Promise.all(
    msgs.slice(0, 5).map(async (m) => {
      const mr = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const md = await mr.json();
      const headers = md.payload?.headers || [];
      const from    = headers.find(h => h.name === 'From')?.value || 'Desconhecido';
      const subject = headers.find(h => h.name === 'Subject')?.value || 'Sem assunto';
      const name    = from.replace(/<.*>/, '').trim() || from;
      return `• ${name}: ${subject}`;
    })
  );

  return `📧 *Emails não lidos (${data.resultSizeEstimate || msgs.length})*\n${details.join('\n')}`;
}

async function handleDrive(accessToken) {
  if (!accessToken) {
    const rt = await getGoogleRefreshToken();
    if (rt) accessToken = await getGoogleAccessToken(rt);
  }
  if (!accessToken) return '📁 Drive: token Google não encontrado.';

  const r = await fetch(
    'https://www.googleapis.com/drive/v3/files?orderBy=modifiedTime desc&pageSize=5&fields=files(name,mimeType,modifiedTime,webViewLink)',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await r.json();
  const files = data.files || [];

  if (!files.length) return '📁 Drive: nenhum arquivo encontrado.';

  const icon = (mime) => {
    if (mime.includes('document'))     return '📄';
    if (mime.includes('spreadsheet'))  return '📊';
    if (mime.includes('presentation')) return '📽️';
    if (mime.includes('pdf'))          return '📕';
    if (mime.includes('folder'))       return '📁';
    return '📎';
  };

  const fmt = (f) => {
    const d = new Date(f.modifiedTime).toLocaleDateString('pt-BR');
    return `${icon(f.mimeType)} ${f.name} (${d})`;
  };

  return `📁 *Drive — arquivos recentes*\n${files.map(fmt).join('\n')}`;
}

async function handleTarefas() {
  const rows = await sbFetch('/tarefas?select=texto,done&order=created_at.desc&limit=10');
  if (!rows?.length) return '✅ Tarefas: nenhuma tarefa cadastrada.';

  const pendentes = rows.filter(t => !t.done);
  const feitas    = rows.filter(t => t.done);

  if (!pendentes.length) return `✅ Todas as tarefas concluídas! (${feitas.length} feitas)`;

  return `✅ *Tarefas pendentes (${pendentes.length})*\n${pendentes.map(t => `• ${t.texto}`).join('\n')}`;
}

async function handleFinancas() {
  const [saldo, txs] = await Promise.all([
    sbFetch('/financas?select=saldo&limit=1&order=updated_at.desc'),
    sbFetch('/transacoes?select=descricao,valor,tipo,data&order=data.desc&limit=5'),
  ]);

  let txt = '💰 *Finanças*\n';

  if (saldo?.[0]?.saldo !== undefined) {
    const s = Number(saldo[0].saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    txt += `Saldo: ${s}\n`;
  } else {
    txt += 'Saldo: dados não disponíveis\n';
  }

  if (txs?.length) {
    txt += '\nÚltimas transações:\n';
    txs.forEach(t => {
      const v = Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const icon = t.tipo === 'receita' ? '🟢' : '🔴';
      txt += `${icon} ${t.descricao}: ${v}\n`;
    });
  }

  return txt.trim();
}

async function handleMetas() {
  const rows = await sbFetch('/metas?select=nome,atual,meta,icone&order=created_at.asc&limit=6');
  if (!rows?.length) return '🎯 Metas: nenhuma meta cadastrada.';

  const fmt = (m) => {
    const pct = m.meta > 0 ? Math.round((m.atual / m.meta) * 100) : 0;
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    return `${m.icone || '🎯'} ${m.nome}: ${pct}%\n   ${bar}`;
  };

  return `🎯 *Metas*\n${rows.map(fmt).join('\n')}`;
}

async function handleResumo() {
  const [agenda, tarefas, financas] = await Promise.all([
    handleAgenda(),
    handleTarefas(),
    handleFinancas(),
  ]);

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  return `📋 *Resumo do Dia — ${hoje}*\n\n${agenda}\n\n${tarefas}\n\n${financas}`;
}

function handleAjuda() {
  return `🤖 *Comandos disponíveis*

📅 *agenda* — próximos eventos
📧 *emails* — emails não lidos
📁 *drive* — arquivos recentes do Drive
✅ *tarefas* — tarefas pendentes
💰 *financas* — saldo e transações
🎯 *metas* — progresso das metas
📋 *resumo* — tudo junto
❓ *ajuda* — esta mensagem`;
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET')     return res.status(200).json({ ok: true, message: 'Comandos endpoint online' });
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-webhook-token'] || req.body?.token;
  if (token !== WEBHOOK_TOKEN) return res.status(401).json({ error: 'Token inválido' });

  const raw     = req.body?.comando || req.body?.texto || '';
  const comando = raw.toLowerCase().trim().replace(/[^a-záàâãéèêíïóôõöúüçñ\s]/gi, '').trim();

  console.log('[comandos] Recebido:', comando);

  let resposta = '';

  try {
    if (['agenda', 'calendar', 'eventos'].includes(comando))
      resposta = await handleAgenda();
    else if (['email', 'emails', 'e-mail', 'inbox'].includes(comando))
      resposta = await handleEmails(null);
    else if (['drive', 'arquivos', 'docs'].includes(comando))
      resposta = await handleDrive(null);
    else if (['tarefas', 'tasks', 'todo'].includes(comando))
      resposta = await handleTarefas();
    else if (['financas', 'finanças', 'saldo', 'dinheiro'].includes(comando))
      resposta = await handleFinancas();
    else if (['metas', 'goals', 'objetivos'].includes(comando))
      resposta = await handleMetas();
    else if (['resumo', 'resume', 'dia', 'hoje'].includes(comando))
      resposta = await handleResumo();
    else if (['ajuda', 'help', 'comandos', 'menu'].includes(comando))
      resposta = handleAjuda();
    else
      resposta = `❓ Comando não reconhecido: "${raw}"\n\nDigite *ajuda* para ver os comandos disponíveis.`;
  } catch (err) {
    console.error('[comandos] Erro:', err.message);
    resposta = `⚠️ Erro ao processar comando "${raw}". Tente novamente.`;
  }

  return res.status(200).json({ resposta, ok: true });
}
