/**
 * api/assistente.js — Assistente Pessoal do Dashboard (Vercel Serverless)
 * Edson Barroso © 2026
 *
 * Recebe comandos em linguagem natural (voz transcrita ou texto),
 * detecta a intenção, executa a ação e devolve uma resposta formatada.
 *
 * POST /api/assistente
 *   Headers: X-Webhook-Token: oc_edson_2026_secure
 *   Body: { "q": "qual o saldo do mês?", "origem": "whatsapp" }
 *
 * GET /api/assistente/historico
 *   Retorna últimas 20 conversas
 */

const SUPA_URL  = 'https://jaewjscbigfwjiaeavft.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZXdqc2NiaWdmd2ppYWVhdmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTUwNDksImV4cCI6MjA4Nzg5MTA0OX0.xLo3VVkQmItv9Q7vQ_U_i60FXQj8FzSogwVBfbAPbfU';
const TOKEN     = process.env.WEBHOOK_TOKEN || 'oc_edson_2026_secure';

// ── Helpers Supabase ─────────────────────────────────────
async function sb(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_ANON,
      Authorization: `Bearer ${SUPA_ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const txt = await r.text();
  try { return { ok: r.ok, status: r.status, data: JSON.parse(txt) }; }
  catch { return { ok: r.ok, status: r.status, data: txt }; }
}

// ── Formatação monetária ─────────────────────────────────
function brl(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

// ── Detecção de intenção em português ───────────────────
function detectIntent(q) {
  const t = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // ── LEITURA ───────────────────────────────────────────
  if (/compromisso|agenda|reunia|calendario|hoje|amanha|semana|horario/.test(t))
    return 'ler_calendario';
  if (/instagram|ig\b|seguidores|curtidas|posts|stories/.test(t))
    return 'ler_instagram';
  if (/facebook|fb\b|pagina|alcance/.test(t))
    return 'ler_facebook';
  if (/youtube|yt\b|canal|video|inscritos|views|visualizacoes/.test(t))
    return 'ler_youtube';
  if (/analytics|visitas|site|trafego|sessoes|ga\b/.test(t))
    return 'ler_analytics';
  if (/tiktok|tt\b|tikTok/.test(t))
    return 'ler_tiktok';
  if (/nota|anotacao|anotacoes|lembretes/.test(t) && !/cria|adiciona|nova|nova|escreve|anota\b/.test(t))
    return 'ler_notas';
  if (/tarefa|tarefas|afazeres|to.?do/.test(t) && !/cria|adiciona|nova/.test(t))
    return 'ler_tarefas';
  if (/saldo|financeiro|caixa|quanto tenho|dinheiro|renda|receita\b|despesa\b|gasto\b/.test(t)
      && !/adiciona|lancei|paguei|gastei|recebi|cria/.test(t))
    return 'ler_financeiro';
  if (/resumo|relatorio|dashboard|como esta|como ta|tudo|geral/.test(t))
    return 'resumo_geral';

  // ── ESCRITA FINANCEIRO ────────────────────────────────
  if (/recebi|entrada|ganhei|faturei|adiciona.*receita|receita.*adiciona|salario|salário/.test(t))
    return 'add_receita';
  if (/paguei|gastei|comprei|despesa|gasto|saida|lancei.*despesa|despesa.*lancei/.test(t))
    return 'add_despesa';

  // ── ESCRITA AGENDA ────────────────────────────────────
  if (/criar.*compromisso|agendar|marcar.*reunia|marcar.*compromisso|novo.*evento|adiciona.*agenda/.test(t))
    return 'add_compromisso';

  // ── ESCRITA NOTAS ─────────────────────────────────────
  if (/anota|anotar|cria.*nota|adiciona.*nota|escreve|lembra.*que|lembrete/.test(t))
    return 'add_nota';

  // ── ESCRITA TAREFAS ───────────────────────────────────
  if (/tarefa|afazer|to.?do|criar.*tarefa|adiciona.*tarefa|nova.*tarefa|preciso|tenho que/.test(t))
    return 'add_tarefa';

  return 'desconhecido';
}

// ── Extrai valor monetário de texto ─────────────────────
function extrairValor(t) {
  const m = t.match(/r?\$?\s*(\d[\d.,]*)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}

// ── Extrai descrição após valor ou palavra-chave ─────────
function extrairDesc(t, palavras = []) {
  for (const p of palavras) {
    const idx = t.toLowerCase().indexOf(p);
    if (idx !== -1) {
      const resto = t.slice(idx + p.length).replace(/^\s+de\s+/i, '').trim();
      if (resto) return resto;
    }
  }
  return t.trim();
}

// ── Handlers por intenção ────────────────────────────────

async function lerFinanceiro() {
  const r = await sb('/dados_assistente?tipo=eq.financeiro&select=dados,atualizado_em');
  if (!r.ok || !r.data?.length) return '📊 Ainda não tenho dados financeiros sincronizados. Acesse o dashboard e salve os dados para eu ter acesso.';
  const d = r.data[0].dados;
  const atu = new Date(r.data[0].atualizado_em).toLocaleString('pt-BR');
  const renda = d.renda || 0, desp = d.despesas || 0, saldo = renda - desp;
  let txt = `💰 *Financeiro — ${d.mes || 'Mês atual'}*\n\n`;
  txt += `• Receita: ${brl(renda)}\n`;
  txt += `• Despesas: ${brl(desp)}\n`;
  txt += `• Saldo: *${brl(saldo)}* ${saldo >= 0 ? '✅' : '⚠️'}\n`;
  if (d.patrimonio) txt += `\n🏦 Patrimônio líquido: ${brl(d.patrimonio)}`;
  txt += `\n\n_Atualizado: ${atu}_`;
  return txt;
}

async function addReceita(q) {
  const valor = extrairValor(q);
  const desc  = extrairDesc(q, ['recebi', 'ganhei', 'faturei', 'receita de', 'entrada de']) || 'Receita';
  if (!valor) return '❓ Não consegui identificar o valor. Ex: "Recebi R$ 500 de consultoria"';

  // Salva no Supabase e atualiza cache
  const r = await sb('/dados_assistente?tipo=eq.financeiro&select=dados');
  const atual = r.data?.[0]?.dados || {};
  atual.renda = (atual.renda || 0) + valor;
  atual.lancamentos = atual.lancamentos || [];
  atual.lancamentos.push({ tipo: 'receita', valor, desc, ts: new Date().toISOString() });

  await sb('/dados_assistente', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ tipo: 'financeiro', dados: atual, atualizado_em: new Date().toISOString() }),
  });

  return `✅ *Receita registrada!*\n💚 +${brl(valor)} — ${desc}\n\nNova receita total: ${brl(atual.renda)}`;
}

async function addDespesa(q) {
  const valor = extrairValor(q);
  const desc  = extrairDesc(q, ['paguei', 'gastei', 'comprei', 'despesa de', 'gasto de']) || 'Despesa';
  if (!valor) return '❓ Não consegui identificar o valor. Ex: "Paguei R$ 200 de aluguel"';

  const r = await sb('/dados_assistente?tipo=eq.financeiro&select=dados');
  const atual = r.data?.[0]?.dados || {};
  atual.despesas = (atual.despesas || 0) + valor;
  atual.lancamentos = atual.lancamentos || [];
  atual.lancamentos.push({ tipo: 'despesa', valor, desc, ts: new Date().toISOString() });

  await sb('/dados_assistente', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ tipo: 'financeiro', dados: atual, atualizado_em: new Date().toISOString() }),
  });

  const saldo = (atual.renda || 0) - atual.despesas;
  return `✅ *Despesa registrada!*\n🔴 -${brl(valor)} — ${desc}\n\nSaldo atual: ${brl(saldo)} ${saldo >= 0 ? '✅' : '⚠️'}`;
}

async function lerCalendario() {
  // Tenta usar Google Calendar com token salvo
  const tk = await sb("/oauth_tokens?servico=eq.google&select=access_token,refresh_token");
  if (!tk.ok || !tk.data?.length) {
    // Fallback: dados em cache
    const r = await sb('/dados_assistente?tipo=eq.calendario&select=dados,atualizado_em');
    if (!r.ok || !r.data?.length) return '📅 Conecte o Google Calendar no dashboard para eu poder consultar seus compromissos.';
    const eventos = r.data[0].dados?.hoje || [];
    if (!eventos.length) return '📅 Nenhum compromisso para hoje.';
    let txt = `📅 *Compromissos de hoje:*\n\n`;
    eventos.forEach(e => { txt += `• ${e.hora || '(sem hora)'} — ${e.titulo}\n`; });
    return txt;
  }

  // Chama Google Calendar API
  try {
    const hoje = new Date();
    const inicio = new Date(hoje.setHours(0,0,0,0)).toISOString();
    const fim    = new Date(hoje.setHours(23,59,59,999)).toISOString();
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${inicio}&timeMax=${fim}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${tk.data[0].access_token}` } }
    );
    const cal = await calRes.json();
    if (!cal.items?.length) return '📅 Nenhum compromisso para hoje. Dia livre! 🎉';
    let txt = `📅 *Compromissos de hoje:*\n\n`;
    cal.items.forEach(e => {
      const hr = e.start?.dateTime
        ? new Date(e.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'dia inteiro';
      txt += `• ${hr} — ${e.summary}\n`;
    });
    return txt;
  } catch(e) {
    return '❌ Erro ao consultar o calendário. Tente reconectar o Google no dashboard.';
  }
}

