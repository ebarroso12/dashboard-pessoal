/**
 * api/lancamento.js — Registro de Lançamentos Financeiros via WhatsApp/Telegram
 *
 * Recebe lançamentos financeiros do OpenClaw e salva no Supabase.
 *
 * POST /api/lancamento
 *   Headers: X-Webhook-Token: oc_edson_2026_secure
 *   Body: {
 *     "descricao": "barbearia",
 *     "valor": 107.20,
 *     "tipo": "despesa",          // "despesa" | "receita"
 *     "data": "2026-05-18",       // opcional, default = hoje
 *     "categoria": "pessoal"      // opcional
 *   }
 *
 * Também aceita texto livre (OpenClaw):
 *   Body: { "texto": "barbearia 107,20" }
 *   Body: { "texto": "gastei 50 em combustível" }
 *
 * Colunas da tabela lancamentos_financeiros:
 *   id, tipo, descricao, valor, categoria, subcategoria,
 *   data, local_servico, observacoes, recibo_url, recibo_analise,
 *   criado_em, mes, ano
 */

const SUPABASE_URL = 'https://jaewjscbigfwjiaeavft.supabase.co';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'oc_edson_2026_secure';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Token',
  };
}

async function supabaseInsert(registro) {
  // Prefer service_role if available, fall back to anon key
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!key) throw new Error('Supabase key not configured');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/lancamentos_financeiros`, {
    method: 'POST',
    headers: {
      apikey:          key,
      Authorization:   `Bearer ${key}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
    },
    body: JSON.stringify(registro),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

// Parse texto livre: "barbearia 107,20" ou "gastei 107.20 em barbearia"
function parseTextoLivre(texto) {
  if (!texto) return null;

  let t = texto.trim().toLowerCase();

  // Remove prefixos comuns
  t = t
    .replace(/^gastei\s+/i, '')
    .replace(/^paguei\s+/i, '')
    .replace(/^comprei\s+/i, '')
    .replace(/^recebi\s+/i, '');

  // Extrai valor (aceita R$, vírgula ou ponto)
  const valorMatch = t.match(/R?\$?\s*([\d]+[.,][\d]{1,2}|[\d]+)/i);
  if (!valorMatch) return null;

  const valor = parseFloat(valorMatch[1].replace(',', '.'));
  if (isNaN(valor)) return null;

  // Descrição = texto sem o valor
  let descricao = t
    .replace(valorMatch[0], '')
    .replace(/\s+em\s+/g, ' ')
    .replace(/\s+de\s+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ') || 'Lançamento';

  descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);

  return { descricao, valor, tipo: 'despesa' };
}

function categoriaAuto(descricao) {
  const d = (descricao || '').toLowerCase();
  if (/barbearia|salao|cabelo|beleza/.test(d))      return 'pessoal';
  if (/mercado|supermercado|padaria|acougue/.test(d)) return 'alimentacao';
  if (/farmacia|medico|consulta|exame/.test(d))     return 'saude';
  if (/gasolina|combustivel|posto|uber|99/.test(d)) return 'transporte';
  if (/restaurante|lanche|almoco|jantar|cafe/.test(d)) return 'alimentacao';
  if (/escola|faculdade|curso|livro/.test(d))       return 'educacao';
  if (/luz|agua|gas|internet|telefone|conta/.test(d)) return 'moradia';
  return 'outros';
}

export default async function handler(req, res) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, message: 'Lançamento endpoint online' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const token = req.headers['x-webhook-token'] || req.body?.token;
  if (token !== WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const body = req.body || {};
  let { descricao, valor, tipo, data, categoria, subcategoria, local_servico, observacoes, texto } = body;

  // Parse texto livre se vier no formato simplificado
  if (texto && !descricao && !valor) {
    const parsed = parseTextoLivre(texto);
    if (!parsed) {
      return res.status(400).json({
        error: 'Formato não reconhecido. Tente: "barbearia 107,20" ou informe descricao e valor separados.',
      });
    }
    descricao = parsed.descricao;
    valor     = parsed.valor;
    tipo      = parsed.tipo;
  }

  // Validações
  if (!descricao || descricao.toString().trim() === '') {
    return res.status(400).json({ error: 'Campo "descricao" é obrigatório' });
  }
  if (valor === undefined || valor === null || isNaN(parseFloat(String(valor).replace(',', '.')))) {
    return res.status(400).json({ error: 'Campo "valor" é obrigatório e deve ser numérico' });
  }

  valor = parseFloat(String(valor).replace(',', '.'));
  tipo  = (tipo || 'despesa').toLowerCase();

  if (!['despesa', 'receita'].includes(tipo)) {
    return res.status(400).json({ error: '"tipo" deve ser "despesa" ou "receita"' });
  }

  const hoje = new Date().toISOString().split('T')[0];
  data      = data      || hoje;
  categoria = categoria || categoriaAuto(descricao);

  const registro = {
    descricao:     descricao.toString().trim(),
    valor,
    tipo,
    data,
    categoria,
    ...(subcategoria   ? { subcategoria }   : {}),
    ...(local_servico  ? { local_servico }  : {}),
    ...(observacoes    ? { observacoes }    : {}),
  };

  try {
    const result = await supabaseInsert(registro);

    // Sincronizar widget de finanças automaticamente (fire-and-forget)
    fetch('https://dashboard-pessoal-edson.vercel.app/api/finance/autosync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Token': WEBHOOK_TOKEN },
      body: JSON.stringify({}),
    }).catch(() => {}); // não bloqueia a resposta

    const emoji = tipo === 'receita' ? '💰' : '💸';
    const sinal = tipo === 'receita' ? '+' : '-';
    const valorFmt = `R$ ${valor.toFixed(2).replace('.', ',')}`;

    return res.status(201).json({
      ok: true,
      message: `${emoji} Lançamento registrado!\n\n📝 ${descricao}\n${sinal} ${valorFmt}\n📅 ${data}\n🏷️ ${categoria}`,
      data: Array.isArray(result) ? result[0] : result,
    });
  } catch (e) {
    console.error('[lancamento] Erro Supabase:', e.message);
    return res.status(500).json({
      error: 'Falha ao salvar lançamento',
      detail: e.message,
    });
  }
}
