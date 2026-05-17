// POST /api/briefing  — Briefing Executivo IA para o Dr. Edson Barroso
// Agrega dados reais do dashboard e gera sumário com GPT-4.1-mini.
// Fallback sem IA: retorna dados brutos formatados.

import { adminFetch } from './_supabase-admin.js';

const ALLOWED_ORIGIN = 'https://dashboard-pessoal-edson.vercel.app';
const BASE_URL = 'https://dashboard-pessoal-edson.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const gerado_em = new Date().toISOString();
  const fontes = [];

  // ── 1. Coletar dados em paralelo ─────────────────────────────────────
  const [tarefas, finRows, alertas, calendar, vvSum] = await Promise.allSettled([
    adminFetch('/tarefas?concluida=eq.false&order=criado_em.desc&limit=8'),
    adminFetch('/dados_assistente?tipo=eq.financeiro&select=dados&limit=1&order=atualizado_em.desc'),
    adminFetch('/supervisor_logs?select=severidade,mensagem,componente&order=criado_em.desc&limit=5'),
    fetch(`${BASE_URL}/api/google/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(6000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${BASE_URL}/api/vidavirtual/summary`, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    }).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const tasks  = tarefas.status === 'fulfilled'  ? (tarefas.value  || []) : [];
  const fin    = finRows.status === 'fulfilled'   ? (finRows.value?.[0]?.dados || {}) : {};
  const alerts = alertas.status === 'fulfilled'   ? (alertas.value || []) : [];
  const cal    = calendar.status === 'fulfilled'  ? calendar.value  : null;
  const vv     = vvSum.status === 'fulfilled'     ? vvSum.value     : null;

  if (tasks.length)       fontes.push('tarefas');
  if (fin.renda)          fontes.push('financeiro');
  if (alerts.length)      fontes.push('supervisor_logs');
  if (cal?.events)        fontes.push('google_calendar');
  if (vv?.status === 'ok') fontes.push('vidavirtual');

  // ── 2. Montar contexto para o prompt ─────────────────────────────────
  const fBRL = v => 'R$ ' + parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

  const tarefasStr = tasks.length
    ? tasks.slice(0, 5).map(t => `- ${t.texto || t.descricao || 'tarefa'}`).join('\n')
    : 'Nenhuma tarefa pendente';

  const finStr = fin.renda
    ? `Renda: ${fBRL(fin.renda)} | Despesas: ${fBRL(fin.despesas)} | Saldo: ${fBRL((fin.renda||0)-(fin.despesas||0))} | Mês: ${fin.mes||'atual'}`
    : 'Dados financeiros não sincronizados';

  const eventsStr = cal?.events?.length
    ? cal.events.slice(0, 5).map(e => `- ${e.title || e.summary || 'evento'} ${e.start ? `às ${e.start}` : ''}`).join('\n')
    : 'Sem eventos no calendário';

  const alertasStr = alerts.length
    ? alerts.map(a => `[${(a.severidade||'info').toUpperCase()}] ${a.componente}: ${a.mensagem}`).join('\n')
    : 'Sem alertas';

  const contexto = `DATA: ${now.toLocaleDateString('pt-BR', {weekday:'long',day:'2-digit',month:'long',year:'numeric'})}

CALENDÁRIO:
${eventsStr}

TAREFAS PENDENTES:
${tarefasStr}

FINANCEIRO (${fin.mes||'mês atual'}):
${finStr}

ALERTAS DO SISTEMA:
${alertasStr}

VIDAVIRTUAL (assistencia tecnica):
${vv?.status === 'ok'
  ? `OS abertas: ${vv.os_abertas} | Atrasadas: ${vv.os_atrasadas} | Aguardando peca: ${vv.aparelhos_aguardando} | Pagamentos pendentes: ${vv.pagamentos_pendentes}`
  : vv?.status === 'sem_dados' ? 'Sem dados operacionais'
  : 'Indisponivel ou nao configurado'}`;

  // ── 3. Gerar briefing com GPT-4.1-mini ───────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY || '';
  let briefing = '';

  if (apiKey) {
    try {
      const cr = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          max_tokens: 500,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: 'Você é o assistente executivo do Dr. Edson Barroso, médico psiquiatra. Gere um briefing diário conciso, direto e útil. Sem texto motivacional. Sem enrolação. Foco em prioridades, riscos e pendências operacionais. Máximo 300 palavras.'
            },
            {
              role: 'user',
              content: `Com base nos dados abaixo, gere o BRIEFING EXECUTIVO do dia no formato:\n\n📅 AGENDA DO DIA\n✅ TOP 3 PRIORIDADES\n⚠️ RISCOS / ALERTAS\n💰 FINANCEIRO\n🔧 STATUS SISTEMAS\n\nDADOS:\n${contexto}`
            }
          ],
        }),
      });
      const cd = await cr.json();
      briefing = cd.choices?.[0]?.message?.content || '';
    } catch(e) {
      console.warn('[briefing] GPT falhou:', e.message);
    }
  }

  // Fallback sem IA
  if (!briefing) {
    briefing = `📊 BRIEFING EXECUTIVO — ${now.toLocaleDateString('pt-BR')}\n\n📅 AGENDA DO DIA:\n${eventsStr}\n\n✅ TAREFAS PENDENTES:\n${tarefasStr}\n\n💰 FINANCEIRO:\n${finStr}\n\n⚠️ ALERTAS:\n${alertasStr}\n\n[Briefing gerado sem IA — configure OPENAI_API_KEY para análise inteligente]`;
  }

  // ── 4. Salvar em dados_assistente com tipo briefing_executivo ─────────
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await adminFetch(`/dados_assistente?tipo=eq.briefing_executivo&atualizado_em=lt.${cutoff}`, { method: 'DELETE' });
    await adminFetch('/dados_assistente', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        tipo: 'briefing_executivo',
        dados: { texto: briefing, fontes, gerado_em },
        atualizado_em: gerado_em,
      }),
    });
  } catch(e) {
    console.warn('[briefing] Erro ao salvar:', e.message);
  }

  return res.status(200).json({ briefing, gerado_em, fontes });
}