async function addCompromisso(q) {
  // Extrai info básica do texto
  const tk = await sb("/oauth_tokens?servico=eq.google&select=access_token");
  const titulo = q.replace(/criar|agendar|marcar|compromisso|reuniao|evento/gi, '').trim() || 'Novo compromisso';
  const horaM  = q.match(/(\d{1,2})[h:](\d{0,2})/i);
  const hora   = horaM ? `${horaM[1].padStart(2,'0')}:${(horaM[2]||'00').padStart(2,'0')}` : '09:00';

  if (!tk.ok || !tk.data?.length) {
    // Salva no cache para o dashboard processar
    const cache = await sb('/dados_assistente?tipo=eq.acoes_pendentes&select=dados');
    const pendentes = cache.data?.[0]?.dados?.lista || [];
    pendentes.push({ acao: 'criar_compromisso', titulo, hora, ts: new Date().toISOString() });
    await sb('/dados_assistente', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ tipo: 'acoes_pendentes', dados: { lista: pendentes }, atualizado_em: new Date().toISOString() }),
    });
    return `📅 Compromisso *"${titulo}"* às ${hora} salvo!\n⚠️ Conecte o Google Calendar no dashboard para sincronizar automaticamente.`;
  }

  // Cria no Google Calendar
  try {
    const dataHoje = new Date().toISOString().split('T')[0];
    const event = {
      summary: titulo,
      start: { dateTime: `${dataHoje}T${hora}:00`, timeZone: 'America/Sao_Paulo' },
      end:   { dateTime: `${dataHoje}T${hora.replace(/(\d+):(\d+)/, (_,h,m)=>`${String(+h+1).padStart(2,'0')}:${m}`)}:00`, timeZone: 'America/Sao_Paulo' },
    };
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tk.data[0].access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const created = await res.json();
    if (created.id) return `✅ *Compromisso criado no Google Calendar!*\n📅 "${titulo}" às ${hora} de hoje`;
    return `❌ Erro ao criar compromisso: ${created.error?.message || 'desconhecido'}`;
  } catch(e) {
    return '❌ Erro ao criar compromisso no Google Calendar.';
  }
}

