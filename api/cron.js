/**
 * api/cron.js — Todas as automações agendadas (unificado)
 * /api/cron?tipo=morning  → Resumo matinal (7h todo dia)
 * /api/cron?tipo=reviews  → Verifica avaliações Google (a cada hora)
 * /api/cron?tipo=weekly   → Relatório semanal (segunda 7h)
 */

import { adminFetch } from './_supabase-admin.js';

const SUPA_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPA_ANON = process.env.SUPABASE_ANON_KEY || '';
const WA_TOKEN  = process.env.WA_BUSINESS_TOKEN    || '';
const WA_PHONE  = process.env.WA_BUSINESS_PHONE_ID || '607518142444507';
const WA_DEST   = process.env.PHONE_BRIEFING        || '5516992943215';
const MESES = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS  = ['Domingo','Segunda-feira','Terca-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sabado'];

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (!r.ok) return null;
  if (r.status === 204) return null;
  if (!(r.headers.get('content-type') || '').includes('json')) return null;
  return r.json();
}

async function enviarWA(texto) {
  if (!WA_TOKEN) return false;
  const r = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: WA_DEST, type: 'text', text: { body: texto } }),
  });
  const d = await r.json();
  return !!d.messages?.[0]?.id;
}

async function runMorning() {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = now.toISOString().split('T')[0];
  const mes  = now.getMonth() + 1, ano = now.getFullYear();
  const fBRL = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [tarefas, metas, lancamentos, metricas] = await Promise.all([
    sb('/tarefas?concluida=eq.false&order=criado_em.desc&limit=10'),
    sb('/metas?ativa=eq.true&order=criado_em.desc&limit=10'),
    sb(`/lancamentos_financeiros?data=gte.${ano}-${String(mes).padStart(2,'0')}-01&order=data.desc&limit=50`),
    sb('/dados_assistente?select=*&limit=1'),
  ]);

  const receitas = (lancamentos || []).filter(l => l.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const despesas = (lancamentos || []).filter(l => l.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const m = metricas?.[0] || {};

  const metasStr = (metas || []).length
    ? metas.map(mt => { const p = mt.valor_meta > 0 ? Math.min(100, Math.round((mt.valor_atual / mt.valor_meta) * 100)) : 0; return `${mt.icone || '...'} ${mt.nome}: ${p}%`; }).join('\n')
    : 'Nenhuma meta cadastrada';

  const tarefasStr = (tarefas || []).length
    ? tarefas.slice(0, 5).map(t => `- ${t.texto || t.descricao || 'tarefa'}`).join('\n')
    : 'Nenhuma tarefa pendente!';

  const texto = [
    `BOM DIA, DR. EDSON!`,
    `${DIAS[now.getDay()]}, ${now.getDate()} de ${MESES[now.getMonth()]} de ${ano}`,
    ``,
    `REDES SOCIAIS`,
    `Instagram: ${m.ig_seguidores ? m.ig_seguidores.toLocaleString('pt-BR') + ' seguidores' : '-'}`,
    `Facebook: ${m.fb_curtidas ? m.fb_curtidas.toLocaleString('pt-BR') + ' fas' : '-'}`,
    `TikTok: ${m.tt_seguidores || '-'} seguidores`,
    `YouTube: ${m.yt_inscritos || '-'} inscritos`,
    ``,
    `FINANCEIRO - ${MESES[now.getMonth()].toUpperCase()}`,
    `Receitas: ${fBRL(receitas)}`,
    `Despesas: ${fBRL(despesas)}`,
    `Saldo: ${fBRL(receitas - despesas)}`,
    ``,
    `METAS DO MES`,
    metasStr,
    ``,
    `TAREFAS PENDENTES`,
    tarefasStr,
    ``,
    `Dashboard Pessoal - ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
  ].join('\n');

  await sb('/morning_briefing', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ data: hoje, texto, enviado_wa: false }),
  });
  const ok = await enviarWA(texto);
  if (ok) {
    await fetch(`${SUPA_URL}/rest/v1/morning_briefing?data=eq.${hoje}`, {
      method: 'PATCH',
      headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enviado_wa: true }),
    });
  }
  return { ok: true, tipo: 'morning', enviado_wa: ok };
}

async function runReviews() {
  const gTokenRows = await adminFetch('/oauth_tokens?servico=eq.google&select=*&limit=1');
  const gToken = gTokenRows?.[0]?.access_token;
  if (!gToken) return { ok: false, msg: 'Token Google ausente' };

  const accs = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${gToken}` }
  }).then(r => r.json()).catch(() => null);
  if (!accs?.accounts?.length) return { ok: false, msg: 'Conta GMB nao encontrada' };

  const accountName = accs.accounts[0].name;
  const locs = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`, {
    headers: { Authorization: `Bearer ${gToken}` }
  }).then(r => r.json()).catch(() => null);
  if (!locs?.locations?.length) return { ok: false, msg: 'Localizacao GMB nao encontrada' };

  const reviews = await fetch(`https://mybusiness.googleapis.com/v4/${accountName}/${locs.locations[0].name}/reviews?pageSize=5&orderBy=updateTime desc`, {
    headers: { Authorization: `Bearer ${gToken}` }
  }).then(r => r.json()).catch(() => null);
  if (!reviews?.reviews?.length) return { ok: true, msg: 'Sem avaliacoes', novas: 0 };

  const saved = await sb('/gmb_reviews?order=data_avaliacao.desc&limit=1');
  const ultimaId = saved?.[0]?.review_id || null;
  const novas = reviews.reviews.filter(r => r.reviewId !== ultimaId);
  if (!novas.length) return { ok: true, msg: 'Sem avaliacoes novas', novas: 0 };

  for (const rev of novas) {
    await sb('/gmb_reviews', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ review_id: rev.reviewId, autor: rev.reviewer?.displayName || 'Anonimo', nota: rev.starRating, comentario: rev.comment || '', data_avaliacao: rev.createTime || new Date().toISOString(), respondida: !!rev.reviewReply }),
    });
    const data = rev.createTime ? new Date(rev.createTime).toLocaleDateString('pt-BR') : '';
    const notas = { ONE: '1*', TWO: '2*', THREE: '3*', FOUR: '4*', FIVE: '5*' };
    await enviarWA(`NOVA AVALIACAO - Google Meu Negocio\n\n${notas[rev.starRating] || ''} - ${rev.reviewer?.displayName || 'Anonimo'}\n${data}\n\n"${rev.comment || '(sem comentario)'}"\n\n${rev.reviewReply ? 'Ja respondida' : 'Ainda sem resposta - considere responder!'}\n\nDashboard Pessoal`);
  }
  return { ok: true, novas: novas.length };
}