async function lerInstagram() {
  const r = await sb('/dados_assistente?tipo=eq.instagram&select=dados,atualizado_em');
  if (!r.ok || !r.data?.length) return '📸 Ainda sem dados do Instagram. Conecte no dashboard e as métricas aparecerão aqui.';
  const d = r.data[0].dados;
  const atu = new Date(r.data[0].atualizado_em).toLocaleString('pt-BR');
  let txt = `📸 *Instagram — @${d.usuario || 'sua conta'}*\n\n`;
  txt += `• Seguidores: ${(d.seguidores||0).toLocaleString('pt-BR')}\n`;
  txt += `• Seguindo: ${(d.seguindo||0).toLocaleString('pt-BR')}\n`;
  txt += `• Posts: ${(d.posts||0).toLocaleString('pt-BR')}\n`;
  if (d.alcance)   txt += `• Alcance 30d: ${(d.alcance||0).toLocaleString('pt-BR')}\n`;
  if (d.impressoes) txt += `• Impressões: ${(d.impressoes||0).toLocaleString('pt-BR')}\n`;
  txt += `\n_Atualizado: ${atu}_`;
  return txt;
}

async function lerFacebook() {
  const r = await sb('/dados_assistente?tipo=eq.facebook&select=dados,atualizado_em');
  if (!r.ok || !r.data?.length) return '📘 Sem dados do Facebook ainda. Conecte no dashboard.';
  const d = r.data[0].dados;
  const atu = new Date(r.data[0].atualizado_em).toLocaleString('pt-BR');
  let txt = `📘 *Facebook — ${d.pagina || 'sua página'}*\n\n`;
  txt += `• Seguidores: ${(d.seguidores||0).toLocaleString('pt-BR')}\n`;
  txt += `• Curtidas: ${(d.curtidas||0).toLocaleString('pt-BR')}\n`;
  if (d.alcance) txt += `• Alcance 28d: ${(d.alcance||0).toLocaleString('pt-BR')}\n`;
  txt += `\n_Atualizado: ${atu}_`;
  return txt;
}

async function lerYoutube() {
  const r = await sb('/dados_assistente?tipo=eq.youtube&select=dados,atualizado_em');
  if (!r.ok || !r.data?.length) return '▶️ Sem dados do YouTube ainda. Conecte no dashboard.';
  const d = r.data[0].dados;
  const atu = new Date(r.data[0].atualizado_em).toLocaleString('pt-BR');
  let txt = `▶️ *YouTube — ${d.canal || 'seu canal'}*\n\n`;
  txt += `• Inscritos: ${(d.inscritos||0).toLocaleString('pt-BR')}\n`;
  txt += `• Views 28d: ${(d.views||0).toLocaleString('pt-BR')}\n`;
  if (d.assistido_min) txt += `• Tempo assistido: ${d.assistido_min} min\n`;
  txt += `\n_Atualizado: ${atu}_`;
  return txt;
}

async function lerAnalytics() {
  const r = await sb('/dados_assistente?tipo=eq.analytics&select=dados,atualizado_em');
  if (!r.ok || !r.data?.length) return '📊 Sem dados do Google Analytics ainda. Conecte no dashboard.';
  const d = r.data[0].dados;
  const atu = new Date(r.data[0].atualizado_em).toLocaleString('pt-BR');
  let txt = `📊 *Google Analytics*\n\n`;
  txt += `• Usuários ativos: ${(d.usuarios||0).toLocaleString('pt-BR')}\n`;
  txt += `• Sessões 30d: ${(d.sessoes||0).toLocaleString('pt-BR')}\n`;
  if (d.bounce) txt += `• Taxa de rejeição: ${d.bounce}%\n`;
  txt += `\n_Atualizado: ${atu}_`;
  return txt;
}

async function lerNotas() {
  const r = await sb('/notas?select=id,texto,criado_em&order=criado_em.desc&limit=5');
  if (!r.ok || !r.data?.length) return '📝 Nenhuma anotação ainda. Me diga "anota que..." para criar uma!';
  let txt = `📝 *Últimas anotações:*\n\n`;
  r.data.forEach((n, i) => {
    const dt = new Date(n.criado_em).toLocaleDateString('pt-BR');
    txt += `${i+1}. ${n.texto} _(${dt})_\n`;
  });
  return txt;
}

async function addNota(q) {
  const texto = q.replace(/anota|anotar|cria.*nota|adiciona.*nota|escreve|lembra.*que|lembrete|que/gi, '').trim();
  if (!texto) return '❓ O que devo anotar? Ex: "Anota que tenho reunião amanhã cedo"';
  await sb('/notas', { method: 'POST', body: JSON.stringify({ texto }) });
  return `📝 *Anotação salva!*\n"${texto}"`;
}