async function runWeekly() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const fBRL = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inicio = new Date(now); inicio.setDate(now.getDate() - 7);
  const d1 = `${inicio.getDate()}/${MESES[inicio.getMonth()]}`;
  const d2 = `${now.getDate()}/${MESES[now.getMonth()]}`;

  const [tarefas, lancamentos, metas, avaliacoes] = await Promise.all([
    sb('/tarefas?concluida=eq.true&order=criado_em.desc&limit=20'),
    sb(`/lancamentos_financeiros?data=gte.${inicio.toISOString().split('T')[0]}&order=data.desc`),
    sb('/metas?ativa=eq.true'),
    sb(`/gmb_reviews?data_avaliacao=gte.${inicio.toISOString()}&order=data_avaliacao.desc`),
  ]);

  const receitas = (lancamentos || []).filter(l => l.tipo === 'receita').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const despesas = (lancamentos || []).filter(l => l.tipo === 'despesa').reduce((s, l) => s + parseFloat(l.valor || 0), 0);
  const metasConcluidas = (metas || []).filter(m => m.valor_atual >= m.valor_meta).length;
  const notas = { ONE: '1*', TWO: '2*', THREE: '3*', FOUR: '4*', FIVE: '5*' };
  const avalStr = (avaliacoes || []).length
    ? avaliacoes.slice(0, 3).map(a => `${notas[a.nota] || ''} ${a.autor}: "${(a.comentario || '').substring(0, 60)}..."`).join('\n')
    : 'Nenhuma avaliacao nova esta semana';

  const texto = [
    `RELATORIO SEMANAL - Dr. Edson Barroso`,
    `${d1} a ${d2}`,
    ``,
    `FINANCEIRO DA SEMANA`,
    `Receitas: ${fBRL(receitas)}`,
    `Despesas: ${fBRL(despesas)}`,
    `Saldo: ${fBRL(receitas - despesas)}`,
    ``,
    `METAS DO MES`,
    `Concluidas: ${metasConcluidas}/${(metas || []).length}`,
    ``,
    `TAREFAS CONCLUIDAS NA SEMANA`,
    (tarefas || []).length ? tarefas.slice(0, 5).map(t => `- ${t.texto || 'tarefa'}`).join('\n') : 'Nenhuma registrada',
    ``,
    `AVALIACOES GOOGLE ESTA SEMANA`,
    avalStr,
    ``,
    `Relatorio automatico - ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
  ].join('\n');

  await enviarWA(texto);
  return { ok: true, tipo: 'weekly' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const tipo = req.query?.tipo || req.body?.tipo || 'morning';

  try {
    let result;
    if (tipo === 'morning')        result = await runMorning();
    else if (tipo === 'reviews')   result = await runReviews();
    else if (tipo === 'weekly')    result = await runWeekly();
    else return res.status(400).json({ erro: `tipo invalido: ${tipo}` });
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ ok: false, erro: e.message });
  }
}