async function lerTarefas() {
  const r = await sb('/tarefas?select=id,texto,concluida,criado_em&order=criado_em.desc&limit=10');
  if (!r.ok || !r.data?.length) return '✅ Nenhuma tarefa ainda. Me diga "preciso fazer..." para criar uma!';
  const pendentes  = r.data.filter(t => !t.concluida);
  const concluidas = r.data.filter(t =>  t.concluida);
  let txt = pendentes.length
    ? `📋 *Tarefas pendentes (${pendentes.length}):*\n` + pendentes.map(t => `• ${t.texto}`).join('\n')
    : '📋 Todas as tarefas concluídas! 🎉';
  if (concluidas.length) txt += `\n\n✅ Concluídas: ${concluidas.length}`;
  return txt;
}

async function addTarefa(q) {
  const texto = q.replace(/criar.*tarefa|adiciona.*tarefa|nova.*tarefa|preciso|tenho que|lembrar de|tarefa/gi, '').trim();
  if (!texto) return '❓ Qual tarefa devo adicionar? Ex: "Criar tarefa ligar para o cliente"';
  await sb('/tarefas', { method: 'POST', body: JSON.stringify({ texto }) });
  return `✅ *Tarefa adicionada!*\n"${texto}"`;
}

async function resumoGeral() {
  const [fin, ig, cal] = await Promise.all([lerFinanceiro(), lerInstagram(), lerCalendario()]);
  return `🤖 *Resumo do seu Dashboard*\n\n${cal}\n\n${fin}\n\n${ig}`;
}

// ── Salva no histórico ───────────────────────────────────
async function salvarHistorico(origem, pergunta, resposta, intencao) {
  await sb('/chat_assistente', {
    method: 'POST',
    body: JSON.stringify({ origem, pergunta, resposta, intencao }),
  });
}

// ── Handler principal ────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Token');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // GET /api/assistente → histórico de conversas
  if (req.method === 'GET') {
    const r = await sb('/chat_assistente?select=*&order=criado_em.desc&limit=20');
    res.status(200).json(r.data || []);
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido' }); return; }

  // Valida token
  const body   = req.body || {};
  const tk     = req.headers['x-webhook-token'] || body.token || '';
  if (tk !== TOKEN) { res.status(401).json({ error: 'Token inválido' }); return; }

  const q      = (body.q || body.texto || body.text || '').trim();
  const origem = body.origem || 'whatsapp';
  if (!q) { res.status(400).json({ error: 'Campo "q" obrigatório' }); return; }

  // Detecta intenção e executa
  const intencao = detectIntent(q);
  let resposta;

  try {
    switch (intencao) {
      case 'ler_financeiro':   resposta = await lerFinanceiro();     break;
      case 'add_receita':      resposta = await addReceita(q);       break;
      case 'add_despesa':      resposta = await addDespesa(q);       break;
      case 'ler_calendario':   resposta = await lerCalendario();     break;
      case 'add_compromisso':  resposta = await addCompromisso(q);   break;
      case 'ler_instagram':    resposta = await lerInstagram();      break;
      case 'ler_facebook':     resposta = await lerFacebook();       break;
      case 'ler_youtube':      resposta = await lerYoutube();        break;
      case 'ler_analytics':    resposta = await lerAnalytics();      break;
      case 'ler_notas':        resposta = await lerNotas();          break;
      case 'add_nota':         resposta = await addNota(q);          break;
      case 'ler_tarefas':      resposta = await lerTarefas();        break;
      case 'add_tarefa':       resposta = await addTarefa(q);        break;
      case 'resumo_geral':     resposta = await resumoGeral();       break;
      default:
        resposta = `🤖 Não entendi o comando. Tente:\n• "compromissos de hoje"\n• "saldo do mês"\n• "como está o Instagram"\n• "paguei R$ 200 de mercado"\n• "recebi R$ 1000"\n• "anota que..."\n• "criar tarefa..."`;
    }
  } catch (e) {
    console.error('Assistente erro:', e);
    resposta = '❌ Ocorreu um erro interno. Tente novamente.';
  }

  // Salva histórico assincronamente
  salvarHistorico(origem, q, resposta, intencao).catch(() => {});

  res.status(200).json({ ok: true, resposta, intencao });
}
